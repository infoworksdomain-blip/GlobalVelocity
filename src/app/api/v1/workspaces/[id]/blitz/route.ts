import { route } from "@/lib/route";
import { db, schema } from "@/db";
import { and, eq, desc, sql, count, inArray } from "drizzle-orm";
import { requireWorkspace, limits, bumpUsage } from "@/lib/tenancy";
import { enqueue } from "@/lib/queue";
import { serializeItem } from "@/lib/content";

/** Next N ranked candidates; auto-refills the stack when running low (FR-5.4). */
export const GET = route(async ({ actor, params, url }) => {
  const { ws, plan } = await requireWorkspace(actor, params.id);
  const n = Math.min(20, Number(url.searchParams.get("limit") ?? 8));
  const format = url.searchParams.get("format");
  const where = and(eq(schema.contentItems.workspaceId, ws.id), eq(schema.contentItems.status, "candidate"), format ? eq(schema.contentItems.format, format as schema.ContentFormat) : undefined);
  const items = await db.select().from(schema.contentItems).where(where).orderBy(desc(schema.contentItems.predictedScore), desc(schema.contentItems.createdAt)).limit(n);
  const [{ remaining }] = await db.select({ remaining: count() }).from(schema.contentItems).where(and(eq(schema.contentItems.workspaceId, ws.id), eq(schema.contentItems.status, "candidate")));
  const [{ generating }] = await db.select({ generating: count() }).from(schema.contentItems).where(and(eq(schema.contentItems.workspaceId, ws.id), eq(schema.contentItems.status, "generating")));
  let refilled = false;
  if (remaining + generating < 10) {
    const profile = await db.query.companyProfiles.findFirst({ where: and(eq(schema.companyProfiles.workspaceId, ws.id), eq(schema.companyProfiles.isCurrent, true)) });
    if (profile) {
      try {
        const want = Math.min(20, limits(plan).candidatesPerDay);
        await bumpUsage(ws.accountId, "candidates_generated", want, "day", limits(plan).candidatesPerDay);
        const [b] = await db.insert(schema.generationBatches).values({ workspaceId: ws.id, profileId: profile.id, source: "blitz", requestedCount: want, params: {} }).returning();
        await enqueue("generate.batch", { batchId: b.id }); refilled = true;
      } catch { /* daily limit reached: surface upgrade wall in UI */ }
    }
  }
  const chars = items.some((i) => i.characterId) ? await db.select({ id: schema.characters.id, name: schema.characters.name }).from(schema.characters).where(inArray(schema.characters.id, items.map((i) => i.characterId!).filter(Boolean))) : [];
  return { items: items.map((i) => serializeItem(i, { character: chars.find((c) => c.id === i.characterId) ?? null })), remaining, generating, refilled, daily_limit: limits(plan).candidatesPerDay, saves_limit: limits(plan).saves };
});
export const dynamic = "force-dynamic"; void sql;
