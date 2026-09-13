/**
 * End-to-end API test. Runs against a live stack (app + worker + Postgres + Redis) in mock mode.
 *   npm run test:e2e          (uses APP_URL from .env; creates a throwaway account + API key)
 * Exits non-zero on the first failed assertion. Also serves as executable documentation of the core loop.
 */
import "dotenv/config";
import { db, schema, sql } from "@/db";
import { ensureAccountForUser } from "@/lib/tenancy";
import { sha256, randomToken } from "@/lib/crypto";
import { eq } from "drizzle-orm";

const B = `${process.env.APP_URL ?? "http://localhost:3000"}/api/v1`;
let KEY = ""; let passed = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function call<T = Record<string, never>>(method: string, path: string, body?: unknown, raw = false): Promise<T> {
  const r = await fetch(`${B}${path}`, { method, headers: { authorization: `Bearer ${KEY}`, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  if (raw) return r as unknown as T;
  const j = await r.json().catch(() => ({})) as T & { error?: { message: string } };
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${j.error?.message ?? ""}`);
  return j;
}
function check(name: string, cond: unknown, detail?: unknown) { if (!cond) { console.error(`✗ ${name}`, detail ?? ""); process.exit(1); } passed++; console.log(`✓ ${name}`); }
async function until<T>(name: string, fn: () => Promise<T | null>, timeoutMs: number, every = 2000): Promise<T> { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > timeoutMs) throw new Error(`timeout waiting for ${name}`); await sleep(every); } }

async function main() {
  // ---- setup: throwaway user on Growth with an API key ----
  const email = `e2e-${Date.now()}@example.com`;
  const [u] = await db.insert(schema.users).values({ email, name: "E2E", emailVerified: new Date() }).returning();
  const acc = await ensureAccountForUser(u.id); await db.update(schema.accounts).set({ plan: "growth" }).where(eq(schema.accounts.id, acc.id));
  KEY = `sk_test_${randomToken(20)}`; await db.insert(schema.apiKeys).values({ accountId: acc.id, name: "e2e", prefix: KEY.slice(0, 12), keyHash: sha256(KEY), scopes: ["content:read", "content:write", "publish", "analytics:read", "trends:read"] });
  const me = await call<{ account: { plan: string }; workspaces: { id: string }[]; usage: { credits: number } }>("GET", "/me");
  check("me: growth plan, default workspace, 10 credits", me.account.plan === "growth" && me.workspaces.length === 1 && me.usage.credits === 10, me);
  const WS = me.workspaces[0].id;

  // ---- profile ----
  const { job_id } = await call<{ job_id: string }>("POST", `/workspaces/${WS}/profile`, { url: "https://example.com" });
  const job = await until("profile job", async () => { const { job } = await call<{ job: { status: string; error?: string } }>("GET", `/jobs/${job_id}`); return ["done", "failed"].includes(job.status) ? job : null; }, 90_000);
  check("profile analysis completes", job.status === "done", job);
  const prof = await call<{ profile: { data: { product_name: string } } }>("GET", `/workspaces/${WS}/profile`);
  check("profile stored", !!prof.profile?.data.product_name, prof);

  // ---- generation (auto batch of up to 30) ----
  const stack = await until("first candidates", async () => { const s = await call<{ items: { id: string; media: { video_url: string | null; image_urls: string[] } }[]; generating: number }>("GET", `/workspaces/${WS}/blitz?limit=5`); return s.items.length >= 3 ? s : null; }, 240_000, 5000);
  check("blitz returns rendered candidates", stack.items.every((i) => i.media.video_url || i.media.image_urls.length), stack.items.map((i) => i.media));

  // ---- swipe ----
  const a = stack.items[0].id, b = stack.items[1].id;
  await call("POST", `/content/${a}/swipe`, { action: "skip" }); await call("POST", `/content/${a}/swipe`, { action: "undo" });
  const kept = await call<{ item: { status: string } }>("POST", `/content/${a}/swipe`, { action: "keep" });
  check("keep → saved", kept.item.status === "saved");
  const edited = await call<{ item: { hook: string } }>("PATCH", `/content/${a}`, { hook: "E2E edited hook" });
  check("edit copy", edited.item.hook === "E2E edited hook");
  const detail = await call<{ item: { versions: unknown[] } }>("GET", `/content/${a}`);
  check("edit creates a version", detail.item.versions.length === 1);

  // ---- re-render ----
  const rr = await call<{ job_id: string }>("POST", `/content/${a}/rerender`);
  const rj = await until("rerender", async () => { const { job } = await call<{ job: { status: string; error?: string } }>("GET", `/jobs/${rr.job_id}`); return ["done", "failed"].includes(job.status) ? job : null; }, 300_000, 3000);
  check("re-render from edited copy", rj.status === "done", rj);

  // ---- socials (mock OAuth) ----
  const start = await call<Response>("GET", `/socials/connect/tiktok/start?workspace_id=${WS}`, undefined, true);
  const loc = start.headers.get("location") ?? ""; check("connect start redirects to provider", start.status === 307 && loc.includes("/callback?"), loc);
  const cb = await fetch(loc, { redirect: "manual" }); check("callback connects account", cb.status === 307 && (cb.headers.get("location") ?? "").includes("connected=tiktok"));
  const socials = await call<{ socials: { id: string; status: string }[] }>("GET", `/workspaces/${WS}/socials`); check("social account active", socials.socials[0]?.status === "active");
  const SOC = socials.socials[0].id;

  // ---- schedule + publish ----
  const sched = await call<{ scheduled_posts: { id: string; status: string; tracked_link: string }[] }>("POST", "/schedule", { content_item_id: a, social_account_ids: [SOC], queue: true });
  check("schedule to queue", sched.scheduled_posts[0]?.status === "scheduled", sched);
  await call("POST", `/content/${b}/swipe`, { action: "keep" });
  const pub = await call<{ scheduled_posts: { id: string; status: string }[] }>("POST", "/publish", { content_item_id: b, social_account_ids: [SOC] });
  check("publish now → publishing", pub.scheduled_posts[0]?.status === "publishing", pub);
  const published = await until("publish", async () => { const c = await call<{ posts: { id: string; status: string; permalink: string | null }[] }>("GET", `/workspaces/${WS}/calendar`); const p = c.posts.find((x) => x.id === pub.scheduled_posts[0].id); return p?.status === "published" ? p : null; }, 120_000);
  check("post published with permalink", !!published.permalink, published);

  // ---- tracked link + attribution ----
  const slug = sched.scheduled_posts[0].tracked_link.split("/r/")[1];
  const red = await fetch(`${process.env.APP_URL}/r/${slug}`, { redirect: "manual" }); check("tracked link redirects with utm", red.status === 302 && (red.headers.get("location") ?? "").includes("utm_source=tiktok"), red.headers.get("location"));
  const site = await call<{ site: { siteKey: string } }>("POST", `/workspaces/${WS}/tracking`, { domain: "example.com" });
  const ing = await fetch(`${process.env.APP_URL}/api/t/v1`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify([{ site: site.site.siteKey, event: "pageview", click_id: slug }, { site: site.site.siteKey, event: "signup", click_id: slug }]) }).then((r) => r.json()) as { accepted: number };
  check("tracking ingest accepts events", ing.accepted === 2, ing);
  const tr = await call<{ report: { source: string; event: string; count: number }[] }>("GET", `/workspaces/${WS}/tracking`);
  check("attribution credits tiktok via tracked link", tr.report.some((r) => r.source === "tiktok" && r.event === "signup"), tr.report);

  // ---- metrics → analytics ----
  const an = await until("metrics", async () => { const a2 = await call<{ totals: { posts: number; views: number } }>("GET", `/workspaces/${WS}/analytics`); return a2.totals.views > 0 ? a2 : null; }, Number(process.env.METRICS_FIRST_PULL_DELAY_MS ?? 3_600_000) + 60_000, 5000).catch(() => null);
  check("analytics totals populated (requires METRICS_FIRST_PULL_DELAY_MS small)", !!an && an.totals.posts >= 1, an);

  // ---- characters + credits ----
  const ch = await call<{ credits_used: number }>("POST", "/characters", { name: "E2E Char", description: "test", gender: "female" });
  const cr = await call<{ balance: number }>("GET", "/credits"); check("character creation debits 4 credits", ch.credits_used === 4 && cr.balance === 6, cr);

  // ---- automation ----
  const auto = await call<{ automation: { id: string } }>("POST", `/workspaces/${WS}/automations`, { name: "E2E", mode: "one_shot", approval: "auto", config: { social_account_ids: [SOC], posts_per_day: 1, horizon_days: 2, times: ["09:00"], weekdays: [], source: "library", format_mix: { slideshow: 1 } } });
  const prev = await call<{ slots: number }>("POST", `/automations/${auto.automation.id}/preview`); check("automation preview computes slots", prev.slots >= 1, prev);
  await call("POST", `/automations/${auto.automation.id}/run`);
  const run = await until("automation run", async () => { const d = await call<{ runs: { status: string }[] }>("GET", `/automations/${auto.automation.id}`); return d.runs[0] && d.runs[0].status !== "running" ? d.runs[0] : null; }, 60_000);
  check("automation run finishes", ["done", "failed"].includes(run.status), run);

  // ---- ICS, webhooks, plan gates, rate limit ----
  const feed = await call<{ feed_url: string }>("GET", `/workspaces/${WS}/calendar?feed=1`); const ics = await fetch(feed.feed_url).then((r) => r.text()); check("ICS feed has events", ics.includes("BEGIN:VEVENT"));
  const wh = await call<{ secret: string }>("POST", "/webhooks", { url: "http://localhost:3000/api/v1/plans", events: ["*"] }); check("webhook created with secret", wh.secret.startsWith("whsec_"));
  await db.update(schema.accounts).set({ plan: "free" }).where(eq(schema.accounts.id, acc.id));
  const r402 = await call<Response>("POST", "/schedule", { content_item_id: a, social_account_ids: [SOC] }, true); check("free plan: scheduling returns 402", r402.status === 402);
  await db.update(schema.accounts).set({ plan: "starter" }).where(eq(schema.accounts.id, acc.id)); // starter = 60 rpm
  let limited = false; for (let i = 0; i < 70; i++) { const r = await call<Response>("GET", "/me", undefined, true); if (r.status === 429) { limited = true; break; } }
  check("rate limit enforced at plan rpm", limited);

  console.log(`\nAll ${passed} checks passed.`);
  await sql.end(); process.exit(0);
}
main().catch(async (e) => { console.error("E2E failed:", e); await sql.end().catch(() => {}); process.exit(1); });
