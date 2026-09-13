import { route } from "@/lib/route";
import { db, schema } from "@/db";
import { and, eq, gte, lte, desc, sql } from "drizzle-orm";
import { requireWorkspace } from "@/lib/tenancy";
import { publicUrl } from "@/lib/storage";

/** Overview KPIs per platform, top posts, breakdowns, outliers and insight sentences (FR-15.2/15.3). */
export const GET = route(async ({ actor, params, url }) => {
  await requireWorkspace(actor, params.id);
  const from = new Date(url.searchParams.get("from") ?? Date.now() - 30 * 86.4e6); const to = new Date(url.searchParams.get("to") ?? Date.now());
  // latest metric snapshot per post
  const latest = db.select({ postId: schema.postMetrics.scheduledPostId, latestAt: sql<Date>`max(${schema.postMetrics.capturedAt})`.as("latest_at") }).from(schema.postMetrics).groupBy(schema.postMetrics.scheduledPostId).as("latest");
  const rows = await db.select({
    postId: schema.scheduledPosts.id, publishedAt: schema.scheduledPosts.publishedAt, permalink: schema.scheduledPosts.permalink, platform: schema.socialAccounts.platform, handle: schema.socialAccounts.handle,
    contentId: schema.contentItems.id, hook: schema.contentItems.hook, format: schema.contentItems.format, characterId: schema.contentItems.characterId, media: schema.contentItems.media,
    views: sql<number>`coalesce(${schema.postMetrics.views},0)::int`, likes: sql<number>`coalesce(${schema.postMetrics.likes},0)::int`, comments: sql<number>`coalesce(${schema.postMetrics.comments},0)::int`, shares: sql<number>`coalesce(${schema.postMetrics.shares},0)::int`,
  }).from(schema.scheduledPosts)
    .innerJoin(schema.socialAccounts, eq(schema.socialAccounts.id, schema.scheduledPosts.socialAccountId)).innerJoin(schema.contentItems, eq(schema.contentItems.id, schema.scheduledPosts.contentItemId))
    .leftJoin(latest, eq(latest.postId, schema.scheduledPosts.id)).leftJoin(schema.postMetrics, and(eq(schema.postMetrics.scheduledPostId, schema.scheduledPosts.id), eq(schema.postMetrics.capturedAt, latest.latestAt)))
    .where(and(eq(schema.scheduledPosts.workspaceId, params.id), eq(schema.scheduledPosts.status, "published"), gte(schema.scheduledPosts.publishedAt, from), lte(schema.scheduledPosts.publishedAt, to))).orderBy(desc(schema.scheduledPosts.publishedAt));
  const byPlatform: Record<string, { posts: number; views: number; likes: number; comments: number; shares: number }> = {};
  const byFormat: Record<string, { posts: number; views: number }> = {}; const byHour: Record<number, { posts: number; views: number }> = {}; const byCharacter: Record<string, { posts: number; views: number }> = {};
  for (const r of rows) {
    const p = (byPlatform[r.platform] ??= { posts: 0, views: 0, likes: 0, comments: 0, shares: 0 }); p.posts++; p.views += r.views; p.likes += r.likes; p.comments += r.comments; p.shares += r.shares;
    const f = (byFormat[r.format] ??= { posts: 0, views: 0 }); f.posts++; f.views += r.views;
    const h = r.publishedAt?.getUTCHours() ?? 0; const hh = (byHour[h] ??= { posts: 0, views: 0 }); hh.posts++; hh.views += r.views;
    if (r.characterId) { const c = (byCharacter[r.characterId] ??= { posts: 0, views: 0 }); c.posts++; c.views += r.views; }
  }
  const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  const outliers = new Set<string>();
  for (const pl of Object.keys(byPlatform)) { const xs = rows.filter((r) => r.platform === pl).map((r) => r.views); const m = median(xs); for (const r of rows) if (r.platform === pl && m > 0 && r.views >= 3 * m) outliers.add(r.postId); }
  const insights: string[] = [];
  const fmts = Object.entries(byFormat).map(([f, v]) => [f, v.posts ? v.views / v.posts : 0] as const).sort((a, b) => b[1] - a[1]);
  if (fmts.length > 1 && fmts[1][1] > 0) insights.push(`${label(fmts[0][0])} averages ${(fmts[0][1] / fmts[1][1]).toFixed(1)}× the views of ${label(fmts[1][0])} this period.`);
  if (outliers.size) insights.push(`${outliers.size} post${outliers.size > 1 ? "s" : ""} broke out at 3× your median — generate similar content to double down.`);
  const best = Object.entries(byHour).map(([h, v]) => [Number(h), v.posts ? v.views / v.posts : 0] as const).sort((a, b) => b[1] - a[1])[0];
  if (best && rows.length >= 5) insights.push(`Posts published around ${String(best[0]).padStart(2, "0")}:00 UTC perform best on average.`);
  if (!rows.length) insights.push("No published posts in this period yet — schedule content to start seeing analytics.");
  return {
    range: { from, to }, totals: { posts: rows.length, views: rows.reduce((a, r) => a + r.views, 0), likes: rows.reduce((a, r) => a + r.likes, 0), comments: rows.reduce((a, r) => a + r.comments, 0), shares: rows.reduce((a, r) => a + r.shares, 0) },
    by_platform: byPlatform, by_format: byFormat, by_hour: byHour, by_character: byCharacter,
    top_posts: [...rows].sort((a, b) => b.views - a.views).slice(0, 10).map((r) => ({ ...r, media: undefined, thumbnail_url: publicUrl(r.media.thumbnail_key), outlier: outliers.has(r.postId) })),
    posts: rows.map((r) => ({ ...r, media: undefined, thumbnail_url: publicUrl(r.media.thumbnail_key), outlier: outliers.has(r.postId) })), insights,
  };
});
const label = (f: string) => ({ ai_ugc: "AI UGC", human_ugc: "Human UGC", slideshow: "Slideshows", hook_demo: "Hook + demo", meme: "Memes", remix: "Remixes", upload: "Uploads" }[f] ?? f);
