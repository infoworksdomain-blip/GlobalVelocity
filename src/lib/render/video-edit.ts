import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import OpenAI, { toFile } from "openai";
import type { VideoEditRecipe } from "@/lib/video-edit-options";

const exec = promisify(execFile);
const preset = () => (process.env.PROVIDER_MODE === "live" ? "veryfast" : "ultrafast");

/** Trim + crop + brightness/contrast/saturation in a single ffmpeg pass (one re-encode, not one per
 *  sub-op) -- same temp-dir/exec pattern as finalizeVideo/framesToVideo in src/lib/render/index.ts, and
 *  the same encode settings (libx264/aac/+faststart/preset()) for consistency with the rest of the app. */
export async function trimAndAdjustVideo(mp4: Buffer, recipe: VideoEditRecipe): Promise<{ mp4: Buffer; durationMs: number }> {
  const dir = await mkdtemp(join(tmpdir(), "vel-"));
  try {
    const inp = join(dir, "in.mp4"), out = join(dir, "out.mp4"); await writeFile(inp, mp4);
    const args = ["-y"];
    if (recipe.trim) args.push("-ss", String(recipe.trim.startMs / 1000));
    args.push("-i", inp);
    if (recipe.trim) args.push("-t", String((recipe.trim.endMs - recipe.trim.startMs) / 1000));
    const filters: string[] = [];
    if (recipe.crop) filters.push(`crop=${Math.round(recipe.crop.width)}:${Math.round(recipe.crop.height)}:${Math.round(recipe.crop.x)}:${Math.round(recipe.crop.y)}`);
    if (recipe.adjust) {
      // ffmpeg's eq filter: brightness is additive (-1..1, 0=no change) unlike this app's multiplicative
      // 1=no-change convention (matching sharp/CSS elsewhere) -- contrast/saturation already match (1=no change).
      const { brightness, contrast, saturation } = recipe.adjust;
      filters.push(`eq=brightness=${(brightness - 1).toFixed(3)}:contrast=${contrast.toFixed(3)}:saturation=${saturation.toFixed(3)}`);
    }
    if (filters.length) args.push("-vf", filters.join(","));
    args.push("-r", "30", "-c:v", "libx264", "-preset", preset(), "-crf", "23", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out);
    await exec("ffmpeg", args, { maxBuffer: 1 << 26 });
    const { stdout } = await exec("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out]);
    return { mp4: await readFile(out), durationMs: Math.round(parseFloat(stdout) * 1000) };
  } finally { await rm(dir, { recursive: true, force: true }); }
}

let openaiClient: OpenAI | null = null;
const openai = () => (openaiClient ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
const live = () => process.env.PROVIDER_MODE === "live" && !!process.env.OPENAI_API_KEY;

/** Transcribe a video's audio track to SRT via OpenAI Whisper -- reuses the same OPENAI_API_KEY already
 *  configured for copy generation (src/lib/llm.ts), no new secret. Real transcript timing, unlike the
 *  existing scriptToSrt()'s naive word-count guess (which also requires a known script -- this doesn't). */
export async function transcribeToSrt(mp4: Buffer): Promise<string> {
  if (live()) {
    const file = await toFile(mp4, "video.mp4", { type: "video/mp4" });
    const srt = await openai().audio.transcriptions.create({ file, model: "whisper-1", response_format: "srt" });
    return String(srt);
  }
  // mock: deterministic single-cue placeholder -- visibly "did something" in dev/QA, not a silent no-op
  return "1\n00:00:00,000 --> 00:00:03,000\n[mock transcription -- configure OPENAI_API_KEY and PROVIDER_MODE=live for real captions]\n";
}
