import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { eq, desc, sql } from "drizzle-orm";
import { err } from "@/lib/errors";
import { z } from "zod";
export const GET = route(async ({ actor }) => {
  if (!actor.userId) throw err(403, "FORBIDDEN", "Sign in required");
  const aff = await db.query.affiliates.findFirst({ where: eq(schema.affiliates.userId, actor.userId) });
  if (!aff) return { affiliate: null };
  const [stats] = await db.select({ referred: sql<number>`count(distinct ${schema.affiliateCommissions.accountId})::int`, earned: sql<number>`coalesce(sum(${schema.affiliateCommissions.commissionCents}),0)::int`, pending: sql<number>`coalesce(sum(case when status='pending' then commission_cents else 0 end),0)::int`, paid: sql<number>`coalesce(sum(case when status='paid' then commission_cents else 0 end),0)::int` }).from(schema.affiliateCommissions).where(eq(schema.affiliateCommissions.affiliateId, aff.id));
  const [signups] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.accounts).where(eq(schema.accounts.affiliateRef, aff.code));
  return { affiliate: { ...aff, link: `${process.env.APP_URL}/?ref=${aff.code}` }, stats: { ...stats, signups: signups.n }, commissions: await db.select().from(schema.affiliateCommissions).where(eq(schema.affiliateCommissions.affiliateId, aff.id)).orderBy(desc(schema.affiliateCommissions.createdAt)).limit(100) };
});
export const POST = route(async ({ actor, body }) => {
  if (!actor.userId) throw err(403, "FORBIDDEN", "Sign in required");
  const b = parse(z.object({ code: z.string().min(3).max(24).regex(/^[a-z0-9-]+$/i), payout_email: z.string().email().optional() }), body);
  const [aff] = await db.insert(schema.affiliates).values({ userId: actor.userId, code: b.code.toLowerCase(), payoutEmail: b.payout_email }).onConflictDoNothing().returning();
  if (!aff) throw err(409, "CODE_TAKEN", "That code is taken or you already have an affiliate account");
  return { affiliate: { ...aff, link: `${process.env.APP_URL}/?ref=${aff.code}` } };
});
