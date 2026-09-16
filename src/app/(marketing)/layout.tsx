import Link from "next/link";
import { Zap } from "lucide-react";
import { APP, TOOLS, COMPARE, INDUSTRIES } from "@/content/site";
import { CookieBanner } from "@/components/cookie-banner";
import { ThemeToggle } from "@/components/theme-toggle";
const COLS: [string, [string, string][]][] = [
  ["Product", [["/#features", "Features"], ["/pricing", "Pricing"], ["/faq", "FAQ"], ["/developers", "API & MCP"], ["/affiliates", "Affiliate program"]]],
  ["Tools", TOOLS.slice(0, 6).map((t) => [`/tools/${t.slug}`, t.title])],
  ["Compare", [...COMPARE.slice(0, 4).map((c) => [`/compare/${c.slug}`, c.title] as [string, string]), ...INDUSTRIES.slice(0, 2).map((i) => [`/industries/${i.slug}`, `For ${i.title}`] as [string, string])]],
  ["Company", [["/blog", "Blog"], ["/contact", "Contact & directions"], ["/careers", "Careers"], ["/privacy", "Privacy policy"], ["/terms", "Terms of service"]]],
];
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--color-ink)", color: "var(--color-text)" }}>
      <header className="sticky top-0 z-40 backdrop-blur" style={{ borderBottom: "1px solid var(--color-hairline)", background: "color-mix(in srgb, var(--color-ink) 80%, transparent)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight font-display" aria-label={`${APP.name} home`}><span className="grid h-8 w-8 place-items-center rounded-xl text-white" style={{ background: "linear-gradient(160deg, var(--color-brand-400), var(--color-brand-600))" }}><Zap className="h-4 w-4" /></span>{APP.name}</Link>
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium" style={{ color: "var(--color-muted)" }} aria-label="Main">
            <Link href="/#features" className="hover:text-white transition">Features</Link><Link href="/tools/ai-ugc-video-generator" className="hover:text-white transition">Tools</Link><Link href="/pricing" className="hover:text-white transition">Pricing</Link><Link href="/faq" className="hover:text-white transition">FAQ</Link><Link href="/blog" className="hover:text-white transition">Blog</Link><Link href="/developers" className="hover:text-white transition">API</Link>
          </nav>
          <div className="flex items-center gap-2"><ThemeToggle /><Link href="/login" className="btn-ghost">Log in</Link><Link href="/login" className="btn-primary">Start free</Link></div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer style={{ borderTop: "1px solid var(--color-hairline)", background: "var(--color-surface)" }}>
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-6 text-sm">
          <div className="md:col-span-2"><div className="flex items-center gap-2 font-bold text-lg font-display"><span className="grid h-8 w-8 place-items-center rounded-xl text-white" style={{ background: "linear-gradient(160deg, var(--color-brand-400), var(--color-brand-600))" }}><Zap className="h-4 w-4" /></span>{APP.name}</div><p className="mt-3 max-w-xs" style={{ color: "var(--color-muted)" }}>{APP.tagline}. Paste a URL, get a month of content, swipe, schedule, grow.</p>
            <div className="mt-4 flex gap-3" style={{ color: "var(--color-faint)" }} aria-label="Social links"><a href="https://x.com" aria-label="X (Twitter)" className="hover:text-white transition">X</a><a href="https://www.linkedin.com" aria-label="LinkedIn" className="hover:text-white transition">LinkedIn</a><a href="https://www.tiktok.com" aria-label="TikTok" className="hover:text-white transition">TikTok</a><a href={APP.discord} aria-label="Discord" className="hover:text-white transition">Discord</a></div></div>
          {COLS.map(([h, links]) => <div key={h}><div className="font-semibold mb-3" style={{ color: "var(--color-text)" }}>{h}</div><ul className="space-y-2" style={{ color: "var(--color-muted)" }}>{links.map(([href, label]) => <li key={href}><Link href={href} className="hover:text-[var(--color-brand-400)] transition">{label}</Link></li>)}</ul></div>)}
        </div>
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 pb-8 text-xs" style={{ color: "var(--color-faint)" }}><span>© {new Date().getFullYear()} {APP.name}. All rights reserved.</span><span>Not affiliated with TikTok, Meta, Google or LinkedIn.</span></div>
      </footer>
      <CookieBanner />
    </div>
  );
}
