import { route } from "@/lib/route";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireWorkspace } from "@/lib/tenancy";
import { err } from "@/lib/errors";
export const GET = route(async ({ actor, params }) => {
  const j = await db.query.jobs.findFirst({ where: eq(schema.jobs.id, params.jobId) });
  if (!j) throw err(404, "JOB_NOT_FOUND", "Job not found");
  if (j.workspaceId) await requireWorkspace(actor, j.workspaceId);
  return { job: j };
});
