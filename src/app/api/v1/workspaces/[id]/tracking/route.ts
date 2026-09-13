import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { eq, and, gte, sql, desc } from "drizzle-orm";
import { requireWorkspace } from "@/lib/tenancy";
import { randomToken } from "@/lib/crypto";
import { z } from "zod";
/** Tracking sites + attribution report (M16). */
export const GET = route(async ({ actor, params, url }) => {
  await requireWorkspace(actor, params.id);
  const sites = await db.select().from(schema.trackingSites).where(eq(schema.trackingSites.workspaceId, params.id));
  const from = new Date(url.searchParams.get("from") ?? Date.now() - 30 * 86.4e6);
  const report = sites.length ? await db.select({ source: sql<string>`coalesce(${schema.trackingEvents.utm}->>'utm_source', (select sa.platform from tracked_links tl join scheduled_posts sp on sp.id = tl.scheduled_post_id join social_accounts sa on sa.id = sp.social_account_id where tl.id = ${schema.trackingEvents.trackedLinkId} limit 1), case when ${schema.trackingEvents.referrer} ilike '%tiktok%' then 'tiktok' when ${schema.trackingEvents.referrer} ilike '%instagram%' then 'instagram' when ${schema.trackingEvents.referrer} ilike '%youtube%' or ${schema.trackingEvents.referrer} ilike '%youtu.be%' then 'youtube' when ${schema.trackingEvents.referrer} ilike '%linkedin%' then 'linkedin' when ${schema.trackingEvents.referrer} is null or ${schema.trackingEvents.referrer} = '' then 'direct' else 'other' end)`, event: schema.trackingEvents.event, count: sql<number>`count(*)::int`, value: sql<number>`coalesce(sum(${schema.trackingEvents.value}),0)::float` }).from(schema.trackingEvents).where(and(eq(schema.trackingEvents.siteId, sites[0].id), gte(schema.trackingEvents.occurredAt, from))).groupBy(sql`1`, schema.trackingEvents.event) : [];
  const byPost = sites.length ? await db.select({ trackedLinkId: schema.trackingEvents.trackedLinkId, event: schema.trackingEvents.event, count: sql<number>`count(*)::int` }).from(schema.trackingEvents).where(and(eq(schema.trackingEvents.siteId, sites[0].id), gte(schema.trackingEvents.occurredAt, from), sql`${schema.trackingEvents.trackedLinkId} is not null`)).groupBy(schema.trackingEvents.trackedLinkId, schema.trackingEvents.event) : [];
  const links = await db.select().from(schema.trackedLinks).where(eq(schema.trackedLinks.workspaceId, params.id)).orderBy(desc(schema.trackedLinks.createdAt)).limit(200);
  const snippet = sites[0] ? `<script async src="${process.env.APP_URL}/t.js" data-site="${sites[0].siteKey}"></script>` : null;
  return { sites, snippet, report, by_post: byPost, links: links.map((l) => ({ ...l, url: `${process.env.APP_URL}/r/${l.slug}` })) };
});
export const POST = route(async ({ actor, params, body }) => {
  await requireWorkspace(actor, params.id, "admin");
  const b = parse(z.object({ domain: z.string().min(3).max(200) }), body);
  const [site] = await db.insert(schema.trackingSites).values({ workspaceId: params.id, domain: b.domain.replace(/^https?:\/\//, "").replace(/\/.*$/, ""), siteKey: "vt_" + randomToken(12) }).returning();
  return { site, snippet: `<script async src="${process.env.APP_URL}/t.js" data-site="${site.siteKey}"></script>` };
});
