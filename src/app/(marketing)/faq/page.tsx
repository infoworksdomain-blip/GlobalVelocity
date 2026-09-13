import Link from "next/link";
import { FAQ, FAQ_CATEGORIES, APP } from "@/content/site";
import { ShareRow } from "@/components/share";
import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({ title: "Frequently asked questions", description: "How Velocity turns your website into short-form video, what AI Studio credits cost, which platforms we publish to, and how your data is handled.", path: "/faq" });
export default function Faq() {
  const jsonLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <span className="eyebrow">Support</span>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight">Frequently asked questions</h1>
      <p className="mt-3 text-lg text-slate-600">Everything people ask before they start. Still stuck? <Link className="text-brand-700 underline" href="/contact">Talk to us</Link> or join the <a className="text-brand-700 underline" href={APP.discord}>Discord</a>.</p>
      <nav className="mt-6 flex flex-wrap gap-2" aria-label="FAQ categories">{FAQ_CATEGORIES.map((c) => <a key={c} href={`#${c.replace(/[^a-z]/gi, "-").toLowerCase()}`} className="badge bg-slate-100 text-slate-700 px-3 py-1.5 hover:bg-brand-50 hover:text-brand-700">{c}</a>)}</nav>
      {FAQ_CATEGORIES.map((c) => (
        <section key={c} id={c.replace(/[^a-z]/gi, "-").toLowerCase()} className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-bold">{c}</h2>
          <div className="mt-3 divide-y divide-slate-100 card px-5">
            {FAQ.filter((f) => f.cat === c).map((f) => <details key={f.q} className="group py-4"><summary className="cursor-pointer list-none font-semibold flex justify-between gap-4">{f.q}<span className="text-slate-400 transition group-open:rotate-45">+</span></summary><p className="mt-2 text-slate-600">{f.a}</p></details>)}
          </div>
        </section>
      ))}
      <section className="mt-12 card p-6 bg-brand-50 border-brand-100">
        <h2 className="text-lg font-bold">Still deciding?</h2>
        <p className="mt-1 text-slate-700">See <Link className="underline" href="/pricing">plans and limits</Link>, read how we compare to <Link className="underline" href="/compare/velocity-vs-buffer">Buffer</Link> or <Link className="underline" href="/compare/velocity-vs-hootsuite">Hootsuite</Link>, or browse the <Link className="underline" href="/tools/ai-ugc-video-generator">AI UGC generator</Link>. Developers: see the <Link className="underline" href="/developers">API & MCP docs</Link>.</p>
        <Link href="/login" className="btn-primary mt-5">Start free — no card</Link>
      </section>
      <ShareRow path="/faq" title="Velocity FAQ" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
