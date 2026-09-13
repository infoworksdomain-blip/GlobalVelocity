import { route } from "@/lib/route";
import { db, schema } from "@/db";
import { and, eq, gte, desc, sql, arrayContains } from "drizzle-orm";
import { getActorOrNull, requireWorkspace, limits } from "@/lib/tenancy";
import { NextResponse } from "next/server";
import { toResponse } from "@/lib/errors";
/** Browse trends (metadata + recipes only). for_workspace=:id ranks by similarity to the Company Profile (pgvector cosine). */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url); const q = url.searchParams; const actor = await getActorOrNull(req);
    let plan: schema.Plan = actor?.plan ?? "free"; let embedding: number[] | null = null;
    if (q.get("for_workspace") && actor) { const { ws, plan: p } = await requireWorkspace(actor, q.get("for_workspace")!); plan = p; const prof = await db.query.companyProfiles.findFirst({ where: and(eq(schema.companyProfiles.workspaceId, ws.id), eq(schema.companyProfiles.isCurrent, true)) }); embedding = prof?.embedding ?? null; }
    const where = and(eq(schema.trends.status, "active"), q.get("platform") ? eq(schema.trends.platform, q.get("platform") as schema.Platform) : undefined, q.get("niche") ? arrayContains(schema.trends.nicheTags, [q.get("niche")!]) : undefined, q.get("format") ? eq(schema.trends.formatType, q.get("format")!) : undefined, q.get("min_views") ? sql`(${schema.trends.metrics}->>'views')::bigint >= ${Number(q.get("min_views"))}` : undefined, q.get("since") ? gte(schema.trends.firstSeenAt, new Date(q.get("since")!)) : undefined, q.get("q") ? sql`${schema.trends.hookText} ilike ${"%" + q.get("q") + "%"}` : undefined);
    const order = embedding ? sql`${schema.trends.embedding} <=> ${`[${embedding.join(",")}]`}::vector` : q.get("sort") === "recent" ? desc(schema.trends.firstSeenAt) : q.get("sort") === "views" ? sql`(${schema.trends.metrics}->>'views')::bigint desc` : desc(schema.trends.velocityScore);
    const rows = await db.select().from(schema.trends).where(where).orderBy(order).limit(Math.min(60, Number(q.get("limit") ?? 24))).offset(Number(q.get("offset") ?? 0));
    const full = limits(plan).trendRemix;
    return NextResponse.json({ trends: rows.map((t) => ({ id: t.id, platform: t.platform, post_url: t.postUrl, creator_handle: t.creatorHandle, niche_tags: t.nicheTags, format_type: t.formatType, hook_text: t.hookText, metrics: full ? t.metrics : { views: t.metrics.views }, velocity_score: Number(t.velocityScore ?? 0), first_seen_at: t.firstSeenAt, recipe: full ? t.recipe : undefined, locked: !full })), locked: !full });
  } catch (e) { return toResponse(e); }
}
export const dynamic = "force-dynamic"; void route;
