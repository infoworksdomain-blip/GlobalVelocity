import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { and, eq, isNull } from "drizzle-orm";
import { creditBalance, countSaves } from "@/lib/tenancy";
import { PLANS } from "@/lib/plans";
import { z } from "zod";

export const GET = route(async ({ actor }) => {
  const user = actor.userId ? await db.query.users.findFirst({ where: eq(schema.users.id, actor.userId), columns: { id: true, email: true, name: true, image: true, timezone: true, notificationPrefs: true } }) : null;
  const acc = (await db.query.accounts.findFirst({ where: eq(schema.accounts.id, actor.accountId) }))!;
  const ws = actor.userId
    ? await db.select({ id: schema.workspaces.id, name: schema.workspaces.name, slug: schema.workspaces.slug, locked: schema.workspaces.locked, timezone: schema.workspaces.timezone, role: schema.workspaceMembers.role }).from(schema.workspaces).innerJoin(schema.workspaceMembers, eq(schema.workspaceMembers.workspaceId, schema.workspaces.id)).where(and(eq(schema.workspaceMembers.userId, actor.userId), isNull(schema.workspaces.deletedAt)))
    : await db.select({ id: schema.workspaces.id, name: schema.workspaces.name, slug: schema.workspaces.slug, locked: schema.workspaces.locked, timezone: schema.workspaces.timezone }).from(schema.workspaces).where(and(eq(schema.workspaces.accountId, actor.accountId), isNull(schema.workspaces.deletedAt)));
  const [credits, saves] = await Promise.all([creditBalance(actor.accountId), countSaves(actor.accountId)]);
  return { user, account: { id: acc.id, plan: acc.plan, billingInterval: acc.billingInterval, planRenewsAt: acc.planRenewsAt, graceUntil: acc.graceUntil }, plan: PLANS[acc.plan], usage: { credits, saves }, workspaces: ws, isPlatformAdmin: actor.isPlatformAdmin, mode: process.env.PROVIDER_MODE ?? "mock" };
});
export const PATCH = route(async ({ actor, body }) => {
  const b = parse(z.object({ name: z.string().max(80).optional(), timezone: z.string().max(64).optional(), notificationPrefs: z.record(z.boolean()).optional() }), body);
  if (!actor.userId) return { ok: false };
  await db.update(schema.users).set(b).where(eq(schema.users.id, actor.userId));
  return { ok: true };
});
export const DELETE = route(async ({ actor }) => {
  await db.update(schema.accounts).set({ deletedAt: new Date() }).where(eq(schema.accounts.id, actor.accountId)); // purged after 30 days by cleanup job
  return { ok: true, purge_after_days: 30 };
});
