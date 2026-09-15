import { db, schema } from "@/db";
import { publicUrl } from "@/lib/storage";
import { eq } from "drizzle-orm";

/** Serialise a content item for API/UI with resolved media URLs. */
export function serializeItem(i: typeof schema.contentItems.$inferSelect, extra: Record<string, unknown> = {}) {
  return {
    id: i.id, workspace_id: i.workspaceId, batch_id: i.batchId, format: i.format, status: i.status, angle: i.angle, hook: i.hook, script: i.script,
    on_screen_text: i.onScreenText, caption: i.caption, hashtags: i.hashtags, language: i.language, character_id: i.characterId, trend_id: i.trendId,
    media: { video_url: publicUrl(i.media.video_key), image_urls: (i.media.image_keys ?? []).map((k) => publicUrl(k)), thumbnail_url: publicUrl(i.media.thumbnail_key), duration_ms: i.media.duration_ms, width: i.media.width, height: i.media.height },
    overlay_style: i.overlayStyle,
    provenance: i.provenance, predicted_score: i.predictedScore ? Number(i.predictedScore) : null, is_ai_generated: i.isAiGenerated, moderation: i.moderation,
    saved_at: i.savedAt, created_at: i.createdAt, updated_at: i.updatedAt, ...extra,
  };
}
export async function snapshotVersion(item: typeof schema.contentItems.$inferSelect, editedBy?: string | null) {
  const [{ v }] = await db.select({ v: schema.contentVersions.version }).from(schema.contentVersions).where(eq(schema.contentVersions.contentItemId, item.id)).orderBy(schema.contentVersions.version).limit(1).then((r) => (r.length ? [{ v: r.length }] : [{ v: 0 }]));
  await db.insert(schema.contentVersions).values({ contentItemId: item.id, version: v + 1, snapshot: { hook: item.hook, script: item.script, caption: item.caption, hashtags: item.hashtags, on_screen_text: item.onScreenText, media: item.media }, editedBy: editedBy ?? undefined });
}
