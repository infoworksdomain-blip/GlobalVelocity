import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { TOOLS, COMPARE, INDUSTRIES } from "@/content/site";
import { ShareRow } from "@/components/share";
/** Shared template for programmatic SEO pages, with internal linking to related pages and a share row. */
export function SeoPage({ eyebrow, title, intro, bullets, sections, cta = "Try it free", path, related }: { eyebrow: string; title: string; intro: string; bullets?: string[]; sections?: { h: string; p: string }[]; cta?: string; path: string; related?: { href: string; label: string }[] }) {
  const fallback = [
    ...TOOLS.slice(0, 3).map((t) => ({ href: `/tools/${t.slug}`, label: t.title })),
    ...COMPARE.slice(0, 2).map((c) => ({ href: `/compare/${c.slug}`, label: c.title })),
    ...INDUSTRIES.slice(0, 2).map((i) => ({ href: `/industries/${i.slug}`, label: `For ${i.title}` })),
  ].filter((r) => r.href !== path).slice(0, 6);
  const links = related?.length ? related : fallback;
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <span className="eyebrow">{eyebrow}</span>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-4 text-lg text-slate-600">{intro}</p>
      {bullets && <ul className="mt-6 space-y-2.5">{bullets.map((b) => <li key={b} className="flex gap-2.5 items-start"><Check className="h-5 w-5 text-accent-500 shrink-0" aria-hidden />{b}</li>)}</ul>}
      <div className="mt-8 flex flex-wrap gap-3"><Link href="/login" className="btn-primary">{cta}<ArrowRight className="h-4 w-4" /></Link><Link href="/pricing" className="btn-secondary">See pricing</Link></div>
      {sections?.map((s) => <section key={s.h} className="mt-10"><h2 className="text-2xl font-bold">{s.h}</h2><p className="mt-2 text-slate-600 leading-relaxed">{s.p}</p></section>)}
      <section className="mt-12 card p-6 bg-slate-50">
        <h2 className="font-bold">How it works with Velocity</h2>
        <ol className="mt-2 list-decimal pl-5 text-sm text-slate-600 space-y-1"><li>Paste your website URL to build a <Link className="underline" href="/faq#getting-started">Company Profile</Link>.</li><li>Generate a batch of on-brand content.</li><li>Approve fast in Velocity mode.</li><li>Schedule natively to TikTok, Instagram, YouTube and LinkedIn.</li></ol>
      </section>
      <section className="mt-8">
        <h2 className="font-bold">Related</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">{links.map((r) => <Link key={r.href} href={r.href} className="card card-hover px-4 py-3 text-sm font-medium flex items-center justify-between">{r.label}<ArrowRight className="h-4 w-4 text-slate-400" /></Link>)}</div>
        <p className="mt-4 text-sm text-slate-500">More: <Link className="underline" href="/pricing">pricing</Link> · <Link className="underline" href="/faq">FAQ</Link> · <Link className="underline" href="/blog">blog</Link> · <Link className="underline" href="/developers">API</Link> · <Link className="underline" href="/contact">contact</Link></p>
      </section>
      <ShareRow path={path} title={title} />
    </article>
  );
}
