import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { requireWorkspace, assertCanSave } from "@/lib/tenancy";
import { presignedUpload, publicUrl } from "@/lib/storage";
import { randomToken } from "@/lib/crypto";
import { serializeItem } from "@/lib/content";
import { z } from "zod";
/** Step 1: presign; Step 2 (PUT) register the uploaded object as a brand asset or a content item (M10 upload). */
export const POST = route(async ({ actor, params, body }) => {
  await requireWorkspace(actor, params.id, "editor");
  const b = parse(z.object({ filename: z.string().max(200), content_type: z.string().max(100), purpose: z.enum(["asset", "content"]).default("content") }), body);
  const ext = b.filename.split(".").pop()?.toLowerCase() ?? "bin";
  const key = `ws/${params.id}/${b.purpose === "asset" ? "assets" : "uploads"}/${randomToken(10)}.${ext}`;
  return { upload_url: await presignedUpload(key, b.content_type), key, public_url: publicUrl(key) };
});
export const PUT = route(async ({ actor, params, body }) => {
  const { ws, plan } = await requireWorkspace(actor, params.id, "editor");
  const b = parse(z.object({ key: z.string(), purpose: z.enum(["asset", "content"]), kind: z.enum(["logo", "screenshot", "demo_video", "image", "other"]).optional(), mime: z.string().optional(), caption: z.string().max(3000).optional(), hook: z.string().max(200).optional() }), body);
  if (b.purpose === "asset") { const [a] = await db.insert(schema.brandAssets).values({ workspaceId: ws.id, kind: b.kind ?? "other", storageKey: b.key, mime: b.mime }).returning(); return { asset: { ...a, url: publicUrl(a.storageKey) } }; }
  await assertCanSave(ws.accountId, plan);
  const isVideo = (b.mime ?? "").startsWith("video/");
  const [item] = await db.insert(schema.contentItems).values({ workspaceId: ws.id, format: "upload", status: "saved", savedAt: new Date(), hook: b.hook ?? "Uploaded media", caption: b.caption ?? "", isAiGenerated: false, media: isVideo ? { video_key: b.key } : { image_keys: [b.key], thumbnail_key: b.key }, provenance: { uploaded_by: actor.userId } }).returning();
  return { item: serializeItem(item) };
});
