"use client";
import { useEffect, useState } from "react";
import { useMe } from "@/lib/use-me";
import { api, PLATFORM_LABEL, fmtNum } from "@/lib/api";
import { useAction, Spinner, Badge, Modal } from "@/components/ui";
type Trend = { id: string; platform: string; post_url: string; creator_handle: string | null; niche_tags: string[]; format_type: string | null; hook_text: string | null; metrics: { views: number; likes?: number; comments?: number }; velocity_score: number; locked: boolean; recipe?: { structure: { segment: string; seconds: number; text_slot?: string }[]; style: string; why_it_works?: string } };
/** Trending library (M6): browse, filter, "for your brand" ranking, detail + remix. */
export default function Trends() {
  const { workspaceId, me } = useMe(); const { run, wall } = useAction();
  const [rows, setRows] = useState<Trend[] | null>(null); const [platform, setPlatform] = useState(""); const [q, setQ] = useState(""); const [forBrand, setForBrand] = useState(true); const [sel, setSel] = useState<Trend | null>(null);
  useEffect(() => { if (!workspaceId) return; api<{ trends: Trend[] }>(`/trends?limit=48&platform=${platform}&q=${encodeURIComponent(q)}${forBrand ? `&for_workspace=${workspaceId}` : "&sort=velocity"}`).then((r) => setRows(r.trends)); }, [workspaceId, platform, q, forBrand]);
  const remix = (t: Trend) => run(() => api(`/trends/${t.id}/remix`, { method: "POST", json: { workspace_id: workspaceId, count: 5 } }), "Remixing — 5 candidates coming to Velocity mode");
  return (
    <div>{wall}
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-2xl font-extrabold">Trends</h1><div className="flex gap-2 items-center"><input className="input w-48" placeholder="Search hooks" value={q} onChange={(e) => setQ(e.target.value)} /><select className="input w-auto" value={platform} onChange={(e) => setPlatform(e.target.value)}><option value="">All platforms</option>{Object.entries(PLATFORM_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select><label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={forBrand} onChange={(e) => setForBrand(e.target.checked)} /> For my brand</label></div></div>
      {!me?.plan.limits.trendRemix && <p className="mt-2 text-sm text-[var(--color-warning)]">Recipes and remixing unlock on paid plans — you can browse hooks for free.</p>}
      {!rows ? <div className="py-20 grid place-items-center"><Spinner /></div> : <div className="mt-4 grid gap-3 md:grid-cols-3 lg:grid-cols-4">{rows.map((t) => <div key={t.id} className="card p-4 flex flex-col cursor-pointer hover:shadow-md" onClick={() => setSel(t)}><div className="flex gap-2 items-center"><Badge>{PLATFORM_LABEL[t.platform]}</Badge><Badge tone="green">🔥 {Math.round(t.velocity_score * 100)}</Badge></div><p className="mt-2 font-semibold line-clamp-3">{t.hook_text}</p><p className="mt-1 text-xs text-[var(--color-muted)]">{t.format_type?.replace(/_/g, " ")} · {fmtNum(t.metrics.views)} views</p><div className="mt-auto pt-3 flex flex-wrap gap-1">{t.niche_tags.slice(0, 3).map((n) => <span key={n} className="badge bg-[var(--color-surface-2)] text-[var(--color-muted)]">{n}</span>)}</div></div>)}</div>}
      <Modal open={!!sel} onClose={() => setSel(null)} title="Trend"> {sel && <div className="text-sm space-y-3"><p className="text-lg font-bold">{sel.hook_text}</p><p className="text-[var(--color-muted)]">{PLATFORM_LABEL[sel.platform]} · {fmtNum(sel.metrics.views)} views · <a className="underline" href={sel.post_url} target="_blank" rel="noreferrer">view original</a></p>
        {sel.locked ? <p className="text-[var(--color-warning)]">Upgrade to see the recipe and remix this trend.</p> : sel.recipe && <><div className="label">Recipe</div><ol className="space-y-1">{sel.recipe.structure.map((s, i) => <li key={i} className="flex gap-2"><span className="w-10 text-[var(--color-faint)]">{s.seconds}s</span><span><b>{s.segment}</b>{s.text_slot ? ` — "${s.text_slot}"` : ""}</span></li>)}</ol><p className="text-[var(--color-muted)]">Style: {sel.recipe.style}. {sel.recipe.why_it_works}</p><button className="btn-primary" onClick={() => { remix(sel); setSel(null); }}>Remix for my brand</button></>}
        <p className="text-xs text-[var(--color-faint)]">We store trend metadata and structure only — never third-party media.</p></div>}</Modal>
    </div>
  );
}
