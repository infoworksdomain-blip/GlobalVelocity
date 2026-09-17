import sharp from "sharp";
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { fetch as undiciFetch, Agent } from "undici";
import { putObject } from "@/lib/storage";
import { CREDIT_TARIFF } from "@/lib/plans";
import type { OverlayStyle } from "@/db/schema";

// Node's built-in fetch (undici) defaults headersTimeout/bodyTimeout to 5 minutes -- too short for
// talking-head video providers whose renders routinely take longer (fal.ai's Kling Avatar model, e.g.,
// measured at ~5 minutes for a 17s clip). A custom Agent can't be passed to Node's *global* fetch here:
// Node bundles its own internal undici version, and a dispatcher built from the separately-installed
// undici package (a different version) fails with "invalid onRequestStart method" (verified live). So
// this call uses undici's own fetch + Agent together (self-consistent, same package instance) instead of
// the global fetch -- only the video-provider call is affected; every other fetch in the app is unchanged.
const longRenderDispatcher = new Agent({ headersTimeout: 900_000, bodyTimeout: 900_000 });

const exec = promisify(execFile);
export const W = 1080, H = 1920;

/** Full SVG-safe escape -- required for any value placed inside a quoted attribute, not just element content. */
export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** Greedy word-wrap for SVG text. */
export function wrap(text: string, maxChars: number) {
  const words = text.split(/\s+/); const lines: string[] = []; let cur = "";
  for (const w of words) { if ((cur + " " + w).trim().length > maxChars) { if (cur) lines.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }
  if (cur) lines.push(cur); return lines;
}
export function textBlock(lines: string[], x: number, y: number, size: number, opts: { weight?: number; fill?: string; anchor?: string; lineHeight?: number; stroke?: boolean; fontFamily?: string } = {}) {
  const lh = opts.lineHeight ?? size * 1.15;
  return lines.map((l, i) => `<text x="${x}" y="${y + i * lh}" font-family="${esc(opts.fontFamily ?? "DejaVu Sans, Arial, sans-serif")}" font-size="${size}" font-weight="${opts.weight ?? 800}" fill="${opts.fill ?? "#fff"}" text-anchor="${opts.anchor ?? "middle"}" ${opts.stroke ? 'stroke="#000" stroke-width="10" paint-order="stroke"' : ""}>${esc(l)}</text>`).join("");
}

export type Brand = { primary: string; secondary: string; name: string };

/** Resolved, always-present overlay style -- callers never see undefined fields. Defaults reproduce the
 *  look every caption/overlay had before per-item styling existed (non-negotiable: passing no style must
 *  render pixel-identically to the old hardcoded values). */
export type ResolvedOverlayStyle = { fontFamily: string; fontSizePx: number; weight: number; color: string; position: "top" | "center" | "bottom" };
export function resolveOverlayStyle(style: OverlayStyle | null | undefined): ResolvedOverlayStyle {
  return {
    fontFamily: style?.font_family || "DejaVu Sans, Arial, sans-serif",
    fontSizePx: style?.font_size_px ?? 88,
    weight: style?.bold === false ? 500 : 800,
    color: style?.color || "#ffffff",
    position: style?.position ?? "center",
  };
}

/** Slide image: gradient background, big title, body, footer brand chip, optional screenshot. */
export async function renderSlide(i: number, total: number, title: string, body: string, brand: Brand, screenshot?: Buffer | null): Promise<Buffer> {
  const tl = wrap(title, 18), bl = wrap(body, 34);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${brand.primary}"/><stop offset="1" stop-color="${brand.secondary}"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <text x="80" y="140" font-family="DejaVu Sans, Arial" font-size="40" fill="#ffffffaa" font-weight="600">${i + 1} / ${total}</text>
    ${textBlock(tl, W / 2, 560, 96, { lineHeight: 112 })}
    ${textBlock(bl, W / 2, 560 + tl.length * 112 + 60, 48, { weight: 500, fill: "#ffffffdd", lineHeight: 64 })}
    <rect x="${W / 2 - 220}" y="${H - 200}" width="440" height="88" rx="44" fill="#ffffff22"/>
    <text x="${W / 2}" y="${H - 142}" font-family="DejaVu Sans, Arial" font-size="38" fill="#fff" text-anchor="middle" font-weight="700">${esc(brand.name)}</text>
  </svg>`;
  let img = sharp(Buffer.from(svg)).png();
  if (screenshot) {
    const shot = await sharp(screenshot).resize({ width: 760, height: 640, fit: "inside" }).png().toBuffer();
    const m = await sharp(shot).metadata();
    img = sharp(await img.toBuffer()).composite([{ input: shot, left: Math.round((W - (m.width ?? 760)) / 2), top: H - 900 }]).png();
  }
  return img.toBuffer();
}

export async function renderMeme(top: string, bottom: string, brand: Brand, base?: Buffer | null): Promise<Buffer> {
  const bg = base ? await sharp(base).resize(W, W, { fit: "cover" }).png().toBuffer() : await sharp({ create: { width: W, height: W, channels: 4, background: brand.secondary } }).png().toBuffer();
  const t = wrap(top.toUpperCase(), 22), b = wrap(bottom.toUpperCase(), 22);
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}">${textBlock(t, W / 2, 110, 76, { stroke: true, lineHeight: 88 })}${textBlock(b, W / 2, W - 60 - (b.length - 1) * 88, 76, { stroke: true, lineHeight: 88 })}</svg>`;
  const square = await sharp(bg).composite([{ input: Buffer.from(overlay) }]).png().toBuffer();
  const canvas = await sharp({ create: { width: W, height: H, channels: 4, background: "#0b0b0f" } }).composite([{ input: square, top: (H - W) / 2, left: 0 }]).png().toBuffer();
  return canvas;
}

const overlayY0 = (position: ResolvedOverlayStyle["position"], boxHeight: number) => position === "top" ? 60 + boxHeight / 2 : position === "bottom" ? H - 60 - boxHeight / 2 : H / 2;

/** Caption card used for hook+demo videos and as the visual bed under UGC audio when no talking-head provider is configured. */
export async function renderCaptionFrame(line: string, brand: Brand, sub?: string, bg?: Buffer | null, style?: OverlayStyle | null): Promise<Buffer> {
  const s = resolveOverlayStyle(style);
  const scale = s.fontSizePx / 88; // pill must scale with font size, same reasoning as captionOverlay() in pipeline.ts
  const ls = wrap(line, 20);
  const lineH = 112 * scale, padding = 120 * scale;
  const boxHeight = ls.length * lineH + padding;
  const centerY = overlayY0(s.position, boxHeight);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="${bg ? "#00000066" : esc(brand.secondary)}"/>
    <rect x="60" y="${centerY - boxHeight / 2}" width="${W - 120}" height="${boxHeight}" rx="36" fill="#000000aa"/>
    ${textBlock(ls, W / 2, centerY + 20 * scale - (ls.length - 1) * (lineH / 2), s.fontSizePx, { lineHeight: lineH, fill: s.color, weight: s.weight, fontFamily: s.fontFamily })}
    ${sub ? `<text x="${W / 2}" y="${H - 220}" font-family="DejaVu Sans, Arial" font-size="42" fill="#ffffffcc" text-anchor="middle">${esc(sub)}</text>` : ""}
  </svg>`;
  if (bg) return sharp(await sharp(bg).resize(W, H, { fit: "cover" }).png().toBuffer()).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Plain full-bleed text card for "wall of text" -- deliberately undecorated (no pill box, no logo chip)
 *  so it reads as a distinct visual style from renderCaptionFrame's branded treatment, even though both
 *  feed the same framesToVideo() stitching mechanism. */
export async function renderTextWallFrame(text: string, style?: OverlayStyle | null): Promise<Buffer> {
  const s = resolveOverlayStyle(style);
  const fontSize = style?.font_size_px ?? 104; // noticeably larger than the 88px default -- this format IS the text
  const scale = fontSize / 88;
  const lines = wrap(text, 16);
  const lineH = 128 * scale;
  const totalH = lines.length * lineH;
  const y0 = H / 2 - totalH / 2 + lineH * 0.7;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="#0b0b0f"/>
    ${textBlock(lines, W / 2, y0, fontSize, { lineHeight: lineH, fill: s.color, weight: s.weight, fontFamily: s.fontFamily })}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Picture-in-picture composite for "green screen": scales a background image to fill the frame, overlays
 *  a smaller inset of the (full-frame) avatar video near the bottom. The TalkingHeadProvider contract has
 *  no background-control parameter (confirmed: it always returns a full-frame avatar video), so this is an
 *  honest PiP approximation of the TikTok green-screen effect, not a true chroma-key. */
export async function compositeAvatarOverBackground(avatarMp4: Buffer, background: Buffer, seconds: number): Promise<{ mp4: Buffer; durationMs: number }> {
  const dir = await mkdtemp(join(tmpdir(), "vel-"));
  try {
    const bgPath = join(dir, "bg.png"), avatarPath = join(dir, "avatar.mp4"), out = join(dir, "out.mp4");
    await writeFile(bgPath, await sharp(background).resize(W, H, { fit: "cover" }).png().toBuffer());
    await writeFile(avatarPath, avatarMp4);
    const args = ["-y", "-loop", "1", "-i", bgPath, "-i", avatarPath, "-filter_complex", "[1:v]scale=760:-1[pip];[0:v][pip]overlay=(W-w)/2:H-h-60", "-map", "0:v", "-map", "1:a?", "-t", String(seconds), "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-movflags", "+faststart", out];
    await exec("ffmpeg", args, { maxBuffer: 1 << 26 });
    return { mp4: await readFile(out), durationMs: Math.round(seconds * 1000) };
  } finally { await rm(dir, { recursive: true, force: true }); }
}

/** Stitch frames into a 1080x1920 H.264 MP4, each frame shown for `seconds`, with optional audio track. Returns MP4 buffer + duration ms. */
export async function framesToVideo(frames: { png: Buffer; seconds: number }[], audio?: Buffer | null): Promise<{ mp4: Buffer; durationMs: number }> {
  const dir = await mkdtemp(join(tmpdir(), "vel-"));
  try {
    const list: string[] = [];
    for (let i = 0; i < frames.length; i++) { const f = join(dir, `f${i}.png`); await writeFile(f, frames[i].png); list.push(`file '${f}'`, `duration ${frames[i].seconds}`); }
    list.push(`file '${join(dir, `f${frames.length - 1}.png`)}'`);
    await writeFile(join(dir, "list.txt"), list.join("\n"));
    const out = join(dir, "out.mp4"); const args = ["-y", "-f", "concat", "-safe", "0", "-i", join(dir, "list.txt")];
    if (audio) { await writeFile(join(dir, "a.mp3"), audio); args.push("-i", join(dir, "a.mp3"), "-shortest", "-c:a", "aac", "-b:a", "128k"); }
    args.push("-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,format=yuv420p", "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-movflags", "+faststart", out);
    await exec("ffmpeg", args, { maxBuffer: 1 << 26 });
    const mp4 = await readFile(out);
    const durationMs = Math.round(frames.reduce((a, f) => a + f.seconds, 0) * 1000);
    return { mp4, durationMs };
  } finally { await rm(dir, { recursive: true, force: true }); }
}

/** Burn captions (SRT) into an existing MP4 and normalise to 9:16, loudness -14 LUFS. */
export async function finalizeVideo(mp4: Buffer, srt?: string): Promise<{ mp4: Buffer; durationMs: number }> {
  const dir = await mkdtemp(join(tmpdir(), "vel-"));
  try {
    const inp = join(dir, "in.mp4"), out = join(dir, "out.mp4"); await writeFile(inp, mp4);
    const vf = ["scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p"];
    if (srt) { await writeFile(join(dir, "c.srt"), srt); vf.push(`subtitles=${join(dir, "c.srt")}:force_style='FontName=DejaVu Sans,FontSize=20,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,MarginV=180'`); }
    await exec("ffmpeg", ["-y", "-i", inp, "-vf", vf.join(","), "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-c:a", "aac", "-movflags", "+faststart", out], { maxBuffer: 1 << 26 });
    const { stdout } = await exec("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out]);
    return { mp4: await readFile(out), durationMs: Math.round(parseFloat(stdout) * 1000) };
  } finally { await rm(dir, { recursive: true, force: true }); }
}

export async function thumbnail(mp4: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "vel-"));
  try { const inp = join(dir, "in.mp4"), out = join(dir, "t.jpg"); await writeFile(inp, mp4); await exec("ffmpeg", ["-y", "-ss", "0.5", "-i", inp, "-frames:v", "1", "-q:v", "3", out]); return readFile(out); }
  finally { await rm(dir, { recursive: true, force: true }); }
}

/** Probe a raw video buffer's duration (ms) without re-encoding -- used to ingest bulk-uploaded UGC clips. */
export async function probeDuration(mp4: Buffer): Promise<number> {
  const dir = await mkdtemp(join(tmpdir(), "vel-"));
  try {
    const inp = join(dir, "in.mp4"); await writeFile(inp, mp4);
    const { stdout } = await exec("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", inp]);
    return Math.round(parseFloat(stdout) * 1000);
  } finally { await rm(dir, { recursive: true, force: true }); }
}

/** Naive SRT from a script: ~3 words per cue spread over the duration (word-level TikTok-style captions). */
export function scriptToSrt(script: string, durationMs: number) {
  const words = script.split(/\s+/).filter(Boolean); const per = 3; const cues = Math.ceil(words.length / per); const slot = durationMs / Math.max(cues, 1);
  const t = (ms: number) => { const d = new Date(ms); return d.toISOString().substring(11, 23).replace(".", ","); };
  return Array.from({ length: cues }, (_, i) => `${i + 1}\n${t(i * slot)} --> ${t((i + 1) * slot - 40)}\n${words.slice(i * per, i * per + per).join(" ")}\n`).join("\n");
}

// ---------------- Talking-head / TTS providers (contract + mock) ----------------
export type TtsProvider = (text: string, voiceId: string | null) => Promise<{ audio: Buffer | null; durationMs: number }>;
export type TalkingHeadProvider = (args: { script: string; audio: Buffer | null; characterImageUrl: string | null; voiceId: string | null; characterId: string | null }) => Promise<{ mp4: Buffer | null; providerJobId?: string }>;

const live = () => process.env.PROVIDER_MODE === "live";

export const tts: TtsProvider = async (text, voiceId) => {
  if (live() && process.env.ELEVENLABS_API_KEY) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId || "21m00Tcm4TlvDq8ikWAM"}`, { method: "POST", headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "content-type": "application/json" }, body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }) });
    if (!r.ok) throw new Error(`TTS failed ${r.status}`);
    const audio = Buffer.from(await r.arrayBuffer());
    return { audio, durationMs: Math.round((text.split(/\s+/).length / 2.6) * 1000) };
  }
  // mock: no audio, duration estimated at ~2.6 words/second
  return { audio: null, durationMs: Math.round((text.split(/\s+/).length / 2.6) * 1000) };
};

