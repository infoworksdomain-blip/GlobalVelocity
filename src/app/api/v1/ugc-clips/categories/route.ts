import { route } from "@/lib/route";
import { db, schema } from "@/db";
import { and, eq, isNotNull } from "drizzle-orm";

/** Distinct list of published UGC clip categories, for niche pickers (e.g. GhostMode's dropdown) -- same source of truth as matchNiche()'s AVAILABLE_CATEGORIES in src/lib/generation.ts. */
export const GET = route(async () => {
  const rows = await db.selectDistinct({ category: schema.ugcClips.category }).from(schema.ugcClips).where(and(eq(schema.ugcClips.status, "published"), isNotNull(schema.ugcClips.category)));
  return { categories: rows.map((r) => r.category!).filter(Boolean).sort() };
});
