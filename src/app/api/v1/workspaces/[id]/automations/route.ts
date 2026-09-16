import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";
import { requireWorkspace, assertScheduling } from "@/lib/tenancy";
import { z } from "zod";
import { configSchema } from "@/lib/automation-schema";
export const GET = route(async ({ actor, params }) => { await requireWorkspace(actor, params.id); return { automations: await db.select().from(schema.automations).where(eq(schema.automations.workspaceId, params.id)).orderBy(desc(schema.automations.createdAt)) }; });
export const POST = route(async ({ actor, params, body }) => {
  const { plan } = await requireWorkspace(actor, params.id, "editor"); assertScheduling(plan);
  const b = parse(z.object({ name: z.string().min(1).max(80), mode: z.enum(["one_shot", "continuous"]).default("one_shot"), approval: z.enum(["auto", "blitz", "calendar"]).default("calendar"), kind: z.enum(["manual", "ghost_mode"]).default("manual"), config: configSchema }), body);
  const [a] = await db.insert(schema.automations).values({ workspaceId: params.id, name: b.name, mode: b.mode, approval: b.approval, kind: b.kind, config: b.config as schema.AutomationConfig, nextRunAt: b.mode === "continuous" ? new Date() : null }).returning();
  return { automation: a };
});
