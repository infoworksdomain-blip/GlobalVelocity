import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { err } from "@/lib/errors";
import { thumbnail, store } from "@/lib/render";
import { publicUrl } from "@/lib/storage";
import { fetchBuf } from "@/lib/render/pipeline";
import { z } from "zod";
/** Register a licensed human UGC clip already uploaded to storage (admin/creator portal). Records licence terms (FR-8.2). */
export const POST = route(async ({ actor, body }) => {
  if (!actor.isPlatformAdmin) throw err(403, "FORBIDDEN", "Admin only");
  const b = parse(z.object({ storage_key: z.string(), creator_name: z.string().max(80).optional(), gender: z.string().max(20).optional(), style_tags: z.array(z.string()).default([]), setting: z.string().max(40).optional(), duration_ms: z.number().int().positive(), has_speech: z.boolean().default(false), transcript: z.string().optional(), licence_type: z.enum(["audio_replace", "subtitle_only"]), territories: z.array(z.string()).default(["worldwide"]), licence_expires_at: z.string().datetime().optional(), tier: z.enum(["free", "starter", "growth", "pro"]).default("growth") }), body);
  const buf = await fetchBuf(publicUrl(b.storage_key)); if (!buf) throw err(422, "CLIP_NOT_FOUND", "Upload the clip first");
  const thumbKey = await store(b.storage_key.replace(/\.[^.]+$/, "") + "-thumb.jpg", await thumbnail(buf), "image/jpeg");
  const [c] = await db.insert(schema.ugcClips).values({ creatorName: b.creator_name, gender: b.gender, styleTags: b.style_tags, setting: b.setting, durationMs: b.duration_ms, hasSpeech: b.has_speech, transcript: b.transcript, licenceType: b.licence_type, territories: b.territories, licenceExpiresAt: b.licence_expires_at ? new Date(b.licence_expires_at) : null, storageKey: b.storage_key, thumbnailKey: thumbKey, tier: b.tier }).returning();
  return { clip: c };
});