/** Generic HTTP contract: POST {script, character_image_url, audio_base64} → {video_url}. Wire HeyGen/Hedra/Sync adapters here. */
export const talkingHead: TalkingHeadProvider = async ({ script, audio, characterImageUrl, voiceId, characterId }) => {
  if (live() && process.env.VIDEO_PROVIDER_URL) {
    const r = await undiciFetch(process.env.VIDEO_PROVIDER_URL, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.VIDEO_PROVIDER_KEY ?? ""}` }, body: JSON.stringify({ script, character_image_url: characterImageUrl, voice_id: voiceId, character_id: characterId, audio_base64: audio?.toString("base64") ?? null, aspect: "9:16" }), dispatcher: longRenderDispatcher });
    if (!r.ok) throw new Error(`Video provider failed ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const j = await r.json() as { video_url: string; job_id?: string };
    const v = await fetch(j.video_url); return { mp4: Buffer.from(await v.arrayBuffer()), providerJobId: j.job_id };
  }
  return { mp4: null };
};

export const videoCredits = (seconds: number) => Math.ceil(seconds) * CREDIT_TARIFF.videoPerSecond;

export async function store(key: string, body: Buffer, mime: string) { await putObject(key, body, mime); return key; }

// ---------------- Image generation provider (AI Studio, M9) ----------------
/** Live: fal.ai FLUX via IMAGE_PROVIDER_URL/KEY (any endpoint accepting {prompt, image_url?, aspect} → {image_url}). Mock: deterministic SVG portrait. */
export async function generateImage(prompt: string, referenceUrl?: string | null): Promise<{ png: Buffer; provider: string }> {
  if (process.env.PROVIDER_MODE === "live" && process.env.IMAGE_PROVIDER_URL) {
    const r = await fetch(process.env.IMAGE_PROVIDER_URL, { method: "POST", headers: { "content-type": "application/json", authorization: `Key ${process.env.IMAGE_PROVIDER_KEY ?? ""}` }, body: JSON.stringify({ prompt, image_url: referenceUrl ?? undefined, image_size: "portrait_16_9", num_images: 1 }) });
    if (!r.ok) throw new Error(`Image provider failed ${r.status}`);
    const j = await r.json() as { images?: { url: string }[]; image_url?: string };
    const url = j.images?.[0]?.url ?? j.image_url; if (!url) throw new Error("Image provider returned no image");
    // fal.ai (and most providers behind this contract) return JPEG, not PNG -- storing those raw bytes
    // under a .png key/content-type produced a format mismatch that rendered as a blank/black image.
    return { png: await sharp(Buffer.from(await (await fetch(url)).arrayBuffer())).png().toBuffer(), provider: "live" };
  }
  let h = 0; for (const c of prompt) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${h % 360},50%,40%)"/><stop offset="1" stop-color="hsl(${(h + 60) % 360},50%,20%)"/></linearGradient></defs><rect width="768" height="1024" fill="url(#g)"/><circle cx="384" cy="380" r="150" fill="#f1d3bc"/><rect x="204" y="540" width="360" height="300" rx="120" fill="#e5e7eb"/><text x="384" y="960" font-size="34" text-anchor="middle" fill="#fff" font-family="sans-serif">synthetic · ${esc(prompt.slice(0, 32))}</text></svg>`;
  return { png: await sharp(Buffer.from(svg)).png().toBuffer(), provider: "mock" };
}
