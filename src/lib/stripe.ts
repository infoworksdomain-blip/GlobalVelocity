import Stripe from "stripe";
import { db, schema } from "@/db";
import { eq, and, isNull, count, gt } from "drizzle-orm";
import { PLANS, CREDIT_PACKS } from "@/lib/plans";
import { enqueue } from "@/lib/queue";
import type { Plan } from "@/db/schema";

let s: Stripe | null = null;
export const stripe = () => { if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY not set"); return (s ??= new Stripe(process.env.STRIPE_SECRET_KEY)); };
export const stripeEnabled = () => !!process.env.STRIPE_SECRET_KEY;

export function priceId(plan: Exclude<Plan, "free">, interval: "month" | "year") {
  const id = process.env[`STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`];
  if (!id) throw new Error(`Missing Stripe price for ${plan}/${interval}`);
  return id;
}
export function planFromPrice(price: string): { plan: Plan; interval: "month" | "year" } | null {
  for (const p of ["starter", "growth", "pro"] as const) for (const i of ["month", "year"] as const) if (process.env[`STRIPE_PRICE_${p.toUpperCase()}_${i.toUpperCase()}`] === price) return { plan: p, interval: i };
  return null;
}

export async function ensureCustomer(accountId: string, email: string) {
  const acc = (await db.query.accounts.findFirst({ where: eq(schema.accounts.id, accountId) }))!;
  if (acc.stripeCustomerId) return acc.stripeCustomerId;
  const c = await stripe().customers.create({ email, metadata: { account_id: accountId } });
  await db.update(schema.accounts).set({ stripeCustomerId: c.id }).where(eq(schema.accounts.id, accountId));
  return c.id;
}

/** Apply a plan change: update account, then enforce downgrade rules (FR-18.5): lock extra workspaces. */
export async function applyPlan(accountId: string, plan: Plan, interval: "month" | "year" | null, subscriptionId: string | null, renewsAt: Date | null) {
  await db.update(schema.accounts).set({ plan, billingInterval: interval, stripeSubscriptionId: subscriptionId, planRenewsAt: renewsAt, graceUntil: null }).where(eq(schema.accounts.id, accountId));
  const max = PLANS[plan].limits.workspaces;
  const ws = await db.select().from(schema.workspaces).where(and(eq(schema.workspaces.accountId, accountId), isNull(schema.workspaces.deletedAt))).orderBy(schema.workspaces.createdAt);
  for (let i = 0; i < ws.length; i++) await db.update(schema.workspaces).set({ locked: i >= max }).where(eq(schema.workspaces.id, ws[i].id));
}

export async function handleWebhook(event: Stripe.Event) {
  const st = stripe();
  switch (event.type) {
    case "checkout.session.completed": {
      const cs = event.data.object;
      const accountId = cs.metadata?.account_id; if (!accountId) return;
      if (cs.mode === "payment" && cs.metadata?.credit_pack) {
        const pack = CREDIT_PACKS.find((p) => p.id === cs.metadata!.credit_pack);
        if (pack) await db.insert(schema.creditLedger).values({ accountId, delta: pack.credits, reason: "purchase", refType: "checkout", refId: cs.id }).onConflictDoNothing();
      }
      return;
    }
    case "customer.subscription.created": case "customer.subscription.updated": {
      const sub = event.data.object;
      const acc = await db.query.accounts.findFirst({ where: eq(schema.accounts.stripeCustomerId, String(sub.customer)) }); if (!acc) return;
      const price = sub.items.data[0]?.price.id; const pp = price ? planFromPrice(price) : null;
      const active = ["active", "trialing", "past_due"].includes(sub.status);
      if (active && pp) await applyPlan(acc.id, pp.plan, pp.interval, sub.id, new Date(((sub as unknown as { current_period_end?: number }).current_period_end ?? (sub.items.data[0] as unknown as { current_period_end?: number }).current_period_end ?? Math.floor(Date.now() / 1000) + 30 * 86400) * 1000));
      else if (["canceled", "unpaid", "incomplete_expired"].includes(sub.status)) await applyPlan(acc.id, "free", null, null, null);
      return;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const acc = await db.query.accounts.findFirst({ where: eq(schema.accounts.stripeCustomerId, String(sub.customer)) }); if (acc) await applyPlan(acc.id, "free", null, null, null);
      return;
    }
    case "invoice.paid": {
      const inv = event.data.object;
      const acc = await db.query.accounts.findFirst({ where: eq(schema.accounts.stripeCustomerId, String(inv.customer)) }); if (!acc) return;
      await enqueue("credits.allocate", { accountId: acc.id, invoiceId: inv.id }, { jobId: `credits-${inv.id}` });
      // Affiliate commission (M20): 30% lifetime on referred accounts
      if (acc.affiliateRef && inv.amount_paid > 0) {
        const aff = await db.query.affiliates.findFirst({ where: eq(schema.affiliates.code, acc.affiliateRef) });
        if (aff && aff.userId !== acc.ownerUserId) await db.insert(schema.affiliateCommissions).values({ affiliateId: aff.id, accountId: acc.id, stripeInvoiceId: inv.id!, amountCents: inv.amount_paid, commissionCents: Math.round(inv.amount_paid * aff.commissionPct / 100) }).onConflictDoNothing();
      }
      return;
    }
    case "invoice.payment_failed": {
      const inv = event.data.object;
      const acc = await db.query.accounts.findFirst({ where: eq(schema.accounts.stripeCustomerId, String(inv.customer)) });
      if (acc && !acc.graceUntil) await db.update(schema.accounts).set({ graceUntil: new Date(Date.now() + 7 * 86.4e6) }).where(eq(schema.accounts.id, acc.id)); // dunning grace (FR-18.7)
      return;
    }
  }
  void st;
}
