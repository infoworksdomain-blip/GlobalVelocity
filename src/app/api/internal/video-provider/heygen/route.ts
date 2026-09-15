import { NextResponse } from "next/server";
import { putObject, publicUrl } from "@/lib/storage";

const HEYGEN_API = "https://api.heygen.com";
const HEYGEN_UPLOAD = "https://upload.heygen.com";
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 210_000; // HeyGen renders typically finish in 1-3 minutes

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Adapter satisfying the generic TalkingHeadProvider contract (src/lib/render/index.ts) by translating
 * it into HeyGen's real, asynchronous API: upload the reference photo as a talking photo, submit a
 * video job against our own pre-rendered audio (uploaded to R2 so HeyGen can fetch it by URL), then
 * poll until the render finishes.
 *
 * Point VIDEO_PROVIDER_URL at this route and VIDEO_PROVIDER_KEY at the HeyGen API key — the same value
 * is reused below as HeyGen's own X-Api-Key, so only one secret is needed.
 *
 * Note: seed/demo characters use synthetic SVG placeholder portraits (see src/db/seed.ts), not real
 * photos — HeyGen's talking-photo model needs an actual face photo to produce a meaningful result.
 */
export async function POST(req: Request) {
  const key = process.env.VIDEO_PROVIDER_KEY;
  if (!key) return NextResponse.json({ error: "VIDEO_PROVIDER_KEY not configured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${key}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { character_image_url, audio_base64, aspect } = (await req.json()) as {
    script?: string; character_image_url?: string | null; voice_id?: string | null; audio_base64?: string | null; aspect?: string;
  };
  if (!character_image_url) return NextResponse.json({ error: "character_image_url required" }, { status: 400 });
  if (!audio_base64) return NextResponse.json({ error: "audio_base64 required — HeyGen audio-driven video needs pre-rendered audio" }, { status: 400 });

  try {
    // 1. Fetch the reference photo (data: URL or http(s) URL) and upload it to HeyGen as an asset
    let imgBuf: Buffer; let imgType: string;
    if (character_image_url.startsWith("data:")) {
      const m = character_image_url.match(/^data:([^;]+);base64,(.+)$/);
      if (!m) throw new Error("unsupported data URL for character_image_url");
      imgType = m[1]; imgBuf = Buffer.from(m[2], "base64");
    } else {
      const r = await fetch(character_image_url);
      if (!r.ok) throw new Error(`could not fetch character_image_url (${r.status})`);
      imgType = r.headers.get("content-type") || "image/jpeg"; imgBuf = Buffer.from(await r.arrayBuffer());
    }
    // HeyGen's talking-photo upload endpoint creates the talking photo directly from the raw image
    // bytes in one call -- there is no separate generic-asset-upload + registration step.
    const tpRes = await fetch(`${HEYGEN_UPLOAD}/v1/talking_photo`, { method: "POST", headers: { "x-api-key": key, "content-type": imgType }, body: new Uint8Array(imgBuf) });
    if (!tpRes.ok) throw new Error(`heygen talking_photo upload failed ${tpRes.status}: ${await tpRes.text()}`);
    const tpJson = (await tpRes.json()) as { data?: { talking_photo_id?: string } };
    const talkingPhotoId = tpJson.data?.talking_photo_id;
    if (!talkingPhotoId) throw new Error(`heygen talking_photo upload returned no id: ${JSON.stringify(tpJson)}`);

    // 3. Upload our TTS audio to R2 so HeyGen can fetch it by URL
    const audioBuf = Buffer.from(audio_base64, "base64");
    const audioKey = `heygen/${talkingPhotoId}-${Date.now()}.mp3`;
    await putObject(audioKey, audioBuf, "audio/mpeg");
    const audioUrl = publicUrl(audioKey);
    if (!audioUrl) throw new Error("could not produce a public URL for the uploaded audio (check STORAGE_DRIVER/S3_PUBLIC_URL)");

    // 4. Submit the video generation job
    const [width, height] = aspect === "16:9" ? [1280, 720] : aspect === "1:1" ? [1080, 1080] : [720, 1280];
    const genRes = await fetch(`${HEYGEN_API}/v2/video/generate`, {
      method: "POST",
      headers: { "x-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({ video_inputs: [{ character: { type: "talking_photo", talking_photo_id: talkingPhotoId }, voice: { type: "audio", audio_url: audioUrl } }], dimension: { width, height } }),
    });
    if (!genRes.ok) throw new Error(`heygen video/generate failed ${genRes.status}: ${await genRes.text()}`);
    const genJson = (await genRes.json()) as { data?: { video_id?: string } };
    const videoId = genJson.data?.video_id;
    if (!videoId) throw new Error(`heygen video/generate returned no video_id: ${JSON.stringify(genJson)}`);

    // 5. Poll until the render completes
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let videoUrl: string | undefined;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      const statusRes = await fetch(`${HEYGEN_API}/v1/video_status.get?video_id=${videoId}`, { headers: { "x-api-key": key } });
      if (!statusRes.ok) continue;
      const statusJson = (await statusRes.json()) as { data?: { status?: string; video_url?: string; error?: unknown } };
      const status = statusJson.data?.status;
      if (status === "completed") { videoUrl = statusJson.data?.video_url; break; }
      if (status === "failed") throw new Error(`heygen render failed: ${JSON.stringify(statusJson.data?.error)}`);
    }
    if (!videoUrl) throw new Error(`heygen render did not complete within ${POLL_TIMEOUT_MS / 1000}s (video_id ${videoId})`);

    return NextResponse.json({ video_url: videoUrl, job_id: videoId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 240;
