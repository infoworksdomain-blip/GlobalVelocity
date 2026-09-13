import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";
import { requireWorkspace } from "@/lib/tenancy";
import { err } from "@/lib/errors";
import { configSchema } from "@/lib/automation-schema";
import { z } from "zod";
async function load(actor: Parameters<typeof requireWorkspace>[0], id: string) { const a = await db.query.automations.findFirst({ where: eq(schema.automations.id, id) }); if (!a) throw err(404, "AUTOMATION_NOT_FOUND", "Not found"); await requireWorkspace(actor, a.workspaceId, "editor"); return a; }
export const GET = route(async ({ actor, params }) => { const a = await load(actor, params.autoId); return { automation: a, runs: await db.select().from(schema.automationRuns).where(eq(schema.automationRuns.automationId, a.id)).orderBy(desc(schema.automationRuns.startedAt)).limit(20) }; });
export const PATCH = route(async ({ actor, params, body }) => {
  const a = await load(actor, params.autoId);
  const b = parse(z.object({ name: z.string().optional(), status: z.enum(["active", "paused"]).optional(), approval: z.enum(["auto", "blitz", "calendar"]).optional(), mode: z.enum(["one_shot", "continuous"]).optional(), config: configSchema.partial().optional() }), body);
  const [u] = await db.update(schema.automations).set({ name: b.name ?? a.name, status: b.status ?? a.status, approval: b.approval ?? a.approval, mode: b.mode ?? a.mode, config: { ...a.config, ...(b.config ?? {}) } as schema.AutomationConfig, nextRunAt: b.status === "active" && (b.mode ?? a.mode) === "continuous" ? new Date() : a.nextRunAt }).where(eq(schema.automations.id, a.id)).returning();
  return { automation: u };
});
export const DELETE = route(async ({ actor, params }) => { const a = await load(actor, params.autoId); await db.delete(schema.automations).where(eq(schema.automations.id, a.id)); return { ok: true }; });
