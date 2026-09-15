import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { eq, sql } from "drizzle-orm";
import { err } from "@/lib/errors";
import { enqueue } from "@/lib/queue";
import { z } from "zod";
/**
 * Step 2 of bulk UGC clip ingest: register already-uploaded objects as ugc_clips rows (insert only -- no
 * synchronous ffmpeg here, unlike the single-clip admin route) and enqueue async thumbnailing per clip.
 * Admin only.
 */
// Must be a key this route's own batch-presign step could have issued -- keeps a compromised/careless admin
// session from pointing a "public" ugc_clips row at an arbitrary key elsewhere in the shared bucket.
const clipSchema = z.object({
  storage_key: z.string().regex(/^library\/ugc\/[A-Za-z0-9_-]+\.[A-Za-z0-9]{1,10}$/), category: z.string().max(60).optional(), style_tags: z.array(z.string()).default([]),
  creator_name: z.string().max(80).optional(), gender: z.string().max(20).optional(), setting: z.string().max(40).optional(),
  has_speech: z.boolean().default(false), transcript: z.string().optional(),
  licence_type: z.enum(["audio_replace", "subtitle_only"]), territories: z.array(z.string()).default(["worldwide"]),
  licence_expires_at: z.string().datetime().optional(), tier: z.enum(["free", "starter", "growth", "pro"]).default("growth"),
});
export const POST = route(async ({ actor, body }) => {
  if (!actor.isPlatformAdmin) throw err(403, "FORBIDDEN", "Admin only");
  const b = parse(z.object({ batch_id: z.string().uuid().optional(), clips: z.array(clipSchema).min(1).max(500) }), body);

  const batch = b.batch_id
    ? await db.query.ugcClipBatches.findFirst({ where: eq(schema.ugcClipBatches.id, b.batch_id) })
    : (await db.insert(schema.ugcClipBatches).values({ createdBy: actor.userId, requestedCount: 0, status: "running" }).returning())[0];
  if (!batch) throw err(404, "BATCH_NOT_FOUND", "Unknown batch_id");

  await db.update(schema.ugcClipBatches).set({ requestedCount: sql`${schema.ugcClipBatches.requestedCount} + ${b.clips.length}`, status: "running" }).where(eq(schema.ugcClipBatches.id, batch.id));

  const rows = await db.insert(schema.ugcClips).values(b.clips.map((c) => ({
    creatorName: c.creator_name, gender: c.gender, styleTags: c.style_tags, category: c.category, setting: c.setting,
    durationMs: 0, hasSpeech: c.has_speech, transcript: c.transcript, licenceType: c.licence_type, territories: c.territories,
    licenceExpiresAt: c.licence_expires_at ? new Date(c.licence_expires_at) : null, storageKey: c.storage_key, tier: c.tier,
    status: "processing" as const, ingestBatchId: batch.id,
  }))).returning({ id: schema.ugcClips.id });

  await Promise.all(rows.map((r) => enqueue("ugc.thumbnail", { clipId: r.id })));
  return { batch_id: batch.id, registered: rows.length };
});
