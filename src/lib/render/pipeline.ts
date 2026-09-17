import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import sharp from "sharp";
import * as R from "@/lib/render";
import { publicUrl } from "@/lib/storage";
import { consumeCredits, refundCredits } from "@/lib/tenancy";
import type { ContentMedia, ContentFormat, CompanyProfileData, TrendRecipe, OverlayStyle } from "@/db/schema";
import type { Copy } from "@/lib/generation";

const exec = promisify(execFile);
export async function fetchBuf(url: string | null | undefined) { if (!url) return null; try { const r = await fetch(url); return r.ok ? Buffer.from(await r.arrayBuffer()) : null; } catch { return null; } }
const preset = () => (process.env.PROVIDER_MODE === "live" ? "veryfast" : "ultrafast");

export type RenderCtx = {
  prepaid?: boolean; requestedSeconds?: number; itemId: string; workspaceId: string; accountId: string; format: ContentFormat; profile: CompanyProfileData;
  screenshot: Buffer | null; demoVideo: Buffer | null; character: { id: string; name: string; referenceImages: string[]; voiceId: string | null } | null;
  clip: { storageKey: string; licenceType: "audio_replace" | "subtitle_only"; durationMs: number } | null;
  image: { storageKey: string; thumbnailKey: string | null; width: number | null; height: number | null } | null;
  trend: TrendRecipe | null; overlayStyle: OverlayStyle | null; beatDurations?: number[] | null;
};

