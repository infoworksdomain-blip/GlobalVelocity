"use client";
import { useState } from "react";
import Link from "next/link";
import { PLANS, PLAN_ORDER, yearlyPricePerMonth } from "@/lib/plans";
export function PricingTable({ cta = "/login", current }: { cta?: string; current?: string }) {
  const [yearly, setYearly] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-center gap-3 text-sm">
        <span className={!yearly ? "font-semibold" : ""} style={yearly ? { color: "var(--color-muted)" } : undefined}>Monthly</span>
        <button className="relative h-6 w-11 rounded-full transition" style={{ background: yearly ? "var(--color-brand-500)" : "var(--color-surface-3)" }} onClick={() => setYearly(!yearly)} aria-label="Toggle yearly"><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${yearly ? "left-[22px]" : "left-0.5"}`} /></button>
        <span className={yearly ? "font-semibold" : ""} style={!yearly ? { color: "var(--color-muted)" } : undefined}>Yearly <span className="badge badge-green ml-1">Save 20%</span></span>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-4">
        {PLAN_ORDER.map((id) => { const p = PLANS[id]; const price = yearly ? yearlyPricePerMonth(p) : p.priceMonth; const isCur = current === id; return (
          <div key={id} className="card p-6 flex flex-col" style={p.badge ? { boxShadow: "0 0 0 2px var(--color-brand-500)" } : undefined}>
            {p.badge && <span className="badge self-start mb-2 text-white" style={{ background: "var(--color-brand-500)" }}>{p.badge}</span>}
            <h3 className="text-xl font-bold">{p.name}</h3><p className="text-sm" style={{ color: "var(--color-muted)" }}>{p.tagline}</p>
            <div className="mt-4"><span className="text-4xl font-bold font-display">${price}</span><span style={{ color: "var(--color-muted)" }}>/mo</span>{yearly && p.priceMonth > 0 && <div className="text-xs" style={{ color: "var(--color-faint)" }}>billed ${Math.round(price * 12)} yearly</div>}</div>
            <ul className="mt-4 space-y-2 text-sm flex-1">{p.features.map((f) => <li key={f} className="flex gap-2"><span style={{ color: "var(--color-accent-400)" }}>✓</span>{f}</li>)}</ul>
            <Link href={isCur ? "#" : `${cta}${cta.includes("?") ? "&" : "?"}plan=${id}&interval=${yearly ? "year" : "month"}`} className={`mt-6 ${p.badge ? "btn-primary" : "btn-secondary"} ${isCur ? "opacity-60 pointer-events-none" : ""}`}>{isCur ? "Current plan" : id === "free" ? "Start free" : `Get ${p.name}`}</Link>
          </div>); })}
      </div>
    </div>
  );
}
