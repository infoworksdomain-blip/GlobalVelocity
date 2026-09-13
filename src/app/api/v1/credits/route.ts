import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";
import { creditBalance } from "@/lib/tenancy";
import { CREDIT_TARIFF, CREDIT_PACKS, PLANS } from "@/lib/plans";
import { z } from "zod";
export const GET = route(async ({ actor, url }) => {
  const acc = (await db.query.accounts.findFirst({ where: eq(schema.accounts.id, actor.accountId) }))!;
  const ledger = url.searchParams.get("ledger") ? await db.select().from(schema.creditLedger).where(eq(schema.creditLedger.accountId, actor.accountId)).orderBy(desc(schema.creditLedger.createdAt)).limit(100) : undefined;
  return { balance: await creditBalance(actor.accountId), monthly_allocation: PLANS[acc.plan].limits.creditsMonthly, renews_at: acc.planRenewsAt, tariff: CREDIT_TARIFF, packs: CREDIT_PACKS, ledger };
});
/** POST = cost estimate for a job spec (FR-9.3 "shows credit estimate before confirm"). */
export const POST = route(async ({ body }) => {
  const b = parse(z.object({ images: z.number().int().min(0).default(0), video_seconds: z.number().min(0).default(0) }), body);
  return { credits: b.images * CREDIT_TARIFF.image + Math.ceil(b.video_seconds) * CREDIT_TARIFF.videoPerSecond };
});