/** Overlay caption beats onto b-roll video (demo video or human UGC clip), cut to the total beat length, muted or with supplied audio. */
export async function overlayBeatsOnVideo(video: Buffer, beats: { text: string; seconds: number }[], brand: R.Brand, audio: Buffer | null, keepOriginalAudio: boolean, style?: OverlayStyle | null) {
  const dir = await mkdtemp(join(tmpdir(), "vel-"));
  try {
    const inp = join(dir, "in.mp4"); await writeFile(inp, video);
    const total = beats.reduce((a, b) => a + b.seconds, 0);
    const inputs = ["-y", "-stream_loop", "-1", "-i", inp];
    let t = 0; const filters: string[] = ["[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p[base]"]; let last = "base";
    for (let i = 0; i < beats.length; i++) {
      const f = join(dir, `o${i}.png`); await writeFile(f, await captionOverlay(beats[i].text, brand, style));
      inputs.push("-i", f);
      filters.push(`[${last}][${i + 1}:v]overlay=0:0:enable='between(t,${t},${t + beats[i].seconds})'[v${i}]`); last = `v${i}`; t += beats[i].seconds;
    }
    const out = join(dir, "out.mp4"); const args = [...inputs];
    if (audio) { await writeFile(join(dir, "a.mp3"), audio); args.push("-i", join(dir, "a.mp3")); }
    args.push("-filter_complex", filters.join(";"), "-map", `[${last}]`);
    if (audio) args.push("-map", `${beats.length + 1}:a`, "-c:a", "aac"); else if (keepOriginalAudio) args.push("-map", "0:a?", "-c:a", "aac"); else args.push("-an");
    args.push("-t", String(total), "-r", "30", "-c:v", "libx264", "-preset", preset(), "-crf", "23", "-movflags", "+faststart", out);
    await exec("ffmpeg", args, { maxBuffer: 1 << 26 });
    return { mp4: await readFile(out), durationMs: Math.round(total * 1000) };
  } finally { await rm(dir, { recursive: true, force: true }); }
}
/** Transparent PNG with a caption pill for overlaying on video. */
async function captionOverlay(line: string, brand: R.Brand, style?: OverlayStyle | null) {
  const s = R.resolveOverlayStyle(style);
  const scale = s.fontSizePx / 88; // pill/line-height must scale with font size or larger sizes overflow the pill and smaller sizes leave it oversized
  const words = line.split(/\s+/); const lines: string[] = []; let cur = ""; for (const w of words) { if ((cur + " " + w).trim().length > 20) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim(); } if (cur) lines.push(cur);
  const lineH = 112 * scale, padding = 120 * scale;
  const boxHeight = lines.length * lineH + padding;
  const centerY = s.position === "top" ? 60 + boxHeight / 2 : s.position === "bottom" ? R.H - 60 - boxHeight / 2 : R.H / 2;
  const y0 = centerY - (lines.length - 1) * (lineH / 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${R.W}" height="${R.H}"><rect x="60" y="${centerY - boxHeight / 2}" width="${R.W - 120}" height="${boxHeight}" rx="36" fill="${R.esc(brand.secondary)}" fill-opacity="0.75"/>${lines.map((l, i) => `<text x="${R.W / 2}" y="${y0 + 20 * scale + i * lineH}" font-family="${R.esc(s.fontFamily)}" font-size="${s.fontSizePx}" font-weight="${s.weight}" fill="${R.esc(s.color)}" text-anchor="middle">${R.esc(l)}</text>`).join("")}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Render media for an item and return the media descriptor + credits used. Throws on provider failure (credits refunded). */
export async function renderMedia(ctx: RenderCtx, copy: Copy): Promise<{ media: ContentMedia; creditsUsed: number }> {
  const brand: R.Brand = { primary: ctx.profile.brand.primary_color || "#1F3A93", secondary: ctx.profile.brand.secondary_color || "#0B1F4B", name: ctx.profile.product_name };
  const media: ContentMedia = { width: R.W, height: R.H }; const prefix = `ws/${ctx.workspaceId}/content/${ctx.itemId}`; let creditsUsed = 0;
  const storeVideo = async (mp4: Buffer, durationMs: number) => { media.video_key = await R.store(`${prefix}/video.mp4`, mp4, "video/mp4"); media.duration_ms = durationMs; media.thumbnail_key = await R.store(`${prefix}/thumb.jpg`, await R.thumbnail(mp4), "image/jpeg"); };

  if (ctx.format === "slideshow") {
    const slides = copy.slides?.length ? copy.slides : copy.on_screen_text.map((t) => ({ title: t, body: "" }));
    const pngs: Buffer[] = []; media.image_keys = [];
    for (let i = 0; i < slides.length; i++) { const png = await R.renderSlide(i, slides.length, slides[i].title, slides[i].body, brand, i === 1 ? ctx.screenshot : null); pngs.push(png); media.image_keys.push(await R.store(`${prefix}/slide-${i + 1}.png`, png, "image/png")); }
    const { mp4, durationMs } = await R.framesToVideo(pngs.map((png) => ({ png, seconds: 2.5 }))); await storeVideo(mp4, durationMs);
  } else if (ctx.format === "meme") {
    const png = await R.renderMeme(copy.meme_top ?? copy.hook, copy.meme_bottom ?? copy.caption, brand, ctx.screenshot);
    media.image_keys = [await R.store(`${prefix}/meme.png`, png, "image/png")]; media.thumbnail_key = media.image_keys[0];
  } else if (ctx.format === "hook_demo" || ctx.format === "remix") {
    const defaultBeats = ctx.format === "remix" && ctx.trend ? ctx.trend.structure.map((s, i) => ({ text: copy.on_screen_text[i] ?? s.text_slot ?? s.segment, seconds: s.seconds })) : [{ text: copy.hook, seconds: 3 }, ...copy.on_screen_text.slice(1).map((t) => ({ text: t, seconds: 3 }))];
    // User-edited per-beat durations from TimelineEditor (provenance.beat_durations) override the default
    // 3s/trend-derived timing when present -- only meaningful for hook_demo/remix, which have no synthesized
    // voice track to desync from (human_ugc/ai_ugc timing is derived from TTS audio length instead).
    const beats = ctx.beatDurations?.length === defaultBeats.length ? defaultBeats.map((b, i) => ({ ...b, seconds: ctx.beatDurations![i] })) : defaultBeats;
    if (ctx.demoVideo) { const { mp4, durationMs } = await overlayBeatsOnVideo(ctx.demoVideo, beats, brand, null, false, ctx.overlayStyle); await storeVideo(mp4, durationMs); }
    else { const frames = []; for (const b of beats) frames.push({ png: await R.renderCaptionFrame(b.text, brand, undefined, ctx.screenshot, ctx.overlayStyle), seconds: b.seconds }); const { mp4, durationMs } = await R.framesToVideo(frames); await storeVideo(mp4, durationMs); }
  } else if (ctx.format === "human_ugc") {
    if (!ctx.clip) throw new Error("No licensed UGC clip available for this item");
    const clip = await fetchBuf(publicUrl(ctx.clip.storageKey)); if (!clip) throw new Error("UGC clip not readable");
    const { audio, durationMs } = await R.tts(copy.script, null);
    const seconds = Math.min(Math.round(ctx.clip.durationMs / 1000) || 30, Math.max(15, Math.ceil(durationMs / 1000)));
    const beats = copy.on_screen_text.length ? copy.on_screen_text.map((t) => ({ text: t, seconds: seconds / copy.on_screen_text.length })) : [{ text: copy.hook, seconds }];
    const { mp4 } = await overlayBeatsOnVideo(clip, beats, brand, ctx.clip.licenceType === "audio_replace" ? audio : null, ctx.clip.licenceType !== "audio_replace", ctx.overlayStyle);
    const fin = await R.finalizeVideo(mp4, R.scriptToSrt(copy.script, seconds * 1000)); await storeVideo(fin.mp4, fin.durationMs);
  } else if (ctx.format === "ai_ugc") {
    const { audio, durationMs } = await R.tts(copy.script, ctx.character?.voiceId ?? null);
    const seconds = ctx.requestedSeconds ?? Math.min(60, Math.max(15, Math.ceil(durationMs / 1000)));
    const providerLive = process.env.PROVIDER_MODE === "live" && !!process.env.VIDEO_PROVIDER_URL;
    if (providerLive && !ctx.prepaid) { creditsUsed = R.videoCredits(seconds); await consumeCredits(ctx.accountId, creditsUsed, "video", "content_item", ctx.itemId); }
    let mp4: Buffer | null = null;
    try { mp4 = (await R.talkingHead({ script: copy.script, audio, characterImageUrl: ctx.character?.referenceImages[0] ?? null, voiceId: ctx.character?.voiceId ?? null, characterId: ctx.character?.id ?? null })).mp4; }
    catch (e) { if (creditsUsed) await refundCredits(ctx.accountId, creditsUsed, "content_item", ctx.itemId); throw e; }
    if (!mp4) { const charImg = await fetchBuf(ctx.character?.referenceImages[0]); const frame = await R.renderCaptionFrame(copy.hook, brand, ctx.character ? `${ctx.character.name} · AI UGC (preview render)` : "AI UGC (preview render)", charImg ?? ctx.screenshot, ctx.overlayStyle); mp4 = (await R.framesToVideo([{ png: frame, seconds }], audio)).mp4; }
    const fin = await R.finalizeVideo(mp4, R.scriptToSrt(copy.script, seconds * 1000)); await storeVideo(fin.mp4, fin.durationMs);
  } else if (ctx.format === "human_image") {
    if (!ctx.image) throw new Error("No licensed UGC image available for this item");
    // Already stored in our own bucket by the bulk-ingest pipeline -- no transform needed, just reference it.
    media.image_keys = [ctx.image.storageKey]; media.thumbnail_key = ctx.image.thumbnailKey ?? ctx.image.storageKey;
    if (ctx.image.width) media.width = ctx.image.width; if (ctx.image.height) media.height = ctx.image.height;
  } else { throw new Error(`Cannot render format ${ctx.format}`); }
  return { media, creditsUsed };
}
