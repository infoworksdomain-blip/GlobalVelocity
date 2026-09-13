"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMe } from "@/lib/use-me";
import { api } from "@/lib/api";
import { useAction, Badge } from "@/components/ui";
import { PricingTable } from "@/components/pricing-table";
type Credits = { balance: number; monthly_allocation: number; renews_at: string | null; packs: { id: string; credits: number; usd: number }[]; ledger?: { id: number; delta: number; reason: string; createdAt: string }[] };
export default function Billing() {
  const { me, refresh } = useMe(); const { run, busy, wall } = useAction(); const sp = useSearchParams(); const [c, setC] = useState<Credits | null>(null);
  const load = () => api<Credits>("/credits?ledger=1").then(setC);
  useEffect(() => { load(); }, []);
  useEffect(() => { const plan = sp.get("plan"); if (plan && plan !== "free" && me && me.account.plan !== plan) checkout(plan, sp.get("interval") ?? "month"); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sp, me?.account.plan]);
  const checkout = (plan: string, interval: string) => run(async () => { const r = await api<{ url: string; dev_mode?: boolean }>("/billing/checkout", { method: "POST", json: { plan, interval } }); if (r.dev_mode) { await refresh(); } else window.location.href = r.url; }, undefined);
  const portal = () => run(async () => { const r = await api<{ url: string }>("/billing/portal", { method: "POST" }); window.location.href = r.url; });
  const buy = (id: string) => run(async () => { const r = await api<{ url: string; dev_mode?: boolean }>("/billing/checkout", { method: "POST", json: { credit_pack: id } }); if (r.dev_mode) { await refresh(); load(); } else window.location.href = r.url; });
  return (
    <div className="space-y-6">{wall}
      {sp.get("upgraded") && <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">Upgrade complete — welcome to {me?.plan.name}!</div>}
      {sp.get("dev") && <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">Stripe is not configured, so the plan was applied directly (dev mode). Set STRIPE_* keys for real billing.</div>}
      <div className="card p-5 flex flex-wrap items-center gap-4"><div><div className="label">Current plan</div><div className="text-xl font-bold">{me?.plan.name} {me?.account.billingInterval && <Badge>{me.account.billingInterval}ly</Badge>}</div>{me?.account.planRenewsAt && <div className="text-xs text-slate-500">Renews {new Date(me.account.planRenewsAt).toLocaleDateString()}</div>}</div><div className="ml-auto flex gap-2">{me?.account.plan !== "free" && <button className="btn-secondary" onClick={portal} disabled={busy}>Manage subscription / invoices</button>}</div></div>
      <div className="card p-5"><div className="flex flex-wrap items-center gap-4"><div><div className="label">AI Studio credits</div><div className="text-xl font-bold">{c?.balance ?? me?.usage.credits}</div><div className="text-xs text-slate-500">{c?.monthly_allocation} allocated monthly on {me?.plan.name}; no rollover.</div></div><div className="ml-auto flex gap-2">{c?.packs.map((p) => <button key={p.id} className="btn-secondary" onClick={() => buy(p.id)}>{p.credits} credits · ${p.usd}</button>)}</div></div>
        {c?.ledger && c.ledger.length > 0 && <details className="mt-3 text-sm"><summary className="cursor-pointer text-slate-500">Ledger</summary><table className="w-full mt-2"><tbody>{c.ledger.map((l) => <tr key={l.id} className="border-t border-slate-100"><td className="py-1">{new Date(l.createdAt).toLocaleString()}</td><td className="capitalize">{l.reason}</td><td className={`text-right ${l.delta < 0 ? "text-red-600" : "text-emerald-700"}`}>{l.delta > 0 ? "+" : ""}{l.delta}</td></tr>)}</tbody></table></details>}
      </div>
      <div><h2 className="text-lg font-bold mb-4">Change plan</h2><PricingTable cta="/app/settings/billing" current={me?.account.plan} /></div>
      <p className="text-xs text-slate-500">Downgrading keeps your content; workspaces beyond the new limit are locked (not deleted) and saves above the limit remain read-only until you're under the cap.</p>
    </div>
  );
}
