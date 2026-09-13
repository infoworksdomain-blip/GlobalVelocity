import Link from "next/link";
import { Zap } from "lucide-react";
import { APP, TOOLS, COMPARE, INDUSTRIES } from "@/content/site";
import { CookieBanner } from "@/components/cookie-banner";
const COLS: [string, [string, string][]][] = [
  ["Product", [["/#features", "Features"], ["/pricing", "Pricing"], ["/faq", "FAQ"], ["/developers", "API & MCP"], ["/affiliates", "Affiliate program"]]],
  ["Tools", TOOLS.slice(0, 6).map((t) => [`/tools/${t.slug}`, t.title])],
  ["Compare", [...COMPARE.slice(0, 4).map((c) => [`/compare/${c.slug}`, c.title] as [string, string]), ...INDUSTRIES.slice(0, 2).map((i) => [`/industries/${i.slug}`, `For ${i.title}`] as [string, string])]],
  ["Company", [["/blog", "Blog"], ["/contact", "Contact & directions"], ["/careers", "Careers"], ["/privacy", "Privacy policy"], ["/terms", "Terms of service"]]],
];
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-extrabold text-lg tracking-tight" aria-label={`${APP.name} home`}><span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white"><Zap className="h-4 w-4" /></span>{APP.name}</Link>
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600" aria-label="Main">
            <Link href="/#features" className="hover:text-slate-900">Features</Link><Link href="/tools/ai-ugc-video-generator" className="hover:text-slate-900">Tools</Link><Link href="/pricing" className="hover:text-slate-900">Pricing</Link><Link href="/faq" className="hover:text-slate-900">FAQ</Link><Link href="/blog" className="hover:text-slate-900">Blog</Link><Link href="/developers" className="hover:text-slate-900">API</Link>
          </nav>
          <div className="flex items-center gap-2"><Link href="/login" className="btn-ghost">Log in</Link><Link href="/login" className="btn-primary">Start free</Link></div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-6 text-sm">
          <div className="md:col-span-2"><div className="flex items-center gap-2 font-extrabold text-lg"><span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white"><Zap className="h-4 w-4" /></span>{APP.name}</div><p className="mt-3 text-slate-600 max-w-xs">{APP.tagline}. Paste a URL, get a month of content, swipe, schedule, grow.</p>
            <div className="mt-4 flex gap-3 text-slate-500" aria-label="Social links"><a href="https://x.com" aria-label="X (Twitter)" className="hover:text-slate-900">X</a><a href="https://www.linkedin.com" aria-label="LinkedIn" className="hover:text-slate-900">LinkedIn</a><a href="https://www.tiktok.com" aria-label="TikTok" className="hover:text-slate-900">TikTok</a><a href={APP.discord} aria-label="Discord" className="hover:text-slate-900">Discord</a></div></div>
          {COLS.map(([h, links]) => <div key={h}><div className="font-semibold mb-3 text-slate-900">{h}</div><ul className="space-y-2 text-slate-600">{links.map(([href, label]) => <li key={href}><Link href={href} className="hover:text-brand-700">{label}</Link></li>)}</ul></div>)}
        </div>
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 pb-8 text-xs text-slate-400"><span>© {new Date().getFullYear()} {APP.name}. All rights reserved.</span><span>Not affiliated with TikTok, Meta, Google or LinkedIn.</span></div>
      </footer>
      <CookieBanner />
    </div>
  );
}
