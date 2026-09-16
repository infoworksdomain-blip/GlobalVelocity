import { route, page } from "@/lib/route";
import { db, schema } from "@/db";
import { and, eq, lt, or, arrayContains, desc, sql } from "drizzle-orm";
import { canUseCharacterTier, limits } from "@/lib/tenancy";
import { publicUrl } from "@/lib/storage";
/** Cursor is (createdAt, id) -- bulk-registered clips share an identical createdAt (one INSERT, one
 *  transaction timestamp), so createdAt alone as a cursor silently skips every row past the first page
 *  that shares the boundary timestamp. id is a tiebreaker, not a display value. */
function decodeCursor(raw: string) { const i = raw.lastIndexOf("_"); return { ts: new Date(raw.slice(0, i)), id: raw.slice(i + 1) }; }
export const GET = route(async ({ actor, url }) => {
  const q = url.searchParams;
  const { limit, cursor } = page(url);
  const c = cursor ? decodeCursor(cursor) : null;
  const rows = await db.select().from(schema.ugcClips).where(and(
    eq(schema.ugcClips.status, "published"),
    sql`(${schema.ugcClips.licenceExpiresAt} is null or ${schema.ugcClips.licenceExpiresAt} > now())`,
    q.get("style") ? arrayContains(schema.ugcClips.styleTags, [q.get("style")!]) : undefined,
    q.get("gender") ? eq(schema.ugcClips.gender, q.get("gender")!) : undefined,
    q.get("category") ? eq(schema.ugcClips.category, q.get("category")!) : undefined,
    c ? or(lt(schema.ugcClips.createdAt, c.ts), and(eq(schema.ugcClips.createdAt, c.ts), lt(schema.ugcClips.id, c.id))) : undefined,
  )).orderBy(desc(schema.ugcClips.createdAt), desc(schema.ugcClips.id)).limit(limit);
  const last = rows[rows.length - 1];
  return {
    // previewUrl/thumbnailUrl are the actual usable asset -- never return them for a tier the caller can't use,
    // or `locked` is advisory-only and the paywall is trivially bypassed by calling this endpoint directly.
    clips: rows.map((c2) => { const locked = !canUseCharacterTier(actor.plan, c2.tier); return { id: c2.id, creatorName: c2.creatorName, gender: c2.gender, styleTags: c2.styleTags, category: c2.category, setting: c2.setting, durationMs: c2.durationMs, licenceType: c2.licenceType, thumbnailUrl: locked ? null : publicUrl(c2.thumbnailKey), previewUrl: locked ? null : publicUrl(c2.storageKey), tier: c2.tier, locked }; }),
    next_cursor: rows.length === limit && last ? `${last.createdAt.toISOString()}_${last.id}` : null,
    monthly_quota: limits(actor.plan).ugcClipsMonthly,
  };
});
