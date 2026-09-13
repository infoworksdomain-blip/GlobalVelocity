import { db, schema } from "@/db";
import { and, eq, gte, inArray } from "drizzle-orm";
import { err } from "@/lib/errors";
import { getPublisher } from "@/lib/publishers";
import { publicUrl } from "@/lib/storage";
import { localToUtc } from "@/lib/automations";
import { randomToken } from "@/lib/crypto";
import { enqueue } from "@/lib/queue";
import { emitEvent } from "@/lib/webhooks";

type Ws = typeof schema.workspaces.$inferSelect; type Item = typeof schema.contentItems.$inferSelect;

/** Next free posting slot for an account based on its posting_slots (default Mon–Sun 09:00/13:00/19:00). */
export async function nextFreeSlot(social: typeof schema.socialAccounts.$inferSelect, timezone: string, notBefore = new Date()) {
  const slots = social.postingSlots.length ? social.postingSlots : [1, 2, 3, 4, 5, 6, 0].flatMap((weekday) => ["09:00", "13:00", "19:00"].map((time) => ({ weekday, time })));
  const taken = new Set((await db.select({ at: schema.scheduledPosts.scheduledAt }).from(schema.scheduledPosts).where(and(eq(schema.scheduledPosts.socialAccountId, social.id), gte(schema.scheduledPosts.scheduledAt, notBefore), inArray(schema.scheduledPosts.status, ["scheduled", "pending_approval", "publishing"])))).map((r) => r.at.getTime()));
  const day = new Date(notBefore); day.setUTCHours(0, 0, 0, 0);
  for (let d = 0; d < 60; d++) {
    const dd = new Date(day.getTime() + d * 86_400_000);
    for (const s of slots.filter((s) => s.weekday === dd.getUTCDay()).sort((a, b) => a.time.localeCompare(b.time))) {
      const at = localToUtc(dd, s.time, timezone);
      if (at.getTime() > notBefore.getTime() + 5 * 60_000 && !taken.has(at.getTime())) return at;
    }
  }
  return new Date(notBefore.getTime() + 3.6e6);
}

/** Create scheduled posts for an item across accounts, with schedule-time platform validation (FR-12.4) and idempotency. */
export async function scheduleItem(a: { workspace: Ws; item: Item; socialAccountIds: string[]; scheduledAt: Date | null; queue: boolean; platformOptions: Record<string, unknown>; publishNow?: boolean; automationId?: string; captionOverride?: string }) {
  const socials = await db.select().from(schema.socialAccounts).where(and(eq(schema.socialAccounts.workspaceId, a.workspace.id), inArray(schema.socialAccounts.id, a.socialAccountIds)));
  if (socials.length !== a.socialAccountIds.length) throw err(404, "SOCIAL_NOT_FOUND", "One or more social accounts not found in this workspace");
  if (!a.item.media.video_key && !a.item.media.image_keys?.length) throw err(409, "MEDIA_NOT_READY", "This item has no rendered media yet");
  const created = [];
  for (const s of socials) {
    if (s.status !== "active") throw err(409, "SOCIAL_RECONNECT", `${s.platform} account needs reconnecting`);
    const errors = getPublisher(s.platform).validate({ platform: s.platform, accessToken: "", externalId: s.externalId, mediaUrl: publicUrl(a.item.media.video_key) ?? "", mediaType: a.item.media.video_key ? "video" : "images", imageUrls: [], caption: a.captionOverride ?? a.item.caption ?? "", title: a.item.hook ?? undefined, hashtags: a.item.hashtags, options: a.platformOptions, isAiGenerated: a.item.isAiGenerated });
    if (errors.length) throw err(422, "PLATFORM_VALIDATION", errors.join("; "), { platform: s.platform });
    const at = a.publishNow ? new Date() : a.scheduledAt ?? (await nextFreeSlot(s, a.workspace.timezone));
    const [link] = await db.insert(schema.trackedLinks).values({ workspaceId: a.workspace.id, slug: randomToken(5).replace(/[^a-zA-Z0-9]/g, "").slice(0, 7) || randomToken(6), destinationUrl: "" }).returning();
    const [post] = await db.insert(schema.scheduledPosts).values({ workspaceId: a.workspace.id, contentItemId: a.item.id, socialAccountId: s.id, scheduledAt: at, timezone: a.workspace.timezone, platformOptions: a.platformOptions, captionOverride: a.captionOverride, status: "scheduled", automationId: a.automationId, trackedLinkId: link.id, idempotencyKey: `${a.item.id}-${s.id}-${at.toISOString()}` }).onConflictDoNothing().returning();
    if (!post) continue;
    await db.update(schema.trackedLinks).set({ scheduledPostId: post.id }).where(eq(schema.trackedLinks.id, link.id));
    if (a.publishNow) { await db.update(schema.scheduledPosts).set({ status: "publishing" }).where(eq(schema.scheduledPosts.id, post.id)); await enqueue("publish.post", { postId: post.id }); }
    created.push({ ...post, status: a.publishNow ? ("publishing" as const) : post.status, platform: s.platform, handle: s.handle, tracked_link: `${process.env.APP_URL}/r/${link.slug}` });
  }
  if (created.length) { await db.update(schema.contentItems).set({ status: "scheduled", updatedAt: new Date() }).where(eq(schema.contentItems.id, a.item.id)); await emitEvent(a.workspace.accountId, "post.scheduled", { content_item_id: a.item.id, posts: created.map((p) => ({ id: p.id, platform: p.platform, scheduled_at: p.scheduledAt })) }); }
  return created;
}
