import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
/** Public event ingest for the tracking snippet + server-side events (FR-16.1/16.6). CORS open; site key required. */
const ev = z.object({ site: z.string(), sid: z.string().max(64).optional(), event: z.string().max(40), path: z.string().max(500).optional(), referrer: z.string().max(1000).optional(), utm: z.record(z.string()).optional(), click_id: z.string().max(64).optional(), device: z.string().max(20).optional(), value: z.number().optional(), currency: z.string().max(3).optional(), order_id: z.string().max(100).optional(), props: z.record(z.any()).optional(), ts: z.string().optional() });
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST, OPTIONS" };
export async function OPTIONS() { return new Response(null, { headers: cors }); }
export async function POST(req: Request) {
  const body = await req.json().catch(() => null); const events = Array.isArray(body) ? body : [body];
  let ok = 0;
  for (const raw of events) {
    const r = ev.safeParse(raw); if (!r.success) continue; const e = r.data;
    const site = await db.query.trackingSites.findFirst({ where: eq(schema.trackingSites.siteKey, e.site) }); if (!site) continue;
    if (!site.verifiedAt) await db.update(schema.trackingSites).set({ verifiedAt: new Date() }).where(eq(schema.trackingSites.id, site.id));
    const link = e.click_id ? await db.query.trackedLinks.findFirst({ where: eq(schema.trackedLinks.slug, e.click_id) }) : null;
    await db.insert(schema.trackingEvents).values({ siteId: site.id, occurredAt: e.ts ? new Date(e.ts) : new Date(), sessionId: e.sid, event: e.event, path: e.path, referrer: e.referrer, utm: e.utm, clickId: e.click_id, trackedLinkId: link?.id, device: e.device, country: req.headers.get("cf-ipcountry") ?? req.headers.get("x-vercel-ip-country") ?? undefined, value: e.value?.toString(), currency: e.currency, orderId: e.order_id, props: e.props });
    ok++;
  }
  return NextResponse.json({ accepted: ok }, { headers: cors });
}
