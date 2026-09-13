"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useMe } from "@/lib/use-me";
import { api, FORMAT_LABEL } from "@/lib/api";
import { useAction, Spinner, Badge, statusTone, Empty } from "@/components/ui";
import { MediaPreview, type Item } from "@/components/media";
import { ScheduleModal } from "@/components/modals";
type Social = { id: string; platform: string; handle: string | null; status: string };
/** Content library (M11): grid/list, filters, bulk actions, cursor pagination. */
export default function Library() {
  const { workspaceId, me, refresh } = useMe(); const { run, wall } = useAction();
  const [items, setItems] = useState<Item[]>([]); const [cursor, setCursor] = useState<string | null>(null); const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("saved,draft,scheduled,published,failed"); const [format, setFormat] = useState(""); const [q, setQ] = useState(""); const [view, setView] = useState<"grid" | "list">("grid"); const [sel, setSel] = useState<string[]>([]);
  const [schedItem, setSchedItem] = useState<Item | null>(null); const [socials, setSocials] = useState<Social[]>([]);
  const load = useCallback(async (more = false) => { if (!workspaceId) return; setLoading(true); const r = await api<{ items: Item[]; next_cursor: string | null }>(`/workspaces/${workspaceId}/content?status=${status}&format=${format}&q=${encodeURIComponent(q)}&limit=24${more && cursor ? `&cursor=${cursor}` : ""}`); setItems((x) => (more ? [...x, ...r.items] : r.items)); setCursor(r.next_cursor); setLoading(false); }, [workspaceId, status, format, q, cursor]);
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [workspaceId, status, format, q]);
  useEffect(() => { if (workspaceId) api<{ socials: Social[] }>(`/workspaces/${workspaceId}/socials`).then((r) => setSocials(r.socials.filter((s) => s.status === "active"))); }, [workspaceId]);
  const bulkDelete = () => run(async () => { await Promise.all(sel.map((id) => api(`/content/${id}`, { method: "DELETE" }))); setItems((x) => x.filter((i) => !sel.includes(i.id))); setSel([]); refresh(); }, "Deleted");
  const download = (i: Item) => run(async () => { const r = await api<{ url: string }>(`/content/${i.id}?download=1`); window.open(r.url, "_blank"); });
  return (
    <div>{wall}
      <div className="flex flex-wrap items-center gap-2 justify-between"><h1 className="text-2xl font-extrabold">Content</h1><div className="flex items-center gap-2"><Badge>Saves {me?.usage.saves}/{me?.plan.limits.saves ?? "∞"}</Badge><Link href="/app/studio" className="btn-primary">+ Create / upload</Link></div></div>
      <div className="mt-4 flex flex-wrap gap-2 items-center">
        <input className="input w-56" placeholder="Search hooks & captions" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}><option value="saved,draft,scheduled,published,failed">All saved</option><option value="saved">Saved</option><option value="draft">Drafts</option><option value="scheduled">Scheduled</option><option value="published">Published</option><option value="skipped">Skipped</option><option value="archived">Archived</option></select>
        <select className="input w-auto" value={format} onChange={(e) => setFormat(e.target.value)}><option value="">All formats</option>{Object.entries(FORMAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <div className="ml-auto flex gap-1"><button className={`btn-ghost ${view === "grid" ? "bg-slate-100" : ""}`} onClick={() => setView("grid")}>▦</button><button className={`btn-ghost ${view === "list" ? "bg-slate-100" : ""}`} onClick={() => setView("list")}>☰</button></div>
      </div>
      {sel.length > 0 && <div className="mt-3 card p-3 flex items-center gap-3 text-sm"><span>{sel.length} selected</span><button className="btn-danger" onClick={bulkDelete}>Delete</button><button className="btn-ghost" onClick={() => setSel([])}>Clear</button></div>}
      {loading && items.length === 0 ? <div className="py-20 grid place-items-center"><Spinner /></div> : items.length === 0 ? <div className="mt-6"><Empty title="Nothing here yet" body="Keep items in Velocity mode to build your library." action={<Link href="/app/velocity" className="btn-primary">Open Velocity mode</Link>} /></div> : view === "grid" ? (
        <div className="mt-4 grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-5">{items.map((i) => <div key={i.id} className="card overflow-hidden group relative">
          <input type="checkbox" className="absolute top-2 left-2 z-10 h-4 w-4" checked={sel.includes(i.id)} onChange={() => setSel(sel.includes(i.id) ? sel.filter((x) => x !== i.id) : [...sel, i.id])} />
          <Link href={`/app/content/${i.id}`}><MediaPreview item={i} className="rounded-none" /></Link>
          <div className="p-2"><div className="flex justify-between items-center"><Badge tone="slate">{FORMAT_LABEL[i.format]}</Badge><Badge tone={statusTone(i.status)}>{i.status}</Badge></div><p className="mt-1 text-xs font-medium line-clamp-2">{i.hook}</p>
            <div className="mt-2 flex gap-1 opacity-0 group-hover:opacity-100 transition"><button className="btn-secondary px-2 py-1 text-xs" onClick={() => setSchedItem(i)}>Schedule</button><button className="btn-ghost px-2 py-1 text-xs" onClick={() => download(i)}>↓</button></div></div>
        </div>)}</div>
      ) : (
        <div className="mt-4 card overflow-hidden"><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-3 w-8"></th><th className="p-3">Hook</th><th className="p-3">Format</th><th className="p-3">Status</th><th className="p-3">Created</th><th className="p-3"></th></tr></thead><tbody>{items.map((i) => <tr key={i.id} className="border-t border-slate-100"><td className="p-3"><input type="checkbox" checked={sel.includes(i.id)} onChange={() => setSel(sel.includes(i.id) ? sel.filter((x) => x !== i.id) : [...sel, i.id])} /></td><td className="p-3"><Link href={`/app/content/${i.id}`} className="font-medium hover:underline">{i.hook}</Link></td><td className="p-3">{FORMAT_LABEL[i.format]}</td><td className="p-3"><Badge tone={statusTone(i.status)}>{i.status}</Badge></td><td className="p-3 text-slate-500">{new Date(i.created_at).toLocaleDateString()}</td><td className="p-3"><button className="btn-secondary px-2 py-1 text-xs" onClick={() => setSchedItem(i)}>Schedule</button></td></tr>)}</tbody></table></div>
      )}
      {cursor && <div className="mt-4 text-center"><button className="btn-secondary" onClick={() => load(true)} disabled={loading}>Load more</button></div>}
      <ScheduleModal item={schedItem} socials={socials} viaSwipe={false} onClose={() => setSchedItem(null)} onDone={() => { setSchedItem(null); load(); }} />
    </div>
  );
}
