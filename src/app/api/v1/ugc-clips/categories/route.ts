import { route } from "@/lib/route";
import { db, schema } from "@/db";
import { and, eq, isNotNull } from "drizzle-orm";

/** Distinct list of published UGC categories -- videos and images combined, since a "niche" spans both media
 *  types -- for niche pickers (e.g. GhostMode's dropdown). Same source of truth as matchNiche()'s
 *  AVAILABLE_CATEGORIES in src/lib/generation.ts. */
export const GET = route(async () => {
  const [clipRows, imageRows] = await Promise.all([
    db.selectDistinct({ category: schema.ugcClips.category }).from(schema.ugcClips).where(and(eq(schema.ugcClips.status, "published"), isNotNull(schema.ugcClips.category))),
    db.selectDistinct({ category: schema.ugcImages.category }).from(schema.ugcImages).where(and(eq(schema.ugcImages.status, "published"), isNotNull(schema.ugcImages.category))),
  ]);
  const categories = [...new Set([...clipRows.map((r) => r.category!), ...imageRows.map((r) => r.category!)].filter(Boolean))].sort();
  return { categories };
});
