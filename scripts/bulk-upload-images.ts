/**
 * Bulk-uploads a local folder of UGC images into the library, organized by niche.
 * Sibling of scripts/bulk-upload-clips.ts -- identical structure, image extensions instead of video,
 * no licence-type field (images don't have the audio-rights distinction video clips do).
 *
 * Point it at a directory laid out one subfolder per niche:
 *   library/
 *     fitness/photo1.jpg  photo2.png  ...
 *     real-estate/photo1.webp ...
 * Each top-level subfolder name becomes that batch's `category` -- the SAME field GhostMode's
 * niche-matcher and Automations' UGC library filter read for video clips, so images and videos in
 * the same category are treated as one niche. Flat directories work too -- pass --category to apply
 * one category to every file instead.
 *
 * Auth: same as bulk-upload-clips.ts -- requires a real platform-admin session cookie (API keys are
 * never platform-admin in this app), not an API key.
 *
 * Usage:
 *   APP_URL="https://globalvelocity.onrender.com" \
 *   SESSION_COOKIE="__Secure-authjs.session-token=..." \
 *   npx tsx scripts/bulk-upload-images.ts ./library [--category=fitness] [--tier=growth] [--concurrency=6]
 *
 * Resumable: successfully-uploaded local file paths are recorded in <dir>/.bulk-upload-images-progress.json.
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, relative, extname, basename } from "path";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const COOKIE = process.env.SESSION_COOKIE ?? "";
const IMAGE_EXTS: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const CHUNK_SIZE = 20;

type Args = { dir: string; category?: string; styleTags: string[]; setting?: string; gender?: string; tier: string; concurrency: number };
function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const dir = argv.find((a) => !a.startsWith("--"));
  if (!dir) throw new Error("Usage: tsx scripts/bulk-upload-images.ts <dir> [--category=x] [--style-tags=a,b] [--setting=x] [--gender=male|female] [--tier=free|starter|growth|pro] [--concurrency=N]");
  const flag = (name: string, def?: string) => argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? def;
  return {
    dir, category: flag("category"), styleTags: (flag("style-tags", "") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    setting: flag("setting"), gender: flag("gender"), tier: flag("tier", "growth")!, concurrency: Number(flag("concurrency", "6")),
  };
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (IMAGE_EXTS[extname(entry).toLowerCase()]) out.push(full);
  }
  return out;
}

async function api<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}/api/v1${path}`, { method: "POST", headers: { "content-type": "application/json", cookie: COOKIE }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${JSON.stringify(json)}`);
  return json as T;
}
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) { lastErr = e; if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  throw lastErr;
}

async function uploadChunk(files: string[], root: string, args: Args, progress: Set<string>, progressPath: string, batchIds: Map<string, string>) {
  const category = args.category ?? relative(root, files[0]).split(/[/\\]/)[0] ?? "uncategorized";
  const items = files.map((f) => ({ path: f, filename: basename(f), content_type: IMAGE_EXTS[extname(f).toLowerCase()] }));

  const { uploads } = await withRetry(() => api<{ uploads: { key: string; upload_url: string }[] }>("/admin/ugc-images/batch-presign", {
    files: items.map((i) => ({ filename: i.filename, content_type: i.content_type })),
  }));

  const uploaded: { path: string; key: string }[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i]; const up = uploads[i];
    try {
      await withRetry(async () => {
        const buf = readFileSync(item.path);
        const r = await fetch(up.upload_url, { method: "PUT", headers: { "content-type": item.content_type }, body: buf });
        if (!r.ok) throw new Error(`PUT ${up.key} -> ${r.status}`);
      });
      uploaded.push({ path: item.path, key: up.key });
    } catch (e) { console.error(`  ✗ upload failed: ${item.path}:`, e instanceof Error ? e.message : e); }
  }
  if (uploaded.length === 0) return;

  const batchId = batchIds.get(category);
  const { batch_id } = await withRetry(() => api<{ batch_id: string; registered: number }>("/admin/ugc-images/batch-register", {
    batch_id: batchId,
    images: uploaded.map((u) => ({ storage_key: u.key, category, style_tags: args.styleTags, setting: args.setting, gender: args.gender, tier: args.tier })),
  }));
  batchIds.set(category, batch_id);

  for (const u of uploaded) progress.add(u.path);
  writeFileSync(progressPath, JSON.stringify([...progress]));
  console.log(`  ✓ [${category}] ${uploaded.length}/${files.length} registered (batch ${batch_id})`);
}

async function main() {
  const args = parseArgs();
  if (!COOKIE) throw new Error("SESSION_COOKIE env var required -- see the header comment in this script for how to get one.");
  const progressPath = join(args.dir, ".bulk-upload-images-progress.json");
  const progress = new Set<string>(existsSync(progressPath) ? (JSON.parse(readFileSync(progressPath, "utf8")) as string[]) : []);

  const all = walk(args.dir);
  const pending = all.filter((f) => !progress.has(f));
  console.log(`Found ${all.length} image files (${all.length - pending.length} already uploaded, ${pending.length} to go).`);
  if (pending.length === 0) return;

  const byCategory = new Map<string, string[]>();
  for (const f of pending) {
    const cat = args.category ?? relative(args.dir, f).split(/[/\\]/)[0] ?? "uncategorized";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(f);
  }
  const chunks: string[][] = [];
  for (const files of byCategory.values()) for (let i = 0; i < files.length; i += CHUNK_SIZE) chunks.push(files.slice(i, i + CHUNK_SIZE));

  const batchIds = new Map<string, string>();
  let done = 0;
  const queue = [...chunks];
  async function worker() {
    while (queue.length) {
      const chunk = queue.shift(); if (!chunk) break;
      await uploadChunk(chunk, args.dir, args, progress, progressPath, batchIds);
      done++; console.log(`Progress: ${done}/${chunks.length} chunks`);
    }
  }
  await Promise.all(Array.from({ length: args.concurrency }, worker));
  console.log(`Done. ${progress.size}/${all.length} files uploaded total.`);
}
main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
