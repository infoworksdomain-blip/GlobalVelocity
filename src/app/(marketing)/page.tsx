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
            <h1 className="mt-5 text-5xl md:text-6xl font-bold tracking-[-0.03em] leading-[1.02] font-display">Your marketing, <span className="gradient-text">done while you build.</span></h1>
            <p className="mt-6 text-lg max-w-xl" style={{ color: "var(--color-muted)" }}>Paste your website URL. {APP.name} generates a month of TikToks, Reels, Shorts and LinkedIn posts, you swipe to approve, and it schedules and publishes everything.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Link href="/login" className="btn-primary text-base px-6 py-3.5">Generate my first 30 posts<ArrowRight className="h-4 w-4" /></Link><Link href="#how" className="btn-secondary text-base px-6 py-3.5">See how it works</Link></div>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs" style={{ color: "var(--color-faint)" }}>{["No credit card", "10 AI Studio credits included", "Cancel any time"].map((t) => <span key={t} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" style={{ color: "var(--color-accent-400)" }} aria-hidden />{t}</span>)}</div>
          </div>
          <BlitzDemo />
        </div>
      </section>

      <section id="how" className="py-20" style={{ borderTop: "1px solid var(--color-hairline)" }}><div className="mx-auto max-w-6xl px-4">
        <div className="max-w-2xl"><span className="eyebrow">How it works</span><h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight font-display">From URL to published in four steps</h2></div>
        <div className="mt-10 grid gap-5 md:grid-cols-4">{STEPS.map((s) => <div key={s.n} className="card card-hover p-6"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: "rgba(110,86,248,.14)", color: "var(--color-accent-text)" }}><s.icon className="h-5 w-5" /></span><span className="text-xs font-bold" style={{ color: "var(--color-faint)" }}>{s.n}</span></div><h3 className="mt-4 font-semibold">{s.t}</h3><p className="mt-1.5 text-sm" style={{ color: "var(--color-muted)" }}>{s.d}</p></div>)}</div>
      </div></section>

      <section id="features" className="py-20" style={{ background: "var(--color-surface)", borderTop: "1px solid var(--color-hairline)", borderBottom: "1px solid var(--color-hairline)" }}><div className="mx-auto max-w-6xl px-4">
        <div className="max-w-2xl"><span className="eyebrow">Features</span><h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight font-display">Everything a growth team does, on autopilot</h2></div>
        <div className="mt-10 grid gap-4 md:grid-cols-3 auto-rows-fr">{FEATURES.map(([Icon, t, d], i) => <div key={t} className={`card card-hover p-6 ${i === 0 ? "md:col-span-2 md:row-span-2 md:p-8" : ""}`}><span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: "rgba(110,86,248,.14)", color: "var(--color-accent-text)" }}><Icon className="h-5 w-5" /></span><h3 className={`mt-4 font-semibold ${i === 0 ? "text-lg" : ""}`}>{t}</h3><p className="mt-1.5 text-sm" style={{ color: "var(--color-muted)" }}>{d}</p></div>)}</div>
        <p className="mt-8 text-sm" style={{ color: "var(--color-muted)" }}>Explore the tools: {TOOLS.slice(0, 5).map((t, i) => <span key={t.slug}>{i > 0 && " · "}<Link className="underline" style={{ color: "var(--color-brand-400)" }} href={`/tools/${t.slug}`}>{t.title}</Link></span>)}</p>
      </div></section>

      <section className="py-20"><div className="mx-auto max-w-6xl px-4 grid gap-5 md:grid-cols-3">{TESTIMONIALS.map((t) => <figure key={t.name} className="card p-6"><blockquote className="text-[15px] leading-relaxed">“{t.text}”</blockquote><figcaption className="mt-4 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full font-bold text-sm" style={{ background: "rgba(110,86,248,.16)", color: "var(--color-accent-text)" }} aria-hidden>{t.name.slice(0, 1)}</span><span className="text-sm"><b>{t.name}</b><br /><span style={{ color: "var(--color-muted)" }}>{t.role}</span></span></figcaption></figure>)}</div></section>

      <section id="pricing" className="py-20" style={{ background: "var(--color-surface)", borderTop: "1px solid var(--color-hairline)", borderBottom: "1px solid var(--color-hairline)" }}><div className="mx-auto max-w-6xl px-4"><div className="text-center max-w-2xl mx-auto"><span className="eyebrow">Pricing</span><h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight font-display">Start free. Upgrade when you publish.</h2></div><div className="mt-10"><PricingTable /></div><p className="mt-6 text-center text-sm" style={{ color: "var(--color-faint)" }}>Full comparison on the <Link className="underline" style={{ color: "var(--color-brand-400)" }} href="/pricing">pricing page</Link>.</p></div></section>

      <section className="py-20"><div className="mx-auto max-w-3xl px-4"><div className="text-center"><span className="eyebrow">FAQ</span><h2 className="mt-3 text-3xl font-bold tracking-tight font-display">Questions</h2></div><div className="mt-8 card px-6">{FAQ.slice(0, 6).map((f, i) => <details key={f.q} className="py-4 group" style={i > 0 ? { borderTop: "1px solid var(--color-hairline)" } : undefined}><summary className="cursor-pointer font-semibold list-none flex justify-between gap-4">{f.q}<span className="transition group-open:rotate-45" style={{ color: "var(--color-faint)" }}>+</span></summary><p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>{f.a}</p></details>)}</div><p className="mt-5 text-center text-sm" style={{ color: "var(--color-faint)" }}>More in the <Link className="underline" style={{ color: "var(--color-brand-400)" }} href="/faq">full FAQ</Link> or <Link className="underline" style={{ color: "var(--color-brand-400)" }} href="/contact">talk to us</Link>.</p></div></section>

      <section className="py-20 text-white" style={{ background: "linear-gradient(135deg, var(--color-brand-700), var(--color-brand-900))" }}><div className="mx-auto max-w-3xl px-4 text-center"><h2 className="text-3xl md:text-4xl font-bold tracking-tight font-display">Ready to stop procrastinating on marketing?</h2><p className="mt-3 text-white/70">Your first 30 posts are free. No card, no setup call.</p><Link href="/login" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-base font-semibold hover:bg-white/90" style={{ color: "var(--color-brand-700)" }}>Start free<ArrowRight className="h-4 w-4" /></Link>
        <p className="mt-8 text-xs text-white/50">Built for {INDUSTRIES.slice(0, 4).map((i, n) => <span key={i.slug}>{n > 0 && ", "}<Link className="underline" href={`/industries/${i.slug}`}>{i.title}</Link></span>)} and more.</p></div></section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
