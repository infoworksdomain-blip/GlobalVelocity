import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { stripe, stripeEnabled, ensureCustomer, priceId, applyPlan } from "@/lib/stripe";
import { CREDIT_PACKS } from "@/lib/plans";
import { err } from "@/lib/errors";
import { z } from "zod";
/** Creates a Stripe Checkout session for a plan or credit pack. Without Stripe keys (dev), applies the plan directly and returns a redirect to billing. */
export const POST = route(async ({ actor, body }) => {
  const b = parse(z.object({ plan: z.enum(["starter", "growth", "pro"]).optional(), interval: z.enum(["month", "year"]).default("month"), credit_pack: z.string().optional() }), body);
  if (!actor.userId) throw err(403, "FORBIDDEN", "Sign in required");
  const user = (await db.query.users.findFirst({ where: eq(schema.users.id, actor.userId) }))!;
  if (!stripeEnabled()) {
    if (b.plan) await applyPlan(actor.accountId, b.plan, b.interval, null, new Date(Date.now() + 30 * 86.4e6));
    if (b.credit_pack) { const p = CREDIT_PACKS.find((x) => x.id === b.credit_pack); if (p) await db.insert(schema.creditLedger).values({ accountId: actor.accountId, delta: p.credits, reason: "purchase", refType: "dev", refId: String(Date.now()) }); }
    return { url: "/app/settings/billing?dev=1", dev_mode: true };
  }
  const customer = await ensureCustomer(actor.accountId, user.email);
  const base = process.env.APP_URL;
  if (b.credit_pack) {
    const p = CREDIT_PACKS.find((x) => x.id === b.credit_pack); if (!p) throw err(400, "VALIDATION", "Unknown pack");
    const s = await stripe().checkout.sessions.create({ mode: "payment", customer, line_items: [{ price_data: { currency: "usd", unit_amount: p.usd * 100, product_data: { name: `${p.credits} AI Studio credits` } }, quantity: 1 }], success_url: `${base}/app/settings/billing?credits=1`, cancel_url: `${base}/app/settings/billing`, metadata: { account_id: actor.accountId, credit_pack: p.id } });
    return { url: s.url };
  }
  if (!b.plan) throw err(400, "VALIDATION", "plan or credit_pack required");
  const s = await stripe().checkout.sessions.create({ mode: "subscription", customer, line_items: [{ price: priceId(b.plan, b.interval), quantity: 1 }], allow_promotion_codes: true, automatic_tax: { enabled: true }, customer_update: { address: "auto" }, success_url: `${base}/app/settings/billing?upgraded=1`, cancel_url: `${base}/pricing`, metadata: { account_id: actor.accountId }, subscription_data: { metadata: { account_id: actor.accountId } } });
  return { url: s.url };
});
