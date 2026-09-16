import { route } from "@/lib/route";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { err } from "@/lib/errors";
/** Admin-only poll for bulk UGC image ingest progress. Mirrors admin/ugc-clip-batches/[batchId]. */
export const GET = route(async ({ actor, params }) => {
  if (!actor.isPlatformAdmin) throw err(403, "FORBIDDEN", "Admin only");
  const batch = await db.query.ugcImageBatches.findFirst({ where: eq(schema.ugcImageBatches.id, params.batchId) });
  if (!batch) throw err(404, "BATCH_NOT_FOUND", "Unknown batch");
  return { batch };
});
