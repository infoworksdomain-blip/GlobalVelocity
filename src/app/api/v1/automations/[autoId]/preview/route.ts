import { route } from "@/lib/route";
import { db, schema } from "@/db";
import { eq, and, isNull, count } from "drizzle-orm";
import { requireWorkspace, limits, countSaves } from "@/lib/tenancy";
import { planAutomation } from "@/lib/automations";
import { err } from "@/lib/errors";
/** Dry run: slot plan + quota impact (FR-14.2). */
export const POST = route(async ({ actor, params }) => {
  const a = await db.query.automations.findFirst({ where: eq(schema.automations.id, params.autoId) }); if (!a) throw err(404, "AUTOMATION_NOT_FOUND", "Not found");
  const { ws, plan } = await requireWorkspace(actor, a.workspaceId);
  const p = await planAutomation(a, ws.timezone);
  const [{ lib }] = await db.select({ lib: count() }).from(schema.contentItems).where(and(eq(schema.contentItems.workspaceId, ws.id), eq(schema.contentItems.status, "saved"), isNull(schema.contentItems.deletedAt)));
  const toGenerate = a.config.source === "library" ? 0 : Math.max(0, p.slots.length - (a.config.source === "generate" ? 0 : lib));
  const saves = await countSaves(ws.accountId); const max = limits(plan).saves;
  return { slots: p.slots.length, per_account: p.perAccount, by_day: p.slots.reduce<Record<string, number>>((m, s) => { const k = s.at.toISOString().slice(0, 10); m[k] = (m[k] ?? 0) + 1; return m; }, {}), will_generate: toGenerate, library_items_available: lib, saves_used: saves, saves_limit: max, saves_after: max === null ? null : Math.min(max, saves + toGenerate), warnings: [...(max !== null && saves + toGenerate > max ? [`Only ${max - saves} saves left on your plan; ${saves + toGenerate - max} slots will be skipped`] : []), ...(toGenerate > limits(plan).candidatesPerDay ? [`Generation exceeds your daily candidate limit (${limits(plan).candidatesPerDay}); the run will be capped`] : [])] };
});
