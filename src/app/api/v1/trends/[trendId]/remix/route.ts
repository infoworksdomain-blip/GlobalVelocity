import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { requireWorkspace, assertTrendRemix, bumpUsage, limits } from "@/lib/tenancy";
import { enqueue } from "@/lib/queue";
import { err } from "@/lib/errors";
import { z } from "zod";
export const POST = route(async ({ actor, params, body }) => {
  const b = parse(z.object({ workspace_id: z.string().uuid(), count: z.number().int().min(1).max(10).default(5) }), body);
  const { ws, plan } = await requireWorkspace(actor, b.workspace_id, "editor"); assertTrendRemix(plan);
  const t = await db.query.trends.findFirst({ where: eq(schema.trends.id, params.trendId) }); if (!t) throw err(404, "TREND_NOT_FOUND", "Not found");
  const profile = await db.query.companyProfiles.findFirst({ where: and(eq(schema.companyProfiles.workspaceId, ws.id), eq(schema.companyProfiles.isCurrent, true)) }); if (!profile) throw err(409, "PROFILE_REQUIRED", "Create a company profile first");
  await bumpUsage(ws.accountId, "candidates_generated", b.count, "day", limits(plan).candidatesPerDay);
  const [batch] = await db.insert(schema.generationBatches).values({ workspaceId: ws.id, profileId: profile.id, requestedBy: actor.userId, source: "studio", requestedCount: b.count, params: { formats: ["remix"], trend_ids: [t.id] } }).returning();
  await enqueue("generate.batch", { batchId: batch.id });
  return { batch_id: batch.id };
});
