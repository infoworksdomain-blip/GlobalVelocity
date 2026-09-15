import { route, page } from "@/lib/route";
import { db, schema } from "@/db";
import { and, eq, lt, arrayContains, desc } from "drizzle-orm";
import { canUseCharacterTier, limits } from "@/lib/tenancy";
import { publicUrl } from "@/lib/storage";
export const GET = route(async ({ actor, url }) => {
  const q = url.searchParams;
  const { limit, cursor } = page(url);
  const rows = await db.select().from(schema.ugcClips).where(and(
    eq(schema.ugcClips.status, "published"),
    q.get("style") ? arrayContains(schema.ugcClips.styleTags, [q.get("style")!]) : undefined,
    q.get("gender") ? eq(schema.ugcClips.gender, q.get("gender")!) : undefined,
    q.get("category") ? eq(schema.ugcClips.category, q.get("category")!) : undefined,
    cursor ? lt(schema.ugcClips.createdAt, new Date(cursor)) : undefined,
  )).orderBy(desc(schema.ugcClips.createdAt)).limit(limit);
  return {
    clips: rows.map((c) => ({ id: c.id, creatorName: c.creatorName, gender: c.gender, styleTags: c.styleTags, category: c.category, setting: c.setting, durationMs: c.durationMs, licenceType: c.licenceType, thumbnailUrl: publicUrl(c.thumbnailKey), previewUrl: publicUrl(c.storageKey), tier: c.tier, locked: !canUseCharacterTier(actor.plan, c.tier) })),
    next_cursor: rows.length === limit ? rows[rows.length - 1].createdAt.toISOString() : null,
    monthly_quota: limits(actor.plan).ugcClipsMonthly,
  };
});
