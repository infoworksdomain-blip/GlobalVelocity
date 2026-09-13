import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireWorkspace } from "@/lib/tenancy";
import { err } from "@/lib/errors";
import { z } from "zod";

export const GET = route(async ({ actor, params }) => { const { ws, role, plan } = await requireWorkspace(actor, params.id); return { workspace: ws, role, plan }; });
export const PATCH = route(async ({ actor, params, body }) => {
  await requireWorkspace(actor, params.id, "admin");
  const b = parse(z.object({ name: z.string().min(1).max(80).optional(), timezone: z.string().max(64).optional() }), body);
  const [ws] = await db.update(schema.workspaces).set(b).where(eq(schema.workspaces.id, params.id)).returning();
  return { workspace: ws };
});
export const DELETE = route(async ({ actor, params }) => {
  const { ws } = await requireWorkspace(actor, params.id, "admin");
  if (ws.accountId !== actor.accountId) throw err(403, "FORBIDDEN", "Only the account owner can delete a workspace");
  await db.update(schema.workspaces).set({ deletedAt: new Date() }).where(eq(schema.workspaces.id, params.id));
  return { ok: true };
});
