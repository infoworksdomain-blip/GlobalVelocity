import { NextResponse } from "next/server";
import { stripe, handleWebhook } from "@/lib/stripe";
export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature") ?? ""; const raw = await req.text();
  let event; try { event = stripe().webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET!); } catch (e) { return NextResponse.json({ error: String(e) }, { status: 400 }); }
  await handleWebhook(event);
  return NextResponse.json({ received: true });
}
