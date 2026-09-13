import { route } from "@/lib/route";
import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";
export const GET = route(async ({ actor }) => ({ notifications: actor.userId ? await db.select().from(schema.notifications).where(eq(schema.notifications.userId, actor.userId)).orderBy(desc(schema.notifications.createdAt)).limit(50) : [] }));
