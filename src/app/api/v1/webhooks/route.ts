import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";
import { limits } from "@/lib/tenancy";
import { planLimit, err } from "@/lib/errors";
import { randomToken } from "@/lib/crypto";
import { WEBHOOK_EVENTS } from "@/lib/webhooks";
import { z } from "zod";
export const GET = route(async ({ actor }) => ({ webhooks: await db.select({ id: schema.webhooks.id, url: schema.webhooks.url, events: schema.webhooks.events, enabled: schema.webhooks.enabled, createdAt: schema.webhooks.createdAt }).from(schema.webhooks).where(eq(schema.webhooks.accountId, actor.accountId)), events: WEBHOOK_EVENTS }));
export const POST = route(async ({ actor, body }) => {
  if (limits(actor.plan).apiRpm === 0) throw planLimit("PLAN_API_ACCESS", "Webhooks require a paid plan");
  const b = parse(z.object({ url: z.string().url().refine((u) => u.startsWith("https://") || process.env.NODE_ENV !== "production" || (process.env.APP_URL ?? "").startsWith("http://localhost") || process.env.ALLOW_HTTP_WEBHOOKS === "1", "https required"), events: z.array(z.enum([...WEBHOOK_EVENTS, "*"])).min(1) }), body);
  const secret = "whsec_" + randomToken(24);
  const [w] = await db.insert(schema.webhooks).values({ accountId: actor.accountId, url: b.url, secret, events: b.events }).returning();
  return { webhook: { id: w.id, url: w.url, events: w.events, enabled: w.enabled }, secret, note: "Verify with HMAC-SHA256 of `${t}.${body}` using this secret (header x-velocity-signature: t=…,v1=…)." };
});
export const DELETE = route(async ({ actor, url }) => { const id = url.searchParams.get("id"); if (!id) throw err(400, "VALIDATION", "id required"); await db.delete(schema.webhooks).where(and(eq(schema.webhooks.id, id), eq(schema.webhooks.accountId, actor.accountId))); return { ok: true }; });
