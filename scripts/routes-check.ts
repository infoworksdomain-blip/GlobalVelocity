/**
 * Page & route render check. Fetches every route (marketing, app, API GET) with an authenticated session, verifies status,
 * render markers and error markers, and writes a navigable HTML QA console + JSON.
 *   SESSION_COOKIE="authjs.session-token=..." npx tsx scripts/routes-check.ts [outDir]
 */
import "dotenv/config";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { TOOLS, COMPARE, ALTERNATIVES, INDUSTRIES, BLOG } from "../src/content/site";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const cookie = process.env.SESSION_COOKIE ?? "";
const out = process.argv[2] ?? "qa";
type R = { group: string; path: string; label: string; expectText?: string; kind: "page" | "api" | "asset"; auth?: boolean };

const routes: R[] = [
  // Marketing
  { group: "Marketing", path: "/", label: "Landing", expectText: "Your marketing", kind: "page" },
  { group: "Marketing", path: "/pricing", label: "Pricing", expectText: "Compare plans", kind: "page" },
  { group: "Marketing", path: "/blog", label: "Blog index", expectText: "Blog", kind: "page" },
  ...BLOG.map((b) => ({ group: "Marketing", path: `/blog/${b.slug}`, label: `Blog: ${b.title}`, expectText: b.title, kind: "page" as const })),
  ...TOOLS.map((t) => ({ group: "SEO: Tools", path: `/tools/${t.slug}`, label: t.title, expectText: t.title, kind: "page" as const })),
  ...COMPARE.map((t) => ({ group: "SEO: Compare", path: `/compare/${t.slug}`, label: t.title, expectText: t.title, kind: "page" as const })),
  ...ALTERNATIVES.map((t) => ({ group: "SEO: Alternatives", path: `/alternatives/${t.slug}`, label: t.title, expectText: t.title, kind: "page" as const })),
  ...INDUSTRIES.map((t) => ({ group: "SEO: Industries", path: `/industries/${t.slug}`, label: t.title, expectText: t.title, kind: "page" as const })),
  { group: "Marketing", path: "/developers", label: "API & MCP docs", expectText: "MCP server", kind: "page" },
  { group: "Marketing", path: "/affiliates", label: "Affiliate program", expectText: "30%", kind: "page" },
  { group: "Marketing", path: "/contact", label: "Contact", expectText: "Contact", kind: "page" },
  { group: "Marketing", path: "/careers", label: "Careers", expectText: "Careers", kind: "page" },
  { group: "Marketing", path: "/privacy", label: "Privacy", expectText: "Privacy policy", kind: "page" },
  { group: "Marketing", path: "/terms", label: "Terms", expectText: "Terms of service", kind: "page" },
  { group: "Marketing", path: "/sitemap.xml", label: "Sitemap", expectText: "<urlset", kind: "asset" },
  { group: "Marketing", path: "/robots.txt", label: "Robots", expectText: "Sitemap", kind: "asset" },
  { group: "Marketing", path: "/t.js", label: "Tracking snippet", expectText: "velocity", kind: "asset" },
  { group: "Auth", path: "/login", label: "Login", expectText: "Sign in", kind: "page" },
  // App (authenticated)
  { group: "App", path: "/app", label: "App home (redirects)", kind: "page", auth: true },
  { group: "App", path: "/app/onboarding", label: "Onboarding", kind: "page", auth: true },
  { group: "App", path: "/app/velocity", label: "Velocity", kind: "page", auth: true },
  { group: "App", path: "/app/content", label: "Content library", kind: "page", auth: true },
  { group: "App", path: "/app/studio", label: "Studio", kind: "page", auth: true },
  { group: "App", path: "/app/calendar", label: "Calendar", kind: "page", auth: true },
  { group: "App", path: "/app/automations", label: "Automations", kind: "page", auth: true },
  { group: "App", path: "/app/analytics", label: "Analytics", kind: "page", auth: true },
  { group: "App", path: "/app/trends", label: "Trends", kind: "page", auth: true },
  { group: "App", path: "/app/characters", label: "Characters", kind: "page", auth: true },
  { group: "App", path: "/app/affiliate", label: "Affiliate dashboard", kind: "page", auth: true },
  { group: "App", path: "/app/admin", label: "Admin", kind: "page", auth: true },
  { group: "Settings", path: "/app/settings/profile", label: "Profile & workspace", kind: "page", auth: true },
  { group: "Settings", path: "/app/settings/socials", label: "Social accounts", kind: "page", auth: true },
  { group: "Settings", path: "/app/settings/billing", label: "Billing", kind: "page", auth: true },
  { group: "Settings", path: "/app/settings/members", label: "Team", kind: "page", auth: true },
  { group: "Settings", path: "/app/settings/api", label: "API keys & webhooks", kind: "page", auth: true },
  { group: "Settings", path: "/app/settings/tracking", label: "Website tracking", kind: "page", auth: true },
  // API (GET)
  { group: "API", path: "/api/health", label: "Health", expectText: '"status"', kind: "api" },
  { group: "API", path: "/api/v1/plans", label: "Plans (public)", expectText: '"plans"', kind: "api" },
  { group: "API", path: "/api/v1/models", label: "AI models", expectText: '"models"', kind: "api" },
  { group: "API", path: "/api/v1/openapi", label: "OpenAPI spec", expectText: '"openapi"', kind: "api" },
  { group: "API", path: "/api/mcp", label: "MCP descriptor", expectText: '"tools"', kind: "api" },
  { group: "API", path: "/api/v1/me", label: "Me", expectText: '"account"', kind: "api", auth: true },
  { group: "API", path: "/api/v1/workspaces", label: "Workspaces", expectText: '"workspaces"', kind: "api", auth: true },
  { group: "API", path: "/api/v1/trends?limit=3", label: "Trends", expectText: '"trends"', kind: "api", auth: true },
  { group: "API", path: "/api/v1/characters", label: "Characters", expectText: '"characters"', kind: "api", auth: true },
  { group: "API", path: "/api/v1/ugc-clips", label: "UGC clips", expectText: '"clips"', kind: "api", auth: true },
  { group: "API", path: "/api/v1/credits?ledger=1", label: "Credits", expectText: '"balance"', kind: "api", auth: true },
  { group: "API", path: "/api/v1/api-keys", label: "API keys", expectText: '"keys"', kind: "api", auth: true },
  { group: "API", path: "/api/v1/webhooks", label: "Webhooks", expectText: '"webhooks"', kind: "api", auth: true },
  { group: "API", path: "/api/v1/notifications", label: "Notifications", expectText: '"notifications"', kind: "api", auth: true },
  { group: "API", path: "/api/v1/affiliate", label: "Affiliate", expectText: '"affiliate"', kind: "api", auth: true },
  { group: "API", path: "/api/v1/templates", label: "Templates", expectText: '"templates"', kind: "api", auth: true },
  { group: "API", path: "/api/v1/admin", label: "Admin overview", expectText: '"users"', kind: "api", auth: true },
  { group: "API", path: "/api/v1/admin?view=costs", label: "Admin costs", expectText: '"days"', kind: "api", auth: true },
  { group: "API", path: "/api/v1/admin?view=affiliates", label: "Admin affiliates", expectText: '"payable"', kind: "api", auth: true },
];
const wsRoutes = (ws: string): R[] => [
  { group: "API: workspace", path: `/api/v1/workspaces/${ws}`, label: "Workspace", expectText: '"workspace"', kind: "api", auth: true },
  { group: "API: workspace", path: `/api/v1/workspaces/${ws}/profile`, label: "Profile", expectText: '"profile"', kind: "api", auth: true },
  { group: "API: workspace", path: `/api/v1/workspaces/${ws}/blitz?limit=2`, label: "Velocity stack", expectText: '"items"', kind: "api", auth: true },
  { group: "API: workspace", path: `/api/v1/workspaces/${ws}/content?limit=2`, label: "Content", expectText: '"items"', kind: "api", auth: true },
  { group: "API: workspace", path: `/api/v1/workspaces/${ws}/socials`, label: "Socials", expectText: '"socials"', kind: "api", auth: true },
  { group: "API: workspace", path: `/api/v1/workspaces/${ws}/calendar`, label: "Calendar", expectText: '"posts"', kind: "api", auth: true },
  { group: "API: workspace", path: `/api/v1/workspaces/${ws}/calendar?feed=1`, label: "ICS feed URL", expectText: '"feed_url"', kind: "api", auth: true },
  { group: "API: workspace", path: `/api/v1/workspaces/${ws}/automations`, label: "Automations", expectText: '"automations"', kind: "api", auth: true },
  { group: "API: workspace", path: `/api/v1/workspaces/${ws}/analytics`, label: "Analytics", expectText: '"totals"', kind: "api", auth: true },
  { group: "API: workspace", path: `/api/v1/workspaces/${ws}/tracking`, label: "Tracking", expectText: '"sites"', kind: "api", auth: true },
  { group: "API: workspace", path: `/api/v1/workspaces/${ws}/assets`, label: "Assets", expectText: '"assets"', kind: "api", auth: true },
  { group: "API: workspace", path: `/api/v1/workspaces/${ws}/members`, label: "Members", expectText: '"members"', kind: "api", auth: true },
];

