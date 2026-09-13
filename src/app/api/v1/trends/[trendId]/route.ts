import { route } from "@/lib/route";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { assertTrendRemix } from "@/lib/tenancy";
import { err } from "@/lib/errors";
export const GET = route(async ({ actor, params }) => {
  assertTrendRemix(actor.plan);
  const t = await db.query.trends.findFirst({ where: eq(schema.trends.id, params.trendId) }); if (!t) throw err(404, "TREND_NOT_FOUND", "Not found");
  return { trend: t };
});
