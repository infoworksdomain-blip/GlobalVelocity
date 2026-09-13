import { route } from "@/lib/route";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { stripe, stripeEnabled } from "@/lib/stripe";
import { err } from "@/lib/errors";
export const POST = route(async ({ actor }) => {
  if (!stripeEnabled()) return { url: "/app/settings/billing?dev=1" };
  const acc = (await db.query.accounts.findFirst({ where: eq(schema.accounts.id, actor.accountId) }))!;
  if (!acc.stripeCustomerId) throw err(409, "NO_CUSTOMER", "No billing account yet");
  const s = await stripe().billingPortal.sessions.create({ customer: acc.stripeCustomerId, return_url: `${process.env.APP_URL}/app/settings/billing` });
  return { url: s.url };
});
