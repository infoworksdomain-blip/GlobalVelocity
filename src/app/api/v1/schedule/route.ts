import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireWorkspace, assertScheduling } from "@/lib/tenancy";
import { scheduleItem } from "@/lib/scheduling";
import { err } from "@/lib/errors";
import { z } from "zod";
const body = z.object({ content_item_id: z.string().uuid(), social_account_ids: z.array(z.string().uuid()).min(1), scheduled_at: z.string().datetime().optional(), queue: z.boolean().optional(), platform_options: z.record(z.any()).default({}), caption_override: z.string().max(3000).optional(), recurrence: z.object({ freq: z.enum(["daily", "weekly"]), weekdays: z.array(z.number().int().min(0).max(6)).optional(), count: z.number().int().min(1).max(52).default(4) }).optional() });
export const POST = route(async ({ actor, body: raw }) => {
  const b = parse(body, raw);
  const item = await db.query.contentItems.findFirst({ where: eq(schema.contentItems.id, b.content_item_id) }); if (!item) throw err(404, "CONTENT_NOT_FOUND", "Content not found");
  const { ws, plan } = await requireWorkspace(actor, item.workspaceId, "editor"); assertScheduling(plan);
  const first = b.scheduled_at ? new Date(b.scheduled_at) : null;
  if (first && first.getTime() < Date.now() - 60_000) throw err(422, "PAST_DATE", "Scheduled time is in the past");
  const posts = await scheduleItem({ workspace: ws, item, socialAccountIds: b.social_account_ids, scheduledAt: first, queue: !!b.queue, platformOptions: b.platform_options, captionOverride: b.caption_override });
  if (b.recurrence && first) {
    const [rec] = await db.insert(schema.recurrences).values({ workspaceId: ws.id, rrule: `FREQ=${b.recurrence.freq.toUpperCase()};COUNT=${b.recurrence.count}${b.recurrence.weekdays ? ";BYDAY=" + b.recurrence.weekdays.join(",") : ""}`, startsAt: first, count: b.recurrence.count }).returning();
    let next = new Date(first); let made = 1;
    while (made < b.recurrence.count) {
      next = new Date(next.getTime() + 86_400_000);
      if (b.recurrence.freq === "weekly" && b.recurrence.weekdays?.length && !b.recurrence.weekdays.includes(next.getUTCDay())) continue;
      if (b.recurrence.freq === "weekly" && !b.recurrence.weekdays?.length && next.getUTCDay() !== first.getUTCDay()) continue;
      const more = await scheduleItem({ workspace: ws, item, socialAccountIds: b.social_account_ids, scheduledAt: next, queue: false, platformOptions: b.platform_options, captionOverride: b.caption_override });
      for (const p of more) await db.update(schema.scheduledPosts).set({ recurrenceId: rec.id }).where(eq(schema.scheduledPosts.id, p.id));
      posts.push(...more); made++;
    }
  }
  return { scheduled_posts: posts };
});
