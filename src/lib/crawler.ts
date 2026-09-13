/** Crawls a website: home + up to N internal pages. Native fetch first, Firecrawl fallback for JS-only sites (FR-3.4). */
export type CrawlResult = { url: string; title: string; description: string; text: string; headings: string[]; images: string[]; links: string[]; ogImage?: string; appLinks: { ios?: string; android?: string }; socialLinks: string[] };

const strip = (html: string) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&amp;|&quot;|&#39;|&lt;|&gt;/g, (m) => ({ "&nbsp;": " ", "&amp;": "&", "&quot;": '"', "&#39;": "'", "&lt;": "<", "&gt;": ">" }[m] ?? " ")).replace(/\s+/g, " ").trim();
const meta = (html: string, name: string) => html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["']`, "i"))?.[1] ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name}["']`, "i"))?.[1] ?? "";

async function fetchPage(url: string, timeoutMs = 8000) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ac.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; VelocityBot/1.0; +https://example.com/bot)", accept: "text/html" }, redirect: "follow" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return { html: await r.text(), finalUrl: r.url };
  } finally { clearTimeout(t); }
}

async function firecrawl(url: string) {
  if (!process.env.FIRECRAWL_API_KEY) return null;
  const r = await fetch("https://api.firecrawl.dev/v1/scrape", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}` }, body: JSON.stringify({ url, formats: ["markdown", "html"] }) });
  if (!r.ok) return null;
  const j = await r.json() as { data?: { markdown?: string; html?: string; metadata?: { title?: string; description?: string; ogImage?: string } } };
  return j.data ?? null;
}

export async function crawlSite(inputUrl: string, maxPages = 12): Promise<CrawlResult> {
  const url = /^https?:\/\//i.test(inputUrl) ? inputUrl : `https://${inputUrl}`;
  const origin = new URL(url).origin;
  let html = "", finalUrl = url;
  try { ({ html, finalUrl } = await fetchPage(url)); } catch { /* fall through */ }
  let text = strip(html);
  let title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "";
  let description = meta(html, "description") || meta(html, "og:description");
  let ogImage = meta(html, "og:image") || undefined;
  if (text.length < 300) {
    const fc = await firecrawl(url);
    if (fc) { text = strip(fc.html ?? "") || fc.markdown || text; title = fc.metadata?.title ?? title; description = fc.metadata?.description ?? description; ogImage = fc.metadata?.ogImage ?? ogImage; html = fc.html ?? html; }
  }
  const links = Array.from(new Set(Array.from(html.matchAll(/href=["']([^"'#]+)["']/gi)).map((m) => { try { return new URL(m[1], finalUrl).toString(); } catch { return ""; } }).filter((l) => l.startsWith(origin))));
  const priority = ["pricing", "features", "about", "product", "how-it-works", "faq", "blog"];
  const internal = links.filter((l) => l !== finalUrl).sort((a, b) => (priority.findIndex((p) => a.includes(p)) === -1 ? 99 : 0) - (priority.findIndex((p) => b.includes(p)) === -1 ? 99 : 0)).slice(0, maxPages);
  const pages = await Promise.allSettled(internal.map((l) => fetchPage(l, 6000)));
  for (const p of pages) if (p.status === "fulfilled") text += "\n\n" + strip(p.value.html).slice(0, 4000);
  const headings = Array.from(html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)).map((m) => strip(m[1])).filter(Boolean).slice(0, 40);
  const images = Array.from(new Set(Array.from(html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)).map((m) => { try { return new URL(m[1], finalUrl).toString(); } catch { return ""; } }).filter(Boolean))).slice(0, 20);
  const appLinks = { ios: html.match(/https?:\/\/apps\.apple\.com\/[^"'\s]+/i)?.[0], android: html.match(/https?:\/\/play\.google\.com\/store\/apps\/[^"'\s]+/i)?.[0] };
  const socialLinks = Array.from(new Set(Array.from(html.matchAll(/https?:\/\/(?:www\.)?(?:tiktok|instagram|youtube|linkedin|x|twitter)\.com\/[^"'\s<]+/gi)).map((m) => m[0]))).slice(0, 10);
  return { url: finalUrl, title, description, text: text.slice(0, 60_000), headings, images, links: internal, ogImage, appLinks, socialLinks };
}
