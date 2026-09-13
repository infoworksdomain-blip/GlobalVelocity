import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({ title: 'Pricing — plans from $0 to $149/month', description: 'Compare Velocity plans: content saves, AI Studio credits, workspaces, social accounts and scheduling. Start free, no credit card required.', path: '/pricing' });
import { PricingTable } from "@/components/pricing-table";
import { PLANS, PLAN_ORDER, CREDIT_TARIFF } from "@/lib/plans";
import { FAQ } from "@/content/site";

const rows: [string, (l: (typeof PLANS)["free"]["limits"]) => string][] = [
  ["Content saves", (l) => (l.saves === null ? "Unlimited" : String(l.saves))], ["Candidates per day", (l) => String(l.candidatesPerDay)], ["AI Studio credits / mo", (l) => String(l.creditsMonthly)],
  ["Workspaces", (l) => String(l.workspaces)], ["Social accounts per platform", (l) => (l.socialsPerPlatform === null ? "Unlimited" : l.socialsPerPlatform === 0 ? "—" : String(l.socialsPerPlatform))], ["Scheduling", (l) => (l.scheduling ? "✓" : "—")],
  ["Trend remix", (l) => (l.trendRemix ? "✓" : "—")], ["Human UGC clips / mo", (l) => (l.ugcClipsMonthly ? String(l.ugcClipsMonthly) : "—")], ["Multi-language", (l) => (l.multiLanguage ? "✓" : "—")], ["API rate limit (rpm)", (l) => (l.apiRpm ? String(l.apiRpm) : "—")], ["Team members", (l) => (l.teamInvites ? "✓" : "—")],
];
export default function Pricing() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-4xl font-extrabold text-center">Pricing that grows with you</h1>
      <p className="text-center text-slate-600 mt-2">All plans include Velocity mode and native publishing. Credits: {CREDIT_TARIFF.image} per image, {CREDIT_TARIFF.videoPerSecond} per second of video.</p>
      <div className="mt-10"><PricingTable /></div>
      <h2 className="mt-16 text-2xl font-bold">Compare plans</h2>
      <div className="mt-4 overflow-x-auto card"><table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="text-left p-3">Feature</th>{PLAN_ORDER.map((p) => <th key={p} className="p-3">{PLANS[p].name}</th>)}</tr></thead><tbody>{rows.map(([label, f]) => <tr key={label} className="border-t border-slate-100"><td className="p-3 font-medium">{label}</td>{PLAN_ORDER.map((p) => <td key={p} className="p-3 text-center">{f(PLANS[p].limits)}</td>)}</tr>)}</tbody></table></div>
      <div className="mt-16 max-w-3xl mx-auto divide-y divide-slate-200">{FAQ.map((f) => <details key={f.q} className="py-4"><summary className="cursor-pointer font-semibold">{f.q}</summary><p className="mt-2 text-sm text-slate-600">{f.a}</p></details>)}</div>
    </div>
  );
}
