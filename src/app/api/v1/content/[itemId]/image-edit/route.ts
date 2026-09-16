import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireWorkspace } from "@/lib/tenancy";
import { err } from "@/lib/errors";
import { serializeItem, snapshotVersion } from "@/lib/content";
import { publicUrl } from "@/lib/storage";
import { fetchBuf } from "@/lib/render/pipeline";
import { applyImageEditRecipe } from "@/lib/render/image-edit";
import { store } from "@/lib/render";
import sharp from "sharp";
import { z } from "zod";

const recipeSchema = z.object({
  crop: z.object({ x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive() }).optional(),
  rotate: z.number().optional(),
  adjust: z.object({ brightness: z.number().min(0.1).max(3), contrast: z.number().min(0.1).max(3), saturation: z.number().min(0).max(3) }).optional(),
  filterPreset: z.enum(["original", "vivid", "bw", "vintage", "warm", "cool", "fade", "high_contrast"]).optional(),
  textOverlays: z.array(z.object({ text: z.string().max(200), xPct: z.number().min(0).max(100), yPct: z.number().min(0).max(100), fontSizePx: z.number().min(12).max(300), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), bold: z.boolean().optional(), fontFamily: z.string().max(80).optional() })).max(5).optional(),
  resize: z.object({ width: z.number().positive(), height: z.number().positive() }).optional(),
});

/** Local, CPU-only edits (crop/rotate/adjust/filter/text) -- always synchronous, no queue (see plan). */
export const POST = route(async ({ actor, params, body }) => {
  const item = await db.query.contentItems.findFirst({ where: eq(schema.contentItems.id, params.itemId) });
  if (!item || item.deletedAt) throw err(404, "CONTENT_NOT_FOUND", "Content not found");
  await requireWorkspace(actor, item.workspaceId, "editor");
  const recipe = parse(recipeSchema, body);
  const srcKey = item.media.image_keys?.[0]; if (!srcKey) throw err(409, "NO_IMAGE", "This item has no image to edit");
  const srcBuf = await fetchBuf(publicUrl(srcKey)); if (!srcBuf) throw err(409, "MEDIA_NOT_READY", "Source image not readable");

  const outBuf = await applyImageEditRecipe(srcBuf, recipe);
  const meta = await sharp(outBuf).metadata();
  const outKey = await store(`ws/${item.workspaceId}/content/${item.id}/edit-${Date.now()}.png`, outBuf, "image/png");

  await snapshotVersion(item, actor.userId);
  const wasThumbnail = item.media.thumbnail_key === srcKey;
  const [updated] = await db.update(schema.contentItems).set({
    media: { ...item.media, image_keys: [outKey], thumbnail_key: wasThumbnail ? outKey : item.media.thumbnail_key, width: meta.width ?? item.media.width, height: meta.height ?? item.media.height },
    provenance: { ...item.provenance, image_edits: [...((item.provenance as { image_edits?: unknown[] }).image_edits ?? []), { edited_at: new Date().toISOString(), recipe }] },
    updatedAt: new Date(),
  }).where(eq(schema.contentItems.id, item.id)).returning();
  return { item: serializeItem(updated) };
});
