import { NextResponse } from "next/server";
import { readFile, mkdir, writeFile } from "fs/promises";
import { dirname, join, normalize } from "path";
import { localDir } from "@/lib/storage";
import { getActorOrNull, requireWorkspace } from "@/lib/tenancy";
/** Local storage driver: serve and accept media files. Only active when STORAGE_DRIVER=local. */
const safe = (parts: string[]) => { const p = normalize(parts.join("/")); if (p.startsWith("..") || p.includes("/../")) throw new Error("bad path"); return p; };
const types: Record<string, string> = { mp4: "video/mp4", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", mov: "video/quicktime", srt: "text/plain", svg: "image/svg+xml" };
export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  try { const key = safe((await ctx.params).key); const buf = await readFile(join(localDir(), key)); const ext = key.split(".").pop()?.toLowerCase() ?? ""; return new Response(buf, { headers: { "content-type": types[ext] ?? "application/octet-stream", "cache-control": "public, max-age=31536000, immutable", "accept-ranges": "bytes" } }); }
  catch { return NextResponse.json({ error: "not found" }, { status: 404 }); }
}
export async function PUT(req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const key = safe((await ctx.params).key); const ws = key.match(/^ws\/([0-9a-f-]{36})\//)?.[1];
  const actor = await getActorOrNull(req); if (!actor || !ws) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { await requireWorkspace(actor, ws, "editor"); } catch { return NextResponse.json({ error: "forbidden" }, { status: 403 }); }
  const f = join(localDir(), key); await mkdir(dirname(f), { recursive: true }); await writeFile(f, Buffer.from(await req.arrayBuffer()));
  return NextResponse.json({ ok: true, key });
}
