import { route, page } from "@/lib/route";
import { db, schema } from "@/db";
import { and, eq, lt, or, arrayContains, desc } from "drizzle-orm";
import { canUseCharacterTier, limits } from "@/lib/tenancy";
import { publicUrl } from "@/lib/storage";
/** Mirrors /ugc-clips exactly -- same compound (createdAt, id) cursor for the same reason (bulk-registered
 *  images share an identical createdAt within one insert). */
function decodeCursor(raw: string) { const i = raw.lastIndexOf("_"); return { ts: new Date(raw.slice(0, i)), id: raw.slice(i + 1) }; }
export const GET = route(async ({ actor, url }) => {
  const q = url.searchParams;
  const { limit, cursor } = page(url);
  const c = cursor ? decodeCursor(cursor) : null;
  const rows = await db.select().from(schema.ugcImages).where(and(
    eq(schema.ugcImages.status, "published"),
    q.get("style") ? arrayContains(schema.ugcImages.styleTags, [q.get("style")!]) : undefined,
    q.get("gender") ? eq(schema.ugcImages.gender, q.get("gender")!) : undefined,
    q.get("category") ? eq(schema.ugcImages.category, q.get("category")!) : undefined,
    c ? or(lt(schema.ugcImages.createdAt, c.ts), and(eq(schema.ugcImages.createdAt, c.ts), lt(schema.ugcImages.id, c.id))) : undefined,
  )).orderBy(desc(schema.ugcImages.createdAt), desc(schema.ugcImages.id)).limit(limit);
  const last = rows[rows.length - 1];
  return {
    images: rows.map((c2) => ({ id: c2.id, creatorName: c2.creatorName, gender: c2.gender, styleTags: c2.styleTags, category: c2.category, setting: c2.setting, width: c2.width, height: c2.height, thumbnailUrl: publicUrl(c2.thumbnailKey), previewUrl: publicUrl(c2.storageKey), tier: c2.tier, locked: !canUseCharacterTier(actor.plan, c2.tier) })),
    next_cursor: rows.length === limit && last ? `${last.createdAt.toISOString()}_${last.id}` : null,
    monthly_quota: limits(actor.plan).ugcImagesMonthly,
  };
});
