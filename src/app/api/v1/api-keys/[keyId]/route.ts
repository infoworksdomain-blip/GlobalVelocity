import { route } from "@/lib/route";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
export const DELETE = route(async ({ actor, params }) => { await db.update(schema.apiKeys).set({ revokedAt: new Date() }).where(and(eq(schema.apiKeys.id, params.keyId), eq(schema.apiKeys.accountId, actor.accountId))); return { ok: true }; });
