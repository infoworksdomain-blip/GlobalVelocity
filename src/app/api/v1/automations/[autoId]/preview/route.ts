import { route } from "@/lib/route";
import { db, schema } from "@/db";
import { eq, and, isNull, count, inArray, sql } from "drizzle-orm";
import { requireWorkspace, limits, countSaves } from "@/lib/tenancy";
import { planAutomation } from "@/lib/automations";
import { err } from "@/lib/errors";
import { PLANS, PLAN_ORDER, tierRank } from "@/lib/plans";
/** Dry run: slot plan + quota impact (FR-14.2). */
export const POST = route(async ({ actor, params }) => {
  const a = await db.query.automations.findFirst({ where: eq(schema.automations.id, params.autoId) }); if (!a) throw err(404, "AUTOMATION_NOT_FOUND", "Not found");
  const { ws, plan } = await requireWorkspace(actor, a.workspaceId);
  const p = await planAutomation(a, ws.timezone);
  const [{ lib }] = await db.select({ lib: count() }).from(schema.contentItems).where(and(eq(schema.contentItems.workspaceId, ws.id), eq(schema.contentItems.status, "saved"), isNull(schema.contentItems.deletedAt)));
  let libraryClipsAvailable: number | null = null;
  if ((a.config.format_mix.human_ugc ?? 0) > 0) {
    const allowedTiers = PLAN_ORDER.filter((t) => tierRank(PLANS[plan].limits.characterTier) >= tierRank(t));
    if (allowedTiers.length) {
      const [{ n }] = await db.select({ n: count() }).from(schema.ugcClips).where(and(
        eq(schema.ugcClips.status, "published"), inArray(schema.ugcClips.tier, allowedTiers),
        sql`(${schema.ugcClips.licenceExpiresAt} is null or ${schema.ugcClips.licenceExpiresAt} > now())`,
        a.config.ugc_categories?.length ? inArray(schema.ugcClips.category, a.config.ugc_categories) : undefined,
        a.config.ugc_style_tags?.length ? sql`${schema.ugcClips.styleTags} && array[${sql.join(a.config.ugc_style_tags.map((t) => sql`${t}`), sql.raw(","))}]::text[]` : undefined,
      ));
      libraryClipsAvailable = n;
    } else libraryClipsAvailable = 0;
  }
  const toGenerate = a.config.source === "library" ? 0 : Math.max(0, p.slots.length - (a.config.source === "generate" ? 0 : lib));
  const saves = await countSaves(ws.accountId); const max = limits(plan).saves;
  return { slots: p.slots.length, per_account: p.perAccount, by_day: p.slots.reduce<Record<string, number>>((m, s) => { const k = s.at.toISOString().slice(0, 10); m[k] = (m[k] ?? 0) + 1; return m; }, {}), will_generate: toGenerate, library_items_available: lib, library_clips_available: libraryClipsAvailable, saves_used: saves, saves_limit: max, saves_after: max === null ? null : Math.min(max, saves + toGenerate), warnings: [...(max !== null && saves + toGenerate > max ? [`Only ${max - saves} saves left on your plan; ${saves + toGenerate - max} slots will be skipped`] : []), ...(toGenerate > limits(plan).candidatesPerDay ? [`Generation exceeds your daily candidate limit (${limits(plan).candidatesPerDay}); the run will be capped`] : [])] };
});
