import { route } from "@/lib/route";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireWorkspace, assertScheduling } from "@/lib/tenancy";
import { enqueue } from "@/lib/queue";
import { err } from "@/lib/errors";
export const POST = route(async ({ actor, params }) => {
  const a = await db.query.automations.findFirst({ where: eq(schema.automations.id, params.autoId) }); if (!a) throw err(404, "AUTOMATION_NOT_FOUND", "Not found");
  const { plan } = await requireWorkspace(actor, a.workspaceId, "editor"); assertScheduling(plan);
  const [run] = await db.insert(schema.automationRuns).values({ automationId: a.id }).returning();
  await enqueue("automation.run", { automationId: a.id, runId: run.id });
  return { run_id: run.id };
});
