import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireWorkspace, assertScheduling } from "@/lib/tenancy";
import { scheduleItem } from "@/lib/scheduling";
import { err } from "@/lib/errors";
import { z } from "zod";
export const POST = route(async ({ actor, body }) => {
  const b = parse(z.object({ content_item_id: z.string().uuid(), social_account_ids: z.array(z.string().uuid()).min(1), platform_options: z.record(z.any()).default({}) }), body);
  const item = await db.query.contentItems.findFirst({ where: eq(schema.contentItems.id, b.content_item_id) }); if (!item) throw err(404, "CONTENT_NOT_FOUND", "Content not found");
  const { ws, plan } = await requireWorkspace(actor, item.workspaceId, "editor"); assertScheduling(plan);
  return { scheduled_posts: await scheduleItem({ workspace: ws, item, socialAccountIds: b.social_account_ids, scheduledAt: null, queue: false, platformOptions: b.platform_options, publishNow: true }) };
});
