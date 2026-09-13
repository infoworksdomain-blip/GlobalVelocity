import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireWorkspace } from "@/lib/tenancy";
import { err } from "@/lib/errors";
import { enqueue } from "@/lib/queue";
import { z } from "zod";
async function load(actor: Parameters<typeof requireWorkspace>[0], id: string) { const p = await db.query.scheduledPosts.findFirst({ where: eq(schema.scheduledPosts.id, id) }); if (!p) throw err(404, "POST_NOT_FOUND", "Not found"); const ctx = await requireWorkspace(actor, p.workspaceId, "editor"); return { p, ...ctx }; }
export const PATCH = route(async ({ actor, params, body }) => {
  const { p } = await load(actor, params.postId);
  const b = parse(z.object({ scheduled_at: z.string().datetime().optional(), caption_override: z.string().max(3000).nullable().optional(), platform_options: z.record(z.any()).optional(), approve: z.boolean().optional(), retry: z.boolean().optional() }), body);
  if (!["scheduled", "pending_approval", "failed", "held", "draft"].includes(p.status)) throw err(409, "NOT_EDITABLE", `Post is ${p.status}`);
  const patch: Partial<typeof schema.scheduledPosts.$inferInsert> = { updatedAt: new Date() };
  if (b.scheduled_at) patch.scheduledAt = new Date(b.scheduled_at);
  if (b.caption_override !== undefined) patch.captionOverride = b.caption_override;
  if (b.platform_options) patch.platformOptions = b.platform_options;
  if (b.approve && p.status === "pending_approval") patch.status = "scheduled";
  if (b.retry && ["failed", "held"].includes(p.status)) { patch.status = "scheduled"; patch.attempts = 0; patch.lastError = null; if (!b.scheduled_at) patch.scheduledAt = new Date(); }
  const [post] = await db.update(schema.scheduledPosts).set(patch).where(eq(schema.scheduledPosts.id, p.id)).returning();
  if (b.retry && post.scheduledAt.getTime() <= Date.now()) { await db.update(schema.scheduledPosts).set({ status: "publishing" }).where(eq(schema.scheduledPosts.id, p.id)); await enqueue("publish.post", { postId: p.id }); }
  return { post };
});
export const DELETE = route(async ({ actor, params }) => {
  const { p } = await load(actor, params.postId);
  if (["published", "publishing"].includes(p.status)) throw err(409, "NOT_CANCELLABLE", "Post already published or publishing");
  await db.update(schema.scheduledPosts).set({ status: "cancelled", updatedAt: new Date() }).where(eq(schema.scheduledPosts.id, p.id));
  return { ok: true };
});
