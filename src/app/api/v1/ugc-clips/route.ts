import { route } from "@/lib/route";
import { db, schema } from "@/db";
import { and, eq, arrayContains } from "drizzle-orm";
import { canUseCharacterTier, limits } from "@/lib/tenancy";
import { publicUrl } from "@/lib/storage";
export const GET = route(async ({ actor, url }) => {
  const q = url.searchParams;
  const rows = await db.select().from(schema.ugcClips).where(and(eq(schema.ugcClips.status, "published"), q.get("style") ? arrayContains(schema.ugcClips.styleTags, [q.get("style")!]) : undefined, q.get("gender") ? eq(schema.ugcClips.gender, q.get("gender")!) : undefined));
  return { clips: rows.map((c) => ({ id: c.id, creatorName: c.creatorName, gender: c.gender, styleTags: c.styleTags, setting: c.setting, durationMs: c.durationMs, licenceType: c.licenceType, thumbnailUrl: publicUrl(c.thumbnailKey), previewUrl: publicUrl(c.storageKey), tier: c.tier, locked: !canUseCharacterTier(actor.plan, c.tier) })), monthly_quota: limits(actor.plan).ugcClipsMonthly };
});
