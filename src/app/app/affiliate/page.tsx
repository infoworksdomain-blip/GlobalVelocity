"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAction, Badge } from "@/components/ui";
type A = { affiliate: { code: string; commissionPct: number; link: string; payoutEmail: string | null } | null; stats?: { referred: number; earned: number; pending: number; paid: number; signups: number }; commissions?: { id: number; amountCents: number; commissionCents: number; status: string; createdAt: string }[] };
export default function Affiliate() {
  const { run, busy, wall } = useAction(); const [a, setA] = useState<A | null>(null); const [code, setCode] = useState(""); const [email, setEmail] = useState("");
  const load = () => api<A>("/affiliate").then(setA);
  useEffect(() => { load(); }, []);
  const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
  return (
    <div className="max-w-3xl space-y-4">{wall}<h1 className="text-2xl font-extrabold">Affiliate program</h1>
      {a && !a.affiliate ? <div className="card p-5"><p className="text-sm text-[var(--color-muted)]">Earn 30% lifetime commission on every payment from people you refer. Choose your referral code.</p><div className="mt-3 flex gap-2"><input className="input" placeholder="yourname" value={code} onChange={(e) => setCode(e.target.value)} /><input className="input" placeholder="Payout email (PayPal)" value={email} onChange={(e) => setEmail(e.target.value)} /><button className="btn-primary" disabled={busy || code.length < 3} onClick={() => run(async () => { await api("/affiliate", { method: "POST", json: { code, payout_email: email || undefined } }); load(); }, "You're in!")}>Join</button></div></div>
      : a?.affiliate && <>
        <div className="card p-5"><div className="label">Your link</div><code className="text-sm bg-[var(--color-surface-2)] px-2 py-1 rounded">{a.affiliate.link}</code><p className="text-xs text-[var(--color-muted)] mt-2">{a.affiliate.commissionPct}% lifetime · 60-day cookie · payouts monthly, $50 minimum{a.affiliate.payoutEmail ? ` to ${a.affiliate.payoutEmail}` : ""}.</p></div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">{[["Signups", a.stats?.signups], ["Paying", a.stats?.referred], ["Earned", usd(a.stats?.earned ?? 0)], ["Pending", usd(a.stats?.pending ?? 0)], ["Paid", usd(a.stats?.paid ?? 0)]].map(([l, v]) => <div key={l as string} className="kpi"><div className="text-xs text-[var(--color-muted)]">{l}</div><div className="text-xl font-bold">{v ?? 0}</div></div>)}</div>
        <div className="card overflow-hidden"><table className="w-full text-sm"><thead className="bg-[var(--color-surface-2)] text-left"><tr><th className="p-3">Date</th><th className="p-3">Payment</th><th className="p-3">Commission</th><th className="p-3">Status</th></tr></thead><tbody>{(a.commissions ?? []).map((c) => <tr key={c.id} className="border-t border-[var(--color-hairline)]"><td className="p-3">{new Date(c.createdAt).toLocaleDateString()}</td><td className="p-3">{usd(c.amountCents)}</td><td className="p-3">{usd(c.commissionCents)}</td><td className="p-3"><Badge tone={c.status === "paid" ? "green" : "amber"}>{c.status}</Badge></td></tr>)}{!a.commissions?.length && <tr><td className="p-6 text-[var(--color-muted)]" colSpan={4}>No commissions yet.</td></tr>}</tbody></table></div>
      </>}
    </div>
  );
}
