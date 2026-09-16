import sharp from "sharp";
import { textBlock, wrap, store } from "@/lib/render";
import { publicUrl } from "@/lib/storage";
import { randomToken } from "@/lib/crypto";
import { FILTER_PRESETS, type ImageEditRecipe } from "@/lib/image-filters";

/** Apply crop/rotate/adjust/filter-preset/text-overlay ops to an existing image. Sub-second, CPU-only --
 *  always synchronous, never queued (see plan: fast local sharp ops don't need the job/poll pattern the
 *  AI ops below do). Each stage materializes to a buffer rather than chaining on one pipeline instance,
 *  since sharp's .metadata() reflects the *input*, not pending ops -- chaining risks EXIF-orientation and
 *  crop-coordinate mismatches; the client's crop rect is computed against the already-EXIF-corrected
 *  image the browser displays, so orientation must be baked in before anything else runs. */
export async function applyImageEditRecipe(buf: Buffer, recipe: ImageEditRecipe): Promise<Buffer> {
  let out = await sharp(buf).rotate().toBuffer(); // auto-orient from EXIF first
  if (recipe.crop) out = await sharp(out).extract({ left: Math.round(recipe.crop.x), top: Math.round(recipe.crop.y), width: Math.round(recipe.crop.width), height: Math.round(recipe.crop.height) }).toBuffer();
  if (recipe.rotate) out = await sharp(out).rotate(recipe.rotate).toBuffer();
  if (recipe.resize) out = await sharp(out).resize(recipe.resize.width, recipe.resize.height, { fit: "inside", withoutEnlargement: true }).toBuffer();
  if (recipe.adjust) {
    const { brightness, contrast, saturation } = recipe.adjust;
    // canonical contrast formula centered on mid-grey: output = input*contrast + 128*(1-contrast)
    out = await sharp(out).modulate({ brightness, saturation }).linear(contrast, 128 * (1 - contrast)).toBuffer();
  }
  if (recipe.filterPreset && recipe.filterPreset !== "original") {
    const p = FILTER_PRESETS.find((x) => x.id === recipe.filterPreset);
    if (p) {
      let img = sharp(out);
      if (p.modulate) img = img.modulate(p.modulate);
      if (p.linear) img = img.linear(p.linear[0], p.linear[1]);
      if (p.tint) img = img.tint(p.tint);
      if (p.greyscale) img = img.greyscale();
      out = await img.toBuffer();
    }
  }
  if (recipe.textOverlays?.length) {
    const meta = await sharp(out).metadata(); const W = meta.width ?? 1080, H = meta.height ?? 1920;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${recipe.textOverlays.map((t) => textBlock(wrap(t.text, 30), Math.round((t.xPct / 100) * W), Math.round((t.yPct / 100) * H), t.fontSizePx, { fill: t.color, weight: t.bold === false ? 500 : 800, fontFamily: t.fontFamily, stroke: true })).join("")}</svg>`;
    out = await sharp(out).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
  }
  return sharp(out).png().toBuffer();
}

// ---------------- AI-powered ops (fal.ai queue API, gated + async — see plan for queue placement) ----------------
const FAL_BG_REMOVE_MODEL = process.env.FAL_BG_REMOVE_MODEL || "fal-ai/birefnet";
const FAL_INPAINT_MODEL = process.env.FAL_INPAINT_MODEL || "fal-ai/lama";
const FAL_UPSCALE_MODEL = process.env.FAL_UPSCALE_MODEL || "fal-ai/clarity-upscaler";
const AI_POLL_INTERVAL_MS = 3000;
const AI_POLL_TIMEOUT_MS = 120_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Same PROVIDER_MODE + key gate every other adapter in this app uses; reuses IMAGE_PROVIDER_KEY (same
 *  fal.ai account already configured for Studio image generation) rather than requiring a new secret. */
const live = () => process.env.PROVIDER_MODE === "live" && !!process.env.IMAGE_PROVIDER_KEY;

/** fal.ai queue API: submit -> poll status_url -> fetch response_url. Mirrors the shape already proven in
 *  src/app/api/internal/video-provider/falai/route.ts, called directly (no internal-route indirection --
 *  unlike the video provider, nothing here needs a swappable-provider contract). */
async function falQueueSubmitPollFetch(model: string, input: Record<string, unknown>): Promise<{ image?: { url?: string } }> {
  const key = process.env.IMAGE_PROVIDER_KEY ?? "";
  const submitRes = await fetch(`https://queue.fal.run/${model}`, { method: "POST", headers: { Authorization: `Key ${key}`, "content-type": "application/json" }, body: JSON.stringify(input) });
  if (!submitRes.ok) throw new Error(`fal.ai submit failed ${submitRes.status}: ${(await submitRes.text()).slice(0, 300)}`);
  const { status_url, response_url } = await submitRes.json() as { status_url?: string; response_url?: string };
  if (!status_url || !response_url) throw new Error("fal.ai submit returned an unexpected shape");
  const deadline = Date.now() + AI_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(AI_POLL_INTERVAL_MS);
    const s = await fetch(status_url, { headers: { Authorization: `Key ${key}` } });
    if (!s.ok) continue;
    const j = await s.json() as { status?: string };
    if (j.status === "COMPLETED") { const r = await fetch(response_url, { headers: { Authorization: `Key ${key}` } }); if (!r.ok) throw new Error(`fal.ai result fetch failed ${r.status}: ${(await r.text()).slice(0, 300)}`); return r.json() as Promise<{ image?: { url?: string } }>; }
    if (j.status === "ERROR" || j.status === "FAILED") throw new Error(`fal.ai op failed: ${JSON.stringify(j)}`);
  }
  throw new Error(`fal.ai op did not complete within ${AI_POLL_TIMEOUT_MS / 1000}s`);
}
/** fal.ai needs a fetchable URL, not raw bytes -- stage the buffer in our own bucket first, same pattern
 *  the falai video route uses for its image/audio inputs. */
