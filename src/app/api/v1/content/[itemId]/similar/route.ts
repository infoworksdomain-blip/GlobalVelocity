import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { requireWorkspace, bumpUsage, limits } from "@/lib/tenancy";
import { enqueue } from "@/lib/queue";
import { err } from "@/lib/errors";
import { z } from "zod";
/** Generate N variants reusing angle/format/character (FR-4.6, FR-15.4). */
export const POST = route(async ({ actor, params, body }) => {
  const item = await db.query.contentItems.findFirst({ where: eq(schema.contentItems.id, params.itemId) });
  if (!item) throw err(404, "CONTENT_NOT_FOUND", "Content not found");
  const { ws, plan } = await requireWorkspace(actor, item.workspaceId, "editor");
  const b = parse(z.object({ count: z.number().int().min(1).max(10).default(5) }), body);
  const profile = await db.query.companyProfiles.findFirst({ where: and(eq(schema.companyProfiles.workspaceId, ws.id), eq(schema.companyProfiles.isCurrent, true)) });
  await bumpUsage(ws.accountId, "candidates_generated", b.count, "day", limits(plan).candidatesPerDay);
  const [batch] = await db.insert(schema.generationBatches).values({ workspaceId: ws.id, profileId: profile?.id, requestedBy: actor.userId, source: "similar", requestedCount: b.count, params: { formats: [item.format], character_ids: item.characterId ? [item.characterId] : undefined, trend_ids: item.trendId ? [item.trendId] : undefined, similar_to: item.id, angle_hints: [item.angle ?? item.hook ?? ""] } }).returning();
  await enqueue("generate.batch", { batchId: batch.id });
  return { batch_id: batch.id };
});
