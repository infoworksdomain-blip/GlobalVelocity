import { route } from "@/lib/route";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireWorkspace } from "@/lib/tenancy";
import { enqueue } from "@/lib/queue";
import { err } from "@/lib/errors";
/** Re-render media from the item's current (edited) copy. Returns a job id to poll. */
export const POST = route(async ({ actor, params }) => {
  const item = await db.query.contentItems.findFirst({ where: eq(schema.contentItems.id, params.itemId) }); if (!item) throw err(404, "CONTENT_NOT_FOUND", "Not found");
  await requireWorkspace(actor, item.workspaceId, "editor");
  if (["generating", "publishing"].includes(item.status)) throw err(409, "BUSY", "Item is busy");
  const [job] = await db.insert(schema.jobs).values({ workspaceId: item.workspaceId, type: "render.item" }).returning();
  await enqueue("render.item", { itemId: item.id, jobId: job.id }, { priority: 1 }); // user-initiated: jumps ahead of batch renders
  return { job_id: job.id };
});