type Result = R & { status: number; ms: number; ok: boolean; note: string; finalUrl: string };
async function check(r: R): Promise<Result> {
  const t0 = Date.now();
  try {
    const res = await fetch(BASE + r.path, { headers: r.auth ? { cookie } : {}, redirect: "follow" });
    const text = await res.text(); const ms = Date.now() - t0;
    // Next.js embeds its not-found boundary in every page's flight data, so only the <title> is a reliable 404/500 signal for HTML.
    const errors = ["<title>404", "<title>500", "Application error: a client-side", "Internal Server Error", '"code":"INTERNAL"'];
    const hit = errors.find((e) => text.includes(e));
    const unescaped = text.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
    const hasExpect = !r.expectText || unescaped.includes(r.expectText);
    // For client-rendered pages, also verify every JS chunk the page references actually loads (catches broken builds/deploys).
    let chunkNote = ""; let chunks = 0;
    if (r.kind === "page" && res.ok) {
      const urls = [...new Set([...text.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]))];
      for (const u of urls) { chunks++; const cr = await fetch(BASE + u, { method: "HEAD" }); if (!cr.ok) { chunkNote = `chunk ${cr.status}: ${u}`; break; } }
    }
    const ok = res.status < 400 && !hit && hasExpect && !chunkNote;
    return { ...r, status: res.status, ms, ok, note: hit ? `error marker: ${hit}` : !hasExpect ? `missing "${r.expectText}"` : chunkNote || (chunks ? `${chunks} JS chunks OK` : ""), finalUrl: res.url };
  } catch (e) { return { ...r, status: 0, ms: Date.now() - t0, ok: false, note: String(e), finalUrl: "" }; }
}
async function main() {
  const me = await fetch(`${BASE}/api/v1/me`, { headers: { cookie } }).then((r) => r.json()).catch(() => null) as { workspaces?: { id: string }[] } | null;
  const ws = me?.workspaces?.[0]?.id; const all = ws ? [...routes, ...wsRoutes(ws)] : routes;
  let content: string | null = null;
  if (ws) { const c = await fetch(`${BASE}/api/v1/workspaces/${ws}/content?limit=1`, { headers: { cookie } }).then((r) => r.json()) as { items?: { id: string }[] }; content = c.items?.[0]?.id ?? null; }
  if (content) { all.push({ group: "App", path: `/app/content/${content}`, label: "Content detail", kind: "page", auth: true }); all.push({ group: "API: workspace", path: `/api/v1/content/${content}`, label: "Content detail API", expectText: '"item"', kind: "api", auth: true }); }
  const results: Result[] = []; for (const r of all) results.push(await check(r));
  const passed = results.filter((r) => r.ok).length;
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "routes.json"), JSON.stringify({ base: BASE, generated: new Date().toISOString(), passed, total: results.length, results }, null, 2));
  writeFileSync(join(out, "index.html"), html(results, passed));
  console.log(`${passed}/${results.length} routes OK → ${out}/index.html`);
  for (const r of results.filter((x) => !x.ok)) console.log("  ✗", r.path, r.status, r.note);
  process.exit(passed === results.length ? 0 : 1);
}
function html(results: Result[], passed: number) {
  const groups = [...new Set(results.map((r) => r.group))];
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Velocity — QA navigation console</title><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--b:#1F3A93;--d:#0B1F4B;--ok:#0f9d58;--bad:#d93025;--bg:#f6f8fb}*{box-sizing:border-box}body{margin:0;font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;background:var(--bg)}
header{background:var(--d);color:#fff;padding:18px 24px;display:flex;flex-wrap:wrap;gap:16px;align-items:center}header h1{margin:0;font-size:20px}header .pill{background:#ffffff22;border-radius:999px;padding:4px 12px;font-size:13px}
.layout{display:grid;grid-template-columns:260px 1fr;min-height:calc(100vh - 62px)}nav{background:#fff;border-right:1px solid #e2e8f0;padding:16px;position:sticky;top:0;height:calc(100vh - 62px);overflow:auto}
nav a{display:block;padding:6px 10px;border-radius:8px;color:#334155;text-decoration:none}nav a:hover{background:#eef3ff;color:var(--b)}nav .g{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;margin:14px 0 4px}
main{padding:20px 24px}section{background:#fff;border:1px solid #e2e8f0;border-radius:14px;margin-bottom:18px;overflow:hidden}section h2{margin:0;padding:12px 16px;font-size:15px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between}
table{width:100%;border-collapse:collapse}td,th{padding:8px 12px;border-top:1px solid #f1f5f9;text-align:left;vertical-align:top}th{font-size:12px;color:#64748b;background:#fff}
.s{display:inline-block;min-width:44px;text-align:center;border-radius:6px;padding:2px 6px;font-weight:700;font-size:12px}.ok{background:#e6f4ea;color:var(--ok)}.bad{background:#fce8e6;color:var(--bad)}
a.p{color:var(--b);font-family:ui-monospace,Menlo,monospace;font-size:12.5px}.note{color:var(--bad);font-size:12px}.ms{color:#94a3b8;font-size:12px}
.toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}.toolbar button,.toolbar input{border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:7px 12px;font:inherit}.toolbar button.primary{background:var(--b);color:#fff;border-color:var(--b)}
iframe{width:100%;height:70vh;border:1px solid #e2e8f0;border-radius:12px;background:#fff}#preview{display:none}#preview.show{display:block}
.flow{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;padding:14px 16px}.flow a{display:block;padding:10px 12px;border:1px solid #e2e8f0;border-radius:10px;text-decoration:none;color:#0f172a;background:#fff}.flow a b{display:block;color:var(--b)}.flow a small{color:#64748b}
@media(max-width:800px){.layout{grid-template-columns:1fr}nav{position:static;height:auto}}
</style></head><body>
<header><h1>Velocity · QA navigation console</h1><span class="pill">${passed}/${results.length} routes OK</span><span class="pill">base ${esc(BASE)}</span><span class="pill">${new Date().toUTCString()}</span></header>
<div class="layout"><nav>${groups.map((g) => `<div class="g">${esc(g)}</div>${results.filter((r) => r.group === g).map((r) => `<a href="#${esc(r.path)}">${r.ok ? "✓" : "✗"} ${esc(r.label)}</a>`).join("")}`).join("")}</nav>
<main>
<div class="toolbar"><input id="base" value="${esc(BASE)}" size="34" title="Base URL for links/preview"><button class="primary" onclick="recheck()">Re-check all routes live</button><button onclick="document.getElementById('preview').classList.toggle('show')">Toggle preview pane</button><span id="live" class="ms"></span></div>
<div id="preview"><iframe id="frame" src="about:blank" title="preview"></iframe></div>
<section><h2>Guided click-through (in order)</h2><div class="flow">
${[["/login","1. Sign in","Magic link — dev link prints in app log"],["/app/onboarding","2. Onboarding","Paste a URL → profile → first batch"],["/app/velocity","3. Velocity mode","Swipe/keys: → keep, ← skip, Z undo, E edit, C schedule"],["/app/content","4. Content","Library, detail, edit, timeline, re-render, download"],["/app/settings/socials","5. Socials","Connect (mock) → posting slots"],["/app/calendar","6. Calendar","Drag to reschedule, approve/retry/cancel, ICS"],["/app/automations","7. Automations","Create → preview → run → runs log"],["/app/analytics","8. Analytics","KPIs, breakdowns, insights, CSV"],["/app/trends","9. Trends","For-my-brand ranking, detail, remix"],["/app/characters","10. Characters","Create (4 credits), consistency pack"],["/app/studio","11. Studio","Targeted batches, uploads, image/video on credits"],["/app/settings/billing","12. Billing","Plan change (dev mode), packs, ledger"],["/app/settings/members","13. Team","Invite → link → accept"],["/app/settings/api","14. API & webhooks","Keys, rate limit, signed webhooks"],["/app/settings/tracking","15. Tracking","Snippet, tracked links, attribution"],["/app/admin","16. Admin","Users, moderation, publishing, affiliates, costs, curation"]].map(([p,t,d]) => `<a href="${esc(p)}" data-p="${esc(p)}" onclick="return open_(this)"><b>${esc(t)}</b><small>${esc(d)}</small></a>`).join("")}
</div></section>
${groups.map((g) => `<section><h2>${esc(g)}<span class="ms">${results.filter((r) => r.group === g && r.ok).length}/${results.filter((r) => r.group === g).length}</span></h2><table><tr><th>Status</th><th>Page</th><th>Route</th><th>Time</th><th>Notes</th></tr>
${results.filter((r) => r.group === g).map((r) => `<tr id="${esc(r.path)}"><td><span class="s ${r.ok ? "ok" : "bad"}" data-s="${esc(r.path)}">${r.status}</span></td><td>${esc(r.label)}${r.auth ? ' <span class="ms">🔒</span>' : ""}</td><td><a class="p" href="${esc(r.path)}" data-p="${esc(r.path)}" onclick="return open_(this)">${esc(r.path)}</a></td><td class="ms">${r.ms} ms</td><td class="${r.ok ? "ms" : "note"}">${esc(r.note)}</td></tr>`).join("")}</table></section>`).join("")}
</main></div>
<script>
const base=()=>document.getElementById('base').value.replace(/\\/$/,'');
function open_(a){const p=a.dataset.p;const pv=document.getElementById('preview');if(pv.classList.contains('show')){document.getElementById('frame').src=base()+p;return false;}a.href=base()+p;a.target='_blank';return true;}
document.querySelectorAll('a[data-p]').forEach(a=>{a.href=base()+a.dataset.p;a.target='_blank';});
async function recheck(){const live=document.getElementById('live');let ok=0,n=0;for(const el of document.querySelectorAll('[data-s]')){n++;const t0=performance.now();try{const r=await fetch(base()+el.dataset.s,{credentials:'include'});el.textContent=r.status;el.className='s '+(r.ok?'ok':'bad');if(r.ok)ok++;}catch(e){el.textContent='ERR';el.className='s bad';}live.textContent=ok+'/'+n+' OK (live, '+Math.round(performance.now()-t0)+'ms last)';}}
</script></body></html>`;
}
main();
