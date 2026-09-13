import Link from "next/link";
import { ArrowRight, Check, Sparkles, Video, Images, Wand2, CalendarDays, Bot, BarChart3, Bolt, Users, Code2 } from "lucide-react";
import { FAQ, TESTIMONIALS, APP, TOOLS, INDUSTRIES } from "@/content/site";
import { PricingTable } from "@/components/pricing-table";
import { BlitzDemo } from "@/components/blitz-demo";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "AI marketing on autopilot for founders", description: "Paste your website URL and Velocity generates a month of TikToks, Reels, Shorts and LinkedIn posts. Swipe to approve, then it schedules and publishes everything. Free to start.", path: "/" });

const STEPS = [
  { n: "01", t: "Paste your URL", d: "We read your site and build a Company Profile: audience, tone, features, hooks.", icon: Wand2 },
  { n: "02", t: "Get a month of content", d: "AI UGC videos, slideshows, hook + demo clips, memes and trend remixes — all on-brand.", icon: Video },
  { n: "03", t: "Swipe to approve", d: "Velocity mode: right to keep, left to skip. Approve 30 posts in five minutes.", icon: Bolt },
  { n: "04", t: "Schedule & grow", d: "Native publishing to TikTok, Reels, Shorts and LinkedIn with analytics and attribution.", icon: CalendarDays },
];
const FEATURES = [
  [Users, "AI UGC characters", "Talking-head videos from your script — pick a synthetic creator or make your own."],
  [Images, "Human UGC library", "Licensed creator clips with your voiceover and captions for an authentic feel."],
  [Sparkles, "Trend remix", "Trending formats ranked by fit for your brand, remixable in one click."],
  [Bolt, "Velocity mode", "The fastest approval flow in marketing. Swipe, keyboard or touch."],
  [CalendarDays, "Native scheduling", "Best-time queues, drag-and-drop calendar, retries and reconnect alerts."],
  [Bot, "Automations", "Set a cadence and format mix; your calendar fills itself every week."],
  [BarChart3, "Analytics + attribution", "Views, breakouts, and which posts actually drove signups on your site."],
  [Wand2, "AI Studio", "Consistent AI influencers, image and video generation on credits."],
  [Code2, "API & MCP", "Generate, approve and schedule from your own code or AI agents."],
] as const;

