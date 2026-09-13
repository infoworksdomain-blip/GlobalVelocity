import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";
import { requireWorkspace, limits, countSaves } from "@/lib/tenancy";
import { err, planLimit } from "@/lib/errors";
import { serializeItem, snapshotVersion } from "@/lib/content";
import { publicUrl, signedUrl } from "@/lib/storage";
import { moderateText } from "@/lib/llm";
import { z } from "zod";

async function load(actor: Parameters<typeof requireWorkspace>[0], id: string, role: "viewer" | "editor" = "viewer") {
  const item = await db.query.contentItems.findFirst({ where: eq(schema.contentItems.id, id) });
  if (!item || item.deletedAt) throw err(404, "CONTENT_NOT_FOUND", "Content not found");
  const ctx = await requireWorkspace(actor, item.workspaceId, role); return { item, ...ctx };
}
export const GET = route(async ({ actor, params, url }) => {
  const { item, plan } = await load(actor, params.itemId);
  if (url.searchParams.get("download")) {
    if (!limits(plan).watermarkFreeDownloads) throw planLimit("PLAN_DOWNLOAD", "Downloads require a paid plan");
    const key = item.media.video_key ?? item.media.image_keys?.[0]; if (!key) throw err(409, "MEDIA_NOT_READY", "No media");
    return { url: await signedUrl(key) };
  }
  const [versions, posts] = await Promise.all([
    db.select().from(schema.contentVersions).where(eq(schema.contentVersions.contentItemId, item.id)).orderBy(desc(schema.contentVersions.version)),
    db.select({ id: schema.scheduledPosts.id, status: schema.scheduledPosts.status, scheduledAt: schema.scheduledPosts.scheduledAt, permalink: schema.scheduledPosts.permalink, platform: schema.socialAccounts.platform, handle: schema.socialAccounts.handle }).from(schema.scheduledPosts).innerJoin(schema.socialAccounts, eq(schema.socialAccounts.id, schema.scheduledPosts.socialAccountId)).where(eq(schema.scheduledPosts.contentItemId, item.id)),
  ]);
  const metrics = posts.length ? await db.select().from(schema.postMetrics).where(eq(schema.postMetrics.scheduledPostId, posts[0].id)).orderBy(desc(schema.postMetrics.capturedAt)).limit(1) : [];
  return { item: serializeItem(item, { versions, scheduled_posts: posts, latest_metrics: metrics[0] ?? null }) };
});
export const PATCH = route(async ({ actor, params, body }) => {
  const { item } = await load(actor, params.itemId, "editor");
  const b = parse(z.object({ hook: z.string().max(200).optional(), script: z.string().max(5000).optional(), caption: z.string().max(3000).optional(), hashtags: z.array(z.string()).max(30).optional(), on_screen_text: z.array(z.string()).optional(), status: z.enum(["draft", "saved"]).optional(), slides: z.array(z.object({ title: z.string().max(80), body: z.string().max(200) })).max(10).optional(), meme_top: z.string().max(80).optional(), meme_bottom: z.string().max(80).optional() }), body);
  if (moderateText(b.hook, b.script, b.caption).status === "blocked") throw err(422, "MODERATION", "Content violates policy");
  await snapshotVersion(item, actor.userId);
  const [updated] = await db.update(schema.contentItems).set({ hook: b.hook ?? item.hook, script: b.script ?? item.script, caption: b.caption ?? item.caption, hashtags: b.hashtags ?? item.hashtags, onScreenText: b.on_screen_text ?? item.onScreenText, status: b.status ?? item.status, provenance: { ...item.provenance, ...(b.slides ? { slides: b.slides } : {}), ...(b.meme_top || b.meme_bottom ? { meme: { top: b.meme_top ?? (item.provenance as { meme?: { top: string } }).meme?.top, bottom: b.meme_bottom ?? (item.provenance as { meme?: { bottom: string } }).meme?.bottom } } : {}) }, updatedAt: new Date() }).where(eq(schema.contentItems.id, item.id)).returning();
  return { item: serializeItem(updated) };
});
export const DELETE = route(async ({ actor, params }) => {
  const { item } = await load(actor, params.itemId, "editor");
  await db.update(schema.contentItems).set({ status: "archived", deletedAt: new Date() }).where(eq(schema.contentItems.id, item.id));
  return { ok: true };
});
export const POST = route(async ({ actor, params, url }) => { // duplicate
  const { item, ws, plan } = await load(actor, params.itemId, "editor");
  if (url.searchParams.get("action") !== "duplicate") throw err(400, "VALIDATION", "action=duplicate expected");
  const max = limits(plan).saves; if (max !== null && (await countSaves(ws.accountId)) >= max) throw planLimit("PLAN_LIMIT_SAVES", "Save limit reached");
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = item; void _id; void _c; void _u;
  const [dup] = await db.insert(schema.contentItems).values({ ...rest, status: "saved", savedAt: new Date(), provenance: { ...item.provenance, duplicated_from: item.id } }).returning();
  return { item: serializeItem(dup) };
});
export const runtime = "nodejs"; void publicUrl;
