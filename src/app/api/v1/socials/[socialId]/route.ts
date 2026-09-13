import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireWorkspace, audit } from "@/lib/tenancy";
import { err } from "@/lib/errors";
import { z } from "zod";
async function load(actor: Parameters<typeof requireWorkspace>[0], id: string) { const s = await db.query.socialAccounts.findFirst({ where: eq(schema.socialAccounts.id, id) }); if (!s) throw err(404, "SOCIAL_NOT_FOUND", "Not found"); await requireWorkspace(actor, s.workspaceId, "admin"); return s; }
export const PATCH = route(async ({ actor, params, body }) => {
  const s = await load(actor, params.socialId);
  const b = parse(z.object({ posting_slots: z.array(z.object({ weekday: z.number().int().min(0).max(6), time: z.string().regex(/^\d{2}:\d{2}$/) })).optional() }), body);
  await db.update(schema.socialAccounts).set({ postingSlots: b.posting_slots ?? s.postingSlots }).where(eq(schema.socialAccounts.id, s.id));
  return { ok: true };
});
export const DELETE = route(async ({ actor, params }) => {
  const s = await load(actor, params.socialId);
  await db.update(schema.scheduledPosts).set({ status: "cancelled" }).where(and(eq(schema.scheduledPosts.socialAccountId, s.id), inArray(schema.scheduledPosts.status, ["scheduled", "pending_approval", "held"])));
  await db.delete(schema.socialAccounts).where(eq(schema.socialAccounts.id, s.id));
  await audit({ workspaceId: s.workspaceId, actorId: actor.userId, action: "social.disconnect", meta: { platform: s.platform } });
  return { ok: true };
});
