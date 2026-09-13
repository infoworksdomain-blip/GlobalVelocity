import { route } from "@/lib/route";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
export const PATCH = route(async ({ actor, params }) => { if (actor.userId) await db.update(schema.notifications).set({ readAt: new Date() }).where(and(eq(schema.notifications.id, params.id), eq(schema.notifications.userId, actor.userId))); return { ok: true }; });