export default function Landing() {
  const jsonLd = { "@context": "https://schema.org", "@type": "SoftwareApplication", name: APP.name, applicationCategory: "BusinessApplication", operatingSystem: "Web", description: "Generate, approve, schedule and publish short-form video from your website.", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } };
  return (
    <>
      <section className="hero-bg">
        <div className="mx-auto max-w-6xl px-4 pt-20 pb-16 grid gap-12 md:grid-cols-2 items-center">
          <div>
            <span className="eyebrow"><Sparkles className="h-3.5 w-3.5" />Marketing for people who&apos;d rather build</span>
            <h1 className="mt-5 text-5xl md:text-6xl font-extrabold tracking-[-0.03em] leading-[1.02]">Your marketing, <span className="gradient-text">done while you build.</span></h1>
            <p className="mt-6 text-lg text-slate-600 max-w-xl">Paste your website URL. {APP.name} generates a month of TikToks, Reels, Shorts and LinkedIn posts, you swipe to approve, and it schedules and publishes everything.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Link href="/login" className="btn-primary text-base px-6 py-3.5">Generate my first 30 posts<ArrowRight className="h-4 w-4" /></Link><Link href="#how" className="btn-secondary text-base px-6 py-3.5">See how it works</Link></div>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">{["No credit card", "10 AI Studio credits included", "Cancel any time"].map((t) => <span key={t} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-accent-500" aria-hidden />{t}</span>)}</div>
          </div>
          <BlitzDemo />
        </div>
      </section>

      <section id="how" className="py-20 border-t border-slate-100"><div className="mx-auto max-w-6xl px-4">
        <div className="max-w-2xl"><span className="eyebrow">How it works</span><h2 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight">From URL to published in four steps</h2></div>
        <div className="mt-10 grid gap-5 md:grid-cols-4">{STEPS.map((s) => <div key={s.n} className="card card-hover p-6"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><s.icon className="h-5 w-5" /></span><span className="text-xs font-bold text-slate-300">{s.n}</span></div><h3 className="mt-4 font-semibold">{s.t}</h3><p className="mt-1.5 text-sm text-slate-600">{s.d}</p></div>)}</div>
      </div></section>

      <section id="features" className="py-20 bg-slate-50 border-y border-slate-100"><div className="mx-auto max-w-6xl px-4">
        <div className="max-w-2xl"><span className="eyebrow">Features</span><h2 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight">Everything a growth team does, on autopilot</h2></div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">{FEATURES.map(([Icon, t, d]) => <div key={t} className="card card-hover p-6"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5" /></span><h3 className="mt-4 font-semibold">{t}</h3><p className="mt-1.5 text-sm text-slate-600">{d}</p></div>)}</div>
        <p className="mt-8 text-sm text-slate-600">Explore the tools: {TOOLS.slice(0, 5).map((t, i) => <span key={t.slug}>{i > 0 && " · "}<Link className="text-brand-700 underline" href={`/tools/${t.slug}`}>{t.title}</Link></span>)}</p>
      </div></section>

      <section className="py-20"><div className="mx-auto max-w-6xl px-4 grid gap-5 md:grid-cols-3">{TESTIMONIALS.map((t) => <figure key={t.name} className="card p-6"><blockquote className="text-[15px] leading-relaxed text-slate-700">“{t.text}”</blockquote><figcaption className="mt-4 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-brand-700 font-bold text-sm" aria-hidden>{t.name.slice(0, 1)}</span><span className="text-sm"><b>{t.name}</b><br /><span className="text-slate-500">{t.role}</span></span></figcaption></figure>)}</div></section>

      <section id="pricing" className="py-20 bg-slate-50 border-y border-slate-100"><div className="mx-auto max-w-6xl px-4"><div className="text-center max-w-2xl mx-auto"><span className="eyebrow">Pricing</span><h2 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight">Start free. Upgrade when you publish.</h2></div><div className="mt-10"><PricingTable /></div><p className="mt-6 text-center text-sm text-slate-500">Full comparison on the <Link className="text-brand-700 underline" href="/pricing">pricing page</Link>.</p></div></section>

      <section className="py-20"><div className="mx-auto max-w-3xl px-4"><div className="text-center"><span className="eyebrow">FAQ</span><h2 className="mt-3 text-3xl font-extrabold tracking-tight">Questions</h2></div><div className="mt-8 card divide-y divide-slate-100 px-6">{FAQ.slice(0, 6).map((f) => <details key={f.q} className="py-4 group"><summary className="cursor-pointer font-semibold list-none flex justify-between gap-4">{f.q}<span className="text-slate-400 transition group-open:rotate-45">+</span></summary><p className="mt-2 text-sm text-slate-600">{f.a}</p></details>)}</div><p className="mt-5 text-center text-sm text-slate-500">More in the <Link className="text-brand-700 underline" href="/faq">full FAQ</Link> or <Link className="text-brand-700 underline" href="/contact">talk to us</Link>.</p></div></section>

      <section className="py-20 bg-gradient-to-br from-brand-900 to-brand-700 text-white"><div className="mx-auto max-w-3xl px-4 text-center"><h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Ready to stop procrastinating on marketing?</h2><p className="mt-3 text-white/80">Your first 30 posts are free. No card, no setup call.</p><Link href="/login" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-brand-700 hover:bg-slate-100">Start free<ArrowRight className="h-4 w-4" /></Link>
        <p className="mt-8 text-xs text-white/60">Built for {INDUSTRIES.slice(0, 4).map((i, n) => <span key={i.slug}>{n > 0 && ", "}<Link className="underline" href={`/industries/${i.slug}`}>{i.title}</Link></span>)} and more.</p></div></section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
