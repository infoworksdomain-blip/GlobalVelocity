/**
 * Stripe webhook simulator: signs synthetic events with STRIPE_WEBHOOK_SECRET exactly as Stripe does and POSTs them to
 * /api/v1/billing/webhook. Lets you verify the billing state machine (plan apply, workspace locking, credit allocation,
 * dunning, affiliate commissions) with no Stripe account.   npx tsx scripts/stripe-sim.ts <customer_id> [affiliate_code]
 */
import "dotenv/config";
import { createHmac } from "crypto";
const [customer = "cus_TEST1", ref] = process.argv.slice(2);
const url = `${process.env.APP_URL}/api/v1/billing/webhook`; const secret = process.env.STRIPE_WEBHOOK_SECRET!;
async function send(type: string, object: Record<string, unknown>) {
  const body = JSON.stringify({ id: `evt_${Date.now()}`, object: "event", type, created: Math.floor(Date.now() / 1000), data: { object } });
  const t = Math.floor(Date.now() / 1000); const sig = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": `t=${t},v1=${sig}` }, body });
  console.log(type, r.status, await r.text());
}
const now = Math.floor(Date.now() / 1000);
async function main() {
  await send("customer.subscription.created", { id: "sub_1", object: "subscription", customer, status: "active", current_period_end: now + 30 * 86400, items: { data: [{ price: { id: process.env.STRIPE_PRICE_GROWTH_MONTH } }] } });
  await send("invoice.paid", { id: "in_1", object: "invoice", customer, amount_paid: 4900, currency: "usd" });
  await send("invoice.payment_failed", { id: "in_2", object: "invoice", customer });
  await send("customer.subscription.updated", { id: "sub_1", object: "subscription", customer, status: "active", current_period_end: now + 30 * 86400, items: { data: [{ price: { id: process.env.STRIPE_PRICE_STARTER_MONTH } }] } });
  await send("checkout.session.completed", { id: "cs_1", object: "checkout.session", mode: "payment", metadata: { account_id: process.env.SIM_ACCOUNT_ID ?? "", credit_pack: "pack_100" } });
  if (ref) console.log("(affiliate ref:", ref, ")");
  // bad signature must be rejected
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=deadbeef" }, body: "{}" }); console.log("bad signature", r.status);
}
main();
