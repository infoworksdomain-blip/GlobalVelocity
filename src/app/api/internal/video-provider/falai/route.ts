import { NextResponse } from "next/server";
import { putObject, publicUrl } from "@/lib/storage";

const FAL_MODEL = process.env.FALAI_VIDEO_MODEL || "fal-ai/kling-video/ai-avatar/v2/standard";
const FAL_QUEUE = `https://queue.fal.run/${FAL_MODEL}`;
const POLL_INTERVAL_MS = 8000;
// Empirically verified live: Kling AI Avatar v2 renders take several minutes, well past HeyGen's
// typical 1-3 minutes -- give this real headroom rather than reusing HeyGen's shorter budget.
const POLL_TIMEOUT_MS = 720_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Adapter satisfying the generic TalkingHeadProvider contract (src/lib/render/index.ts) via fal.ai's
 * Kling AI Avatar model: a photo + an audio file -> a talking-avatar video, the direct fal.ai equivalent
 * of HeyGen's talking-photo feature. fal.ai's queue API is submit -> poll status_url -> fetch response_url,
 * mirroring the same shape the HeyGen adapter already implements.
 *
 * Point VIDEO_PROVIDER_URL at this route and VIDEO_PROVIDER_KEY at the fal.ai key (the same key already
 * used for IMAGE_PROVIDER_KEY works here too) -- the same value is reused below as fal's own API key.
 *
 * Unlike HeyGen, fal.ai wants fetchable URLs, not base64: our audio is uploaded to R2 the same way the
 * HeyGen route already does; the character photo is uploaded too if it's a data: URL, otherwise passed
 * straight through (it's already resolved to a public URL by the worker before this is called).
 */
export async function POST(req: Request) {
  const key = process.env.VIDEO_PROVIDER_KEY;
  if (!key) return NextResponse.json({ error: "VIDEO_PROVIDER_KEY not configured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${key}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { character_image_url, audio_base64 } = (await req.json()) as {
    script?: string; character_image_url?: string | null; character_id?: string | null; voice_id?: string | null; audio_base64?: string | null; aspect?: string;
  };
  if (!character_image_url) return NextResponse.json({ error: "character_image_url required" }, { status: 400 });
  if (!audio_base64) return NextResponse.json({ error: "audio_base64 required -- fal.ai avatar video needs pre-rendered audio" }, { status: 400 });

  try {
    // 1. fal.ai needs a fetchable image URL -- upload data: URLs to R2, pass http(s) URLs straight through.
    let imageUrl = character_image_url;
    if (character_image_url.startsWith("data:")) {
      const m = character_image_url.match(/^data:([^;]+);base64,(.+)$/);
      if (!m) throw new Error("unsupported data URL for character_image_url");
      const imgKey = `falai/${Date.now()}-photo.${m[1].split("/")[1] || "jpg"}`;
      await putObject(imgKey, Buffer.from(m[2], "base64"), m[1]);
      const uploaded = publicUrl(imgKey);
      if (!uploaded) throw new Error("could not produce a public URL for the uploaded photo (check STORAGE_DRIVER/S3_PUBLIC_URL)");
      imageUrl = uploaded;
    }

    // 2. Upload our TTS audio to R2 so fal.ai can fetch it by URL
    const audioBuf = Buffer.from(audio_base64, "base64");
    const audioKey = `falai/${Date.now()}-audio.mp3`;
    await putObject(audioKey, audioBuf, "audio/mpeg");
    const audioUrl = publicUrl(audioKey);
    if (!audioUrl) throw new Error("could not produce a public URL for the uploaded audio (check STORAGE_DRIVER/S3_PUBLIC_URL)");

    // 3. Submit the job to fal.ai's queue
    const submitRes = await fetch(FAL_QUEUE, {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl, audio_url: audioUrl, prompt: "." }),
    });
    if (!submitRes.ok) throw new Error(`fal.ai submit failed ${submitRes.status}: ${await submitRes.text()}`);
    const submitJson = (await submitRes.json()) as { request_id?: string; status_url?: string; response_url?: string };
    const { request_id, status_url, response_url } = submitJson;
    if (!request_id || !status_url || !response_url) throw new Error(`fal.ai submit returned an unexpected shape: ${JSON.stringify(submitJson)}`);

    // 4. Poll until the render completes
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let completed = false;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      const statusRes = await fetch(status_url, { headers: { Authorization: `Key ${key}` } });
      if (!statusRes.ok) continue;
      const statusJson = (await statusRes.json()) as { status?: string };
      if (statusJson.status === "COMPLETED") { completed = true; break; }
      if (statusJson.status === "ERROR" || statusJson.status === "FAILED") throw new Error(`fal.ai render failed: ${JSON.stringify(statusJson)}`);
    }
    if (!completed) throw new Error(`fal.ai render did not complete within ${POLL_TIMEOUT_MS / 1000}s (request_id ${request_id})`);

    // 5. Fetch the final result
    const resultRes = await fetch(response_url, { headers: { Authorization: `Key ${key}` } });
    if (!resultRes.ok) throw new Error(`fal.ai result fetch failed ${resultRes.status}: ${await resultRes.text()}`);
    const resultJson = (await resultRes.json()) as { video?: { url?: string } };
    const videoUrl = resultJson.video?.url;
    if (!videoUrl) throw new Error(`fal.ai result returned no video url: ${JSON.stringify(resultJson)}`);

    return NextResponse.json({ video_url: videoUrl, job_id: request_id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 800;
