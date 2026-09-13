import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { and, eq, isNull } from "drizzle-orm";
import { assertCanCreateWorkspace, audit } from "@/lib/tenancy";
import { z } from "zod";

export const GET = route(async ({ actor }) => ({ workspaces: await db.select().from(schema.workspaces).where(and(eq(schema.workspaces.accountId, actor.accountId), isNull(schema.workspaces.deletedAt))) }));
export const POST = route(async ({ actor, body }) => {
  const b = parse(z.object({ name: z.string().min(1).max(80), timezone: z.string().default("UTC") }), body);
  await assertCanCreateWorkspace(actor.accountId, actor.plan);
  const slug = b.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Math.random().toString(36).slice(2, 6);
  const [ws] = await db.insert(schema.workspaces).values({ accountId: actor.accountId, name: b.name, slug, timezone: b.timezone }).returning();
  if (actor.userId) await db.insert(schema.workspaceMembers).values({ workspaceId: ws.id, userId: actor.userId, role: "admin", acceptedAt: new Date() });
  await audit({ accountId: actor.accountId, workspaceId: ws.id, actorId: actor.userId, action: "workspace.create" });
  return { workspace: ws };
});
