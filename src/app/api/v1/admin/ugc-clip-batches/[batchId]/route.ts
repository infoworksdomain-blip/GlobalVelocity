import { route } from "@/lib/route";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { err } from "@/lib/errors";
/** Admin-only poll for bulk UGC ingest progress -- deliberately not the generic /jobs/:id route, which only
 *  gates on workspace membership and would be readable by any authenticated user for a workspaceId-less job. */
export const GET = route(async ({ actor, params }) => {
  if (!actor.isPlatformAdmin) throw err(403, "FORBIDDEN", "Admin only");
  const batch = await db.query.ugcClipBatches.findFirst({ where: eq(schema.ugcClipBatches.id, params.batchId) });
  if (!batch) throw err(404, "BATCH_NOT_FOUND", "Unknown batch");
  return { batch };
});
