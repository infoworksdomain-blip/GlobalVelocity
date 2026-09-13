import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
const token = readFileSync("/tmp/session.txt", "utf8").trim();
const B = "http://localhost:3000";
const PAGES = [
  ["landing", "/"], ["pricing", "/pricing"], ["blog", "/blog"], ["blog-post", "/blog/how-to-post-daily-without-burning-out"], ["tool", "/tools/ai-ugc-video-generator"], ["compare", "/compare/velocity-vs-buffer"], ["industry", "/industries/saas"], ["developers", "/developers"], ["affiliates", "/affiliates"], ["faq", "/faq"], ["contact", "/contact"], ["privacy", "/privacy"], ["terms", "/terms"], ["notfound", "/this-page-does-not-exist"], ["login", "/login"],
  ["app-onboarding", "/app/onboarding"], ["app-velocity", "/app/velocity"], ["app-content", "/app/content"], ["app-content-detail", "CONTENT"], ["app-studio", "/app/studio"], ["app-calendar", "/app/calendar"], ["app-automations", "/app/automations"], ["app-analytics", "/app/analytics"], ["app-trends", "/app/trends"], ["app-characters", "/app/characters"], ["app-affiliate", "/app/affiliate"], ["app-admin", "/app/admin"], ["app-admin-accounts", "/app/admin#accounts"], ["app-admin-keys", "/app/admin#keys"], ["app-admin-integrations", "/app/admin#integrations"],
  ["settings-profile", "/app/settings/profile"], ["settings-socials", "/app/settings/socials"], ["settings-billing", "/app/settings/billing"], ["settings-members", "/app/settings/members"], ["settings-api", "/app/settings/api"], ["settings-tracking", "/app/settings/tracking"],
];
mkdirSync("out", { recursive: true });
const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, "--no-sandbox"], headless: true, defaultViewport: { width: 1280, height: 800 } });
const page = await browser.newPage();
await page.setCookie({ name: "authjs.session-token", value: token, domain: "localhost", path: "/" });
const errors = {}; page.on("pageerror", (e) => { (errors[page.url()] ??= []).push(String(e)); }); page.on("console", (m) => { if (m.type() === "error") (errors[page.url()] ??= []).push(m.text()); });
const me = await (await fetch(`${B}/api/v1/me`, { headers: { cookie: `authjs.session-token=${token}` } })).json();
const ws = me.workspaces[0].id; const c = await (await fetch(`${B}/api/v1/workspaces/${ws}/content?limit=1`, { headers: { cookie: `authjs.session-token=${token}` } })).json(); const contentId = c.items[0]?.id;
const results = [];
for (const [name, p] of PAGES) {
  const path = p === "CONTENT" ? `/app/content/${contentId}` : p;
  try {
    const [base, tab] = path.split("#");
    await page.goto(B + base, { waitUntil: "networkidle0", timeout: 90000 });
    if (tab) { await page.evaluate((t) => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim().toLowerCase().startsWith(t)); b?.click(); }, tab === "keys" ? "keys" : tab); await new Promise((r) => setTimeout(r, 2500)); }
    await new Promise((r) => setTimeout(r, 1400));
    const h1 = await page.evaluate(() => document.querySelector("h1")?.textContent?.trim() ?? "");
    const spinner = await page.evaluate(() => !!document.querySelector(".animate-spin"));
    await page.screenshot({ path: `out/${name}.png`, fullPage: false });
    results.push({ name, path, h1, spinner, errors: errors[page.url()] ?? [] });
    console.log(`✓ ${name} (${path}) h1="${h1}"${spinner ? " [spinner still visible]" : ""}${(errors[page.url()] ?? []).length ? " ERRORS:" + errors[page.url()].length : ""}`);
  } catch (e) { results.push({ name, path, error: String(e) }); console.log(`✗ ${name} ${e}`); }
}
writeFileSync("out/results.json", JSON.stringify(results, null, 2));
await browser.close();
