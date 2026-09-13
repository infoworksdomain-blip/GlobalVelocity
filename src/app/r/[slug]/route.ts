import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, and, sql } from "drizzle-orm";
/** Tracked short link: /r/:slug → destination with UTM + click id (FR-16.3). */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const link = await db.query.trackedLinks.findFirst({ where: eq(schema.trackedLinks.slug, slug) });
  if (!link) return NextResponse.redirect(process.env.APP_URL ?? "/");
  await db.update(schema.trackedLinks).set({ clicks: sql`${schema.trackedLinks.clicks} + 1` }).where(eq(schema.trackedLinks.id, link.id));
  let dest = link.destinationUrl;
  if (!dest) { const ws = await db.query.workspaces.findFirst({ where: eq(schema.workspaces.id, link.workspaceId) }); const prof = ws && await db.query.companyProfiles.findFirst({ where: and(eq(schema.companyProfiles.workspaceId, ws.id), eq(schema.companyProfiles.isCurrent, true)) }); dest = prof?.websiteUrl ?? process.env.APP_URL ?? "/"; }
  const post = link.scheduledPostId ? await db.select({ platform: schema.socialAccounts.platform }).from(schema.scheduledPosts).innerJoin(schema.socialAccounts, eq(schema.socialAccounts.id, schema.scheduledPosts.socialAccountId)).where(eq(schema.scheduledPosts.id, link.scheduledPostId)).then((r) => r[0]) : null;
  const u = new URL(dest); u.searchParams.set("utm_source", post?.platform ?? "social"); u.searchParams.set("utm_medium", "social"); u.searchParams.set("utm_campaign", "velocity"); u.searchParams.set("vcid", slug);
  return NextResponse.redirect(u.toString(), 302);
}
