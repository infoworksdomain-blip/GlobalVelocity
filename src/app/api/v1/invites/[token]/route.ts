import { route } from "@/lib/route";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { err } from "@/lib/errors";
export const POST = route(async ({ actor, params }) => {
  const m = await db.query.workspaceMembers.findFirst({ where: eq(schema.workspaceMembers.inviteToken, params.token) });
  if (!m || !actor.userId) throw err(404, "INVITE_NOT_FOUND", "Invite not found");
  await db.update(schema.workspaceMembers).set({ userId: actor.userId, acceptedAt: new Date(), inviteToken: null }).where(eq(schema.workspaceMembers.id, m.id));
  return { workspaceId: m.workspaceId };
});
