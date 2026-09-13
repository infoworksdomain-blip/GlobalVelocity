import { db, schema } from "@/db";
import { and, eq, gte, inArray } from "drizzle-orm";
import { icsToken } from "@/lib/crypto";
/** Subscribable calendar feed (FR-13.9): /api/v1/workspaces/:id/calendar.ics?token=… (token from GET /calendar?feed=1). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params; const url = new URL(req.url);
  if (url.searchParams.get("token") !== icsToken(id)) return new Response("forbidden", { status: 403 });
  const rows = await db.select({ id: schema.scheduledPosts.id, at: schema.scheduledPosts.scheduledAt, status: schema.scheduledPosts.status, hook: schema.contentItems.hook, platform: schema.socialAccounts.platform }).from(schema.scheduledPosts).innerJoin(schema.contentItems, eq(schema.contentItems.id, schema.scheduledPosts.contentItemId)).innerJoin(schema.socialAccounts, eq(schema.socialAccounts.id, schema.scheduledPosts.socialAccountId)).where(and(eq(schema.scheduledPosts.workspaceId, id), gte(schema.scheduledPosts.scheduledAt, new Date(Date.now() - 30 * 86.4e6)), inArray(schema.scheduledPosts.status, ["scheduled", "pending_approval", "published", "publishing"])));
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Velocity//EN", "X-WR-CALNAME:Velocity posts", ...rows.flatMap((r) => ["BEGIN:VEVENT", `UID:${r.id}@velocity`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(r.at)}`, `DTEND:${f(new Date(r.at.getTime() + 15 * 60_000))}`, `SUMMARY:[${r.platform}] ${(r.hook ?? "Post").replace(/[,;\\]/g, " ")}`, `STATUS:${r.status === "published" ? "CONFIRMED" : "TENTATIVE"}`, "END:VEVENT"]), "END:VCALENDAR"].join("\r\n");
  return new Response(body, { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "no-cache" } });
}