async function stageForFal(buf: Buffer): Promise<string> {
  const key = `falai/${Date.now()}-${randomToken(6)}.png`;
  await store(key, await sharp(buf).png().toBuffer(), "image/png");
  const url = publicUrl(key); if (!url) throw new Error("could not produce a public URL for the staged image (check STORAGE_DRIVER/S3_PUBLIC_URL)");
  return url;
}

export async function removeBackground(buf: Buffer): Promise<Buffer> {
  if (live()) {
    const j = await falQueueSubmitPollFetch(FAL_BG_REMOVE_MODEL, { image_url: await stageForFal(buf) });
    if (!j.image?.url) throw new Error("fal.ai bg-remove returned no image");
    return sharp(Buffer.from(await (await fetch(j.image.url)).arrayBuffer())).png().toBuffer();
  }
  // mock: deterministic circular alpha cutout -- visibly distinguishable from a no-op in dev/QA
  const meta = await sharp(buf).metadata(); const w = meta.width ?? 512, h = meta.height ?? 512;
  const r = Math.round(Math.min(w, h) * 0.4);
  const mask = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><circle cx="${w / 2}" cy="${h / 2}" r="${r}" fill="#fff"/></svg>`;
  return sharp(buf).ensureAlpha().composite([{ input: Buffer.from(mask), blend: "dest-in" }]).png().toBuffer();
}
export async function inpaint(buf: Buffer, maskBuf: Buffer): Promise<Buffer> {
  if (live()) {
    // The mask is drawn client-side against a fixed-resolution canvas, independent of the source
    // image's actual dimensions (which vary per item and change after prior edits/upscales) -- fal.ai's
    // inpainting model rejects a mask whose dimensions don't match the image (verified live: 422), so
    // always resize the mask to match here rather than trusting the client to send a matching size.
    const meta = await sharp(buf).metadata();
    const resizedMask = await sharp(maskBuf).resize(meta.width, meta.height, { fit: "fill" }).toBuffer();
    const [srcUrl, maskUrl] = await Promise.all([stageForFal(buf), stageForFal(resizedMask)]);
    const j = await falQueueSubmitPollFetch(FAL_INPAINT_MODEL, { image_url: srcUrl, mask_url: maskUrl });
    if (!j.image?.url) throw new Error("fal.ai inpaint returned no image");
    return sharp(Buffer.from(await (await fetch(j.image.url)).arrayBuffer())).png().toBuffer();
  }
  return sharp(buf).png().toBuffer(); // mock: unchanged -- an honest "no-op" signal, no cheap approximation worth building
}
export async function upscaleImage(buf: Buffer): Promise<Buffer> {
  const meta = await sharp(buf).metadata(); const w = meta.width ?? 512, h = meta.height ?? 512;
  if (live()) {
    const j = await falQueueSubmitPollFetch(FAL_UPSCALE_MODEL, { image_url: await stageForFal(buf) });
    if (!j.image?.url) throw new Error("fal.ai upscale returned no image");
    return sharp(Buffer.from(await (await fetch(j.image.url)).arrayBuffer())).png().toBuffer();
  }
  return sharp(buf).resize(w * 2, h * 2, { kernel: "lanczos3" }).png().toBuffer(); // mock: real deterministic 2x upscale, no AI call
}
