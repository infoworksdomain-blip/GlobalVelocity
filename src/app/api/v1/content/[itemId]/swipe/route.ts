import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { eq, and, desc } from "drizzle-orm";
import { requireWorkspace, assertCanSave, assertScheduling, audit } from "@/lib/tenancy";
import { err } from "@/lib/errors";
import { scheduleItem } from "@/lib/scheduling";
import { serializeItem } from "@/lib/content";
import { emitEvent } from "@/lib/webhooks";
import { z } from "zod";

/** Swipe: keep (→ saved, optional schedule), skip, undo (FR-5.2/5.3). */
export const POST = route(async ({ actor, params, body }) => {
  const item = await db.query.contentItems.findFirst({ where: eq(schema.contentItems.id, params.itemId) });
  if (!item) throw err(404, "CONTENT_NOT_FOUND", "Content not found");
  const { ws, plan } = await requireWorkspace(actor, item.workspaceId, "editor");
  const b = parse(z.object({ action: z.enum(["keep", "skip", "undo"]), schedule: z.object({ social_account_ids: z.array(z.string().uuid()).min(1), scheduled_at: z.string().datetime().optional(), queue: z.boolean().optional(), platform_options: z.record(z.any()).optional() }).optional() }), body);
  if (b.action === "undo") {
    const last = await db.query.swipeEvents.findFirst({ where: and(eq(schema.swipeEvents.contentItemId, item.id), eq(schema.swipeEvents.workspaceId, ws.id)), orderBy: desc(schema.swipeEvents.createdAt) });
    if (!last || last.action === "undo") throw err(409, "NOTHING_TO_UNDO", "Nothing to undo");
    await db.update(schema.contentItems).set({ status: "candidate", savedAt: null, updatedAt: new Date() }).where(eq(schema.contentItems.id, item.id));
    await db.insert(schema.swipeEvents).values({ workspaceId: ws.id, userId: actor.userId ?? "00000000-0000-0000-0000-000000000000", contentItemId: item.id, action: "undo" });
    return { item: serializeItem({ ...item, status: "candidate" }) };
  }
  if (item.status !== "candidate") throw err(409, "NOT_CANDIDATE", "Item is not in the Blitz stack");
  if (b.action === "skip") {
    await db.update(schema.contentItems).set({ status: "skipped", updatedAt: new Date() }).where(eq(schema.contentItems.id, item.id));
    await db.insert(schema.swipeEvents).values({ workspaceId: ws.id, userId: actor.userId ?? "00000000-0000-0000-0000-000000000000", contentItemId: item.id, action: "skip" });
    return { item: serializeItem({ ...item, status: "skipped" }) };
  }
  await assertCanSave(ws.accountId, plan);
  await db.update(schema.contentItems).set({ status: "saved", savedAt: new Date(), updatedAt: new Date() }).where(eq(schema.contentItems.id, item.id));
  await db.insert(schema.swipeEvents).values({ workspaceId: ws.id, userId: actor.userId ?? "00000000-0000-0000-0000-000000000000", contentItemId: item.id, action: "keep" });
  await audit({ accountId: ws.accountId, workspaceId: ws.id, actorId: actor.userId, action: "content.keep", targetType: "content", targetId: item.id });
  await emitEvent(ws.accountId, "content.saved", { content_item_id: item.id, workspace_id: ws.id, format: item.format, hook: item.hook });
  let posts: unknown[] = [];
  if (b.schedule) { assertScheduling(plan); posts = await scheduleItem({ workspace: ws, item: { ...item, status: "saved" }, socialAccountIds: b.schedule.social_account_ids, scheduledAt: b.schedule.scheduled_at ? new Date(b.schedule.scheduled_at) : null, queue: !!b.schedule.queue, platformOptions: b.schedule.platform_options ?? {} }); }
  return { item: serializeItem({ ...item, status: posts.length ? "scheduled" : "saved" }), scheduled_posts: posts };
});
