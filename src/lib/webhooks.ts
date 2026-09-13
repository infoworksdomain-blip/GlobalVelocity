import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";
import { enqueue } from "@/lib/queue";
import { createHmac } from "crypto";

export const WEBHOOK_EVENTS = ["batch.completed", "content.saved", "post.scheduled", "post.published", "post.failed", "automation.ran"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/** Fan an event out to every enabled webhook on the account that subscribes to it (FR-19.3). Delivery happens in the worker with retries. */
export async function emitEvent(accountId: string, event: WebhookEvent, payload: Record<string, unknown>) {
  const hooks = await db.select().from(schema.webhooks).where(and(eq(schema.webhooks.accountId, accountId), eq(schema.webhooks.enabled, true)));
  for (const h of hooks) if (h.events.includes(event) || h.events.includes("*")) await enqueue("webhook.deliver", { webhookId: h.id, event, payload, id: crypto.randomUUID() }, { attempts: 5, backoff: { type: "exponential", delay: 60_000 } });
}
export function sign(secret: string, body: string, ts: number) { return createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex"); }
export async function deliver(webhookId: string, event: string, payload: Record<string, unknown>, id: string) {
  const h = await db.query.webhooks.findFirst({ where: eq(schema.webhooks.id, webhookId) }); if (!h || !h.enabled) return;
  const body = JSON.stringify({ id, event, created_at: new Date().toISOString(), data: payload }); const ts = Math.floor(Date.now() / 1000);
  const r = await fetch(h.url, { method: "POST", headers: { "content-type": "application/json", "x-velocity-event": event, "x-velocity-signature": `t=${ts},v1=${sign(h.secret, body, ts)}` }, body, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`Webhook ${h.url} responded ${r.status}`);
}
