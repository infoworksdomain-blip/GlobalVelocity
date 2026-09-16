import { route } from "@/lib/route";
import { db, schema } from "@/db";
import { and, eq, gte, lte, asc } from "drizzle-orm";
import { requireWorkspace } from "@/lib/tenancy";
import { publicUrl } from "@/lib/storage";
import { icsToken } from "@/lib/crypto";
export const GET = route(async ({ actor, params, url }) => {
  await requireWorkspace(actor, params.id);
  if (url.searchParams.get("feed")) return { feed_url: `${process.env.APP_URL}/api/v1/workspaces/${params.id}/calendar.ics?token=${icsToken(params.id)}` };
  const from = new Date(url.searchParams.get("from") ?? Date.now() - 7 * 86.4e6); const to = new Date(url.searchParams.get("to") ?? Date.now() + 35 * 86.4e6);
  const rows = await db.select({
    id: schema.scheduledPosts.id, status: schema.scheduledPosts.status, scheduledAt: schema.scheduledPosts.scheduledAt, permalink: schema.scheduledPosts.permalink, lastError: schema.scheduledPosts.lastError, automationId: schema.scheduledPosts.automationId,
    automationKind: schema.automations.kind,
    platform: schema.socialAccounts.platform, handle: schema.socialAccounts.handle, socialAccountId: schema.socialAccounts.id,
    contentId: schema.contentItems.id, format: schema.contentItems.format, hook: schema.contentItems.hook, caption: schema.contentItems.caption, media: schema.contentItems.media,
  }).from(schema.scheduledPosts).innerJoin(schema.socialAccounts, eq(schema.socialAccounts.id, schema.scheduledPosts.socialAccountId)).innerJoin(schema.contentItems, eq(schema.contentItems.id, schema.scheduledPosts.contentItemId))
    .leftJoin(schema.automations, eq(schema.automations.id, schema.scheduledPosts.automationId))
    .where(and(eq(schema.scheduledPosts.workspaceId, params.id), gte(schema.scheduledPosts.scheduledAt, from), lte(schema.scheduledPosts.scheduledAt, to))).orderBy(asc(schema.scheduledPosts.scheduledAt));
  return { posts: rows.map((r) => ({ ...r, thumbnail_url: publicUrl(r.media.thumbnail_key), media: undefined })) };
});
