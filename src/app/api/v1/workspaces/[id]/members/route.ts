import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";
import { requireWorkspace, limits, audit } from "@/lib/tenancy";
import { planLimit, err } from "@/lib/errors";
import { randomToken } from "@/lib/crypto";
import { z } from "zod";

export const GET = route(async ({ actor, params }) => {
  await requireWorkspace(actor, params.id, "admin");
  const rows = await db.select({ id: schema.workspaceMembers.id, role: schema.workspaceMembers.role, invitedEmail: schema.workspaceMembers.invitedEmail, acceptedAt: schema.workspaceMembers.acceptedAt, email: schema.users.email, name: schema.users.name }).from(schema.workspaceMembers).leftJoin(schema.users, eq(schema.users.id, schema.workspaceMembers.userId)).where(eq(schema.workspaceMembers.workspaceId, params.id));
  return { members: rows };
});
export const POST = route(async ({ actor, params, body }) => {
  const { plan } = await requireWorkspace(actor, params.id, "admin");
  if (!limits(plan).teamInvites) throw planLimit("PLAN_TEAM", "Team invites require a paid plan");
  const b = parse(z.object({ email: z.string().email(), role: z.enum(["admin", "editor", "viewer"]) }), body);
  const token = randomToken();
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, b.email) });
  await db.insert(schema.workspaceMembers).values({ workspaceId: params.id, userId: existing?.id, role: b.role, invitedEmail: b.email, inviteToken: token });
  await audit({ workspaceId: params.id, actorId: actor.userId, action: "member.invite", meta: { email: b.email, role: b.role } });
  const link = `${process.env.APP_URL}/invite/${token}`;
  console.log(`[invite] ${b.email} -> ${link}`); // replace with transactional email in live mode
  return { ok: true, invite_link: link };
});
export const DELETE = route(async ({ actor, params, url }) => {
  await requireWorkspace(actor, params.id, "admin");
  const memberId = url.searchParams.get("memberId"); if (!memberId) throw err(400, "VALIDATION", "memberId required");
  await db.delete(schema.workspaceMembers).where(and(eq(schema.workspaceMembers.id, memberId), eq(schema.workspaceMembers.workspaceId, params.id)));
  return { ok: true };
});
