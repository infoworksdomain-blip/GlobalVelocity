import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { eq, sql } from "drizzle-orm";
import { err } from "@/lib/errors";
import { audit } from "@/lib/tenancy";
import { enqueue } from "@/lib/queue";
import { z } from "zod";
/**
 * Step 2 of bulk UGC image ingest: register already-uploaded objects as ugc_images rows (insert only)
 * and enqueue async width/height + thumbnail processing per image. Admin only. Mirrors
 * admin/ugc-clips/batch-register exactly, minus the video-only licence_type/has_speech/transcript fields.
 */
const imageSchema = z.object({
  storage_key: z.string().regex(/^library\/ugc-images\/[A-Za-z0-9_-]+\.[A-Za-z0-9]{1,10}$/), category: z.string().max(60).optional(), style_tags: z.array(z.string()).default([]),
  creator_name: z.string().max(80).optional(), gender: z.string().max(20).optional(), setting: z.string().max(40).optional(),
  territories: z.array(z.string()).default(["worldwide"]), licence_expires_at: z.string().datetime().optional(), tier: z.enum(["free", "starter", "growth", "pro"]).default("growth"),
});
export const POST = route(async ({ actor, body }) => {
  if (!actor.isPlatformAdmin) throw err(403, "FORBIDDEN", "Admin only");
  const b = parse(z.object({ batch_id: z.string().uuid().optional(), images: z.array(imageSchema).min(1).max(500) }), body);

  const batch = b.batch_id
    ? await db.query.ugcImageBatches.findFirst({ where: eq(schema.ugcImageBatches.id, b.batch_id) })
    : (await db.insert(schema.ugcImageBatches).values({ createdBy: actor.userId, requestedCount: 0, status: "running" }).returning())[0];
  if (!batch) throw err(404, "BATCH_NOT_FOUND", "Unknown batch_id");

  await db.update(schema.ugcImageBatches).set({ requestedCount: sql`${schema.ugcImageBatches.requestedCount} + ${b.images.length}`, status: "running" }).where(eq(schema.ugcImageBatches.id, batch.id));

  const rows = await db.insert(schema.ugcImages).values(b.images.map((c) => ({
    creatorName: c.creator_name, gender: c.gender, styleTags: c.style_tags, category: c.category, setting: c.setting,
    territories: c.territories, licenceExpiresAt: c.licence_expires_at ? new Date(c.licence_expires_at) : null, storageKey: c.storage_key, tier: c.tier,
    status: "processing" as const, ingestBatchId: batch.id,
  }))).returning({ id: schema.ugcImages.id });

  await Promise.all(rows.map((r) => enqueue("ugc_image.process", { imageId: r.id })));
  await audit({ actorId: actor.userId, action: "ugc_images.bulk_register", targetType: "ugc_image_batch", targetId: batch.id, meta: { registered: rows.length } });
  return { batch_id: batch.id, registered: rows.length };
});
