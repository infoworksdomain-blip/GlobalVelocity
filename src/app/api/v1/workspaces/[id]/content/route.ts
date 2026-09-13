import { route } from "@/lib/route";
import { db, schema } from "@/db";
import { and, eq, desc, isNull, inArray, ilike, lt, or } from "drizzle-orm";
import { requireWorkspace } from "@/lib/tenancy";
import { serializeItem } from "@/lib/content";

export const GET = route(async ({ actor, params, url }) => {
  const { ws } = await requireWorkspace(actor, params.id);
  const q = url.searchParams; const limit = Math.min(100, Number(q.get("limit") ?? 24)); const cursor = q.get("cursor");
  const statuses = (q.get("status")?.split(",") ?? ["saved", "draft", "scheduled", "published", "failed"]) as schema.ContentStatus[];
  const where = and(eq(schema.contentItems.workspaceId, ws.id), isNull(schema.contentItems.deletedAt), inArray(schema.contentItems.status, statuses),
    q.get("format") ? eq(schema.contentItems.format, q.get("format") as schema.ContentFormat) : undefined,
    q.get("character_id") ? eq(schema.contentItems.characterId, q.get("character_id")!) : undefined,
    q.get("q") ? or(ilike(schema.contentItems.hook, `%${q.get("q")}%`), ilike(schema.contentItems.caption, `%${q.get("q")}%`)) : undefined,
    cursor ? lt(schema.contentItems.createdAt, new Date(cursor)) : undefined);
  const items = await db.select().from(schema.contentItems).where(where).orderBy(desc(schema.contentItems.createdAt)).limit(limit + 1);
  const next = items.length > limit ? items[limit - 1].createdAt.toISOString() : null;
  return { items: items.slice(0, limit).map((i) => serializeItem(i)), next_cursor: next };
});
