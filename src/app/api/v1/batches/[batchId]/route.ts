import { route } from "@/lib/route";
import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";
import { requireWorkspace } from "@/lib/tenancy";
import { err } from "@/lib/errors";
import { serializeItem } from "@/lib/content";
export const GET = route(async ({ actor, params }) => {
  const b = await db.query.generationBatches.findFirst({ where: eq(schema.generationBatches.id, params.batchId) });
  if (!b) throw err(404, "BATCH_NOT_FOUND", "Batch not found");
  await requireWorkspace(actor, b.workspaceId);
  const items = await db.select().from(schema.contentItems).where(eq(schema.contentItems.batchId, b.id)).orderBy(desc(schema.contentItems.predictedScore));
  return { batch: b, items: items.map((i) => serializeItem(i)) };
});
