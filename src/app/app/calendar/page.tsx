"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useMe } from "@/lib/use-me";
import { api, PLATFORM_LABEL } from "@/lib/api";
import { useAction, Spinner, Badge, statusTone, Modal } from "@/components/ui";
type Post = { id: string; status: string; scheduledAt: string; permalink: string | null; lastError: string | null; platform: string; handle: string | null; contentId: string; format: string; hook: string | null; thumbnail_url: string | null; automationId: string | null; automationKind: string | null };
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
/** Calendar (M13): month/week/list views, drag-and-drop reschedule, approve/retry/cancel, ICS export. */
export default function Calendar() {
  const { workspaceId, me } = useMe(); const { run, wall } = useAction();
  const [view, setView] = useState<"month" | "week" | "list">("month"); const [anchor, setAnchor] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const [posts, setPosts] = useState<Post[] | null>(null); const [sel, setSel] = useState<Post | null>(null); const [drag, setDrag] = useState<string | null>(null);
  const from = new Date(anchor.getTime() - 7 * 86.4e6), to = new Date(anchor.getTime() + 42 * 86.4e6);
  const load = useCallback(() => workspaceId && api<{ posts: Post[] }>(`/workspaces/${workspaceId}/calendar?from=${from.toISOString()}&to=${to.toISOString()}`).then((r) => setPosts(r.posts)), [workspaceId, anchor]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  const reschedule = (id: string, at: Date) => run(async () => { await api(`/scheduled-posts/${id}`, { method: "PATCH", json: { scheduled_at: at.toISOString() } }); load(); }, "Rescheduled");
  const act = (id: string, body: Record<string, unknown>, msg: string) => run(async () => { await api(`/scheduled-posts/${id}`, { method: "PATCH", json: body }); setSel(null); load(); }, msg);
  const cancel = (id: string) => run(async () => { await api(`/scheduled-posts/${id}`, { method: "DELETE" }); setSel(null); load(); }, "Cancelled");
  const exportIcs = () => { const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Velocity//EN", ...(posts ?? []).flatMap((p) => ["BEGIN:VEVENT", `UID:${p.id}@velocity`, `DTSTART:${p.scheduledAt.replace(/[-:]/g, "").slice(0, 15)}Z`, `SUMMARY:${PLATFORM_LABEL[p.platform]}: ${(p.hook ?? "").replace(/,/g, "")}`, "END:VEVENT"]), "END:VCALENDAR"]; const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" })); a.download = "velocity.ics"; a.click(); };
  const days: Date[] = []; const start = new Date(anchor); start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); for (let i = 0; i < (view === "week" ? 7 : 42); i++) days.push(new Date(start.getTime() + i * 86.4e6));
  const byDay = (posts ?? []).reduce<Record<string, Post[]>>((m, p) => { (m[dayKey(new Date(p.scheduledAt))] ??= []).push(p); return m; }, {});
  return (
    <div>{wall}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2"><h1 className="text-2xl font-extrabold">Calendar</h1>{!me?.plan.limits.scheduling && <Badge tone="amber">Scheduling requires a paid plan</Badge>}</div>
        <div className="flex items-center gap-2"><button className="btn-ghost" onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}>‹</button><span className="font-semibold w-36 text-center">{anchor.toLocaleString(undefined, { month: "long", year: "numeric" })}</span><button className="btn-ghost" onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}>›</button>
          <div className="flex rounded-xl border border-slate-200 overflow-hidden text-sm">{(["month", "week", "list"] as const).map((v) => <button key={v} className={`px-3 py-1.5 ${view === v ? "bg-brand-600 text-white" : "bg-white"}`} onClick={() => setView(v)}>{v}</button>)}</div><button className="btn-secondary" onClick={exportIcs}>Export .ics</button><button className="btn-secondary" onClick={() => run(async () => { const r = await api<{ feed_url: string }>(`/workspaces/${workspaceId}/calendar?feed=1`); await navigator.clipboard.writeText(r.feed_url); }, "Feed URL copied — subscribe in Google/Apple Calendar")}>Subscribe</button></div>
      </div>
      {!posts ? <div className="py-20 grid place-items-center"><Spinner /></div> : view === "list" ? (
        <div className="mt-4 card overflow-hidden"><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-3">When</th><th className="p-3">Platform</th><th className="p-3">Content</th><th className="p-3">Status</th></tr></thead><tbody>{posts.map((p) => <tr key={p.id} className="border-t border-slate-100 cursor-pointer hover:bg-slate-50" onClick={() => setSel(p)}><td className="p-3">{new Date(p.scheduledAt).toLocaleString()}</td><td className="p-3">{PLATFORM_LABEL[p.platform]} @{p.handle}</td><td className="p-3">{p.hook}</td><td className="p-3"><Badge tone={statusTone(p.status)}>{p.status}</Badge></td></tr>)}{posts.length === 0 && <tr><td className="p-6 text-slate-500" colSpan={4}>Nothing scheduled in this range.</td></tr>}</tbody></table></div>
      ) : (
        <div className="mt-4 grid grid-cols-7 gap-px bg-slate-200 rounded-2xl overflow-hidden border border-slate-200">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="bg-slate-50 p-2 text-xs font-semibold text-slate-500">{d}</div>)}
          {days.map((d) => { const k = dayKey(d); const inMonth = d.getMonth() === anchor.getMonth(); return (
            <div key={k} className={`bg-white min-h-24 p-1.5 ${inMonth ? "" : "opacity-50"} ${drag ? "hover:bg-brand-50" : ""}`} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag) { const p = posts.find((x) => x.id === drag)!; const old = new Date(p.scheduledAt); const at = new Date(d); at.setHours(old.getHours(), old.getMinutes()); reschedule(drag, at); setDrag(null); } }}>
              <div className={`text-xs ${dayKey(new Date()) === k ? "font-bold text-brand-600" : "text-slate-400"}`}>{d.getDate()}</div>
              <div className="space-y-1 mt-1">{(byDay[k] ?? []).map((p) => <div key={p.id} draggable={["scheduled", "pending_approval", "failed", "held"].includes(p.status)} onDragStart={() => setDrag(p.id)} onClick={() => setSel(p)} className={`flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] cursor-pointer border ${p.status === "published" ? "bg-emerald-50 border-emerald-200" : p.status === "failed" || p.status === "held" ? "bg-red-50 border-red-200" : p.status === "pending_approval" ? "bg-amber-50 border-amber-200" : "bg-sky-50 border-sky-200"}`}>{p.thumbnail_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.thumbnail_url} alt={`Thumbnail for ${p.hook ?? "scheduled post"} on ${PLATFORM_LABEL[p.platform]}`} className="h-6 w-4 rounded object-cover" />}<span className="truncate">{new Date(p.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} {PLATFORM_LABEL[p.platform]?.slice(0, 2)} {p.hook}</span></div>)}</div>
            </div>); })}
        </div>
      )}
      <Modal open={!!sel} onClose={() => setSel(null)} title="Scheduled post">{sel && <div className="space-y-3 text-sm">
        <div className="flex gap-2 items-center"><Badge tone={statusTone(sel.status)}>{sel.status}</Badge><span>{PLATFORM_LABEL[sel.platform]} @{sel.handle}</span>{sel.automationId && <Badge>{sel.automationKind === "ghost_mode" ? "Ghost Mode" : "automation"}</Badge>}</div>
        <p className="font-semibold">{sel.hook}</p><p>{new Date(sel.scheduledAt).toLocaleString()}</p>
        {sel.lastError && <p className="text-red-600">{sel.lastError}</p>}{sel.permalink && <a className="underline" href={sel.permalink} target="_blank">View post</a>}
        <div className="flex flex-wrap gap-2 pt-2"><Link href={`/app/content/${sel.contentId}`} className="btn-secondary">Open content</Link>{sel.status === "pending_approval" && <button className="btn-primary" onClick={() => act(sel.id, { approve: true }, "Approved")}>Approve</button>}{["failed", "held"].includes(sel.status) && <button className="btn-primary" onClick={() => act(sel.id, { retry: true }, "Retrying")}>Retry now</button>}{!["published", "publishing", "cancelled"].includes(sel.status) && <><input type="datetime-local" className="input w-auto" onChange={(e) => e.target.value && reschedule(sel.id, new Date(e.target.value)).then(() => setSel(null))} /><button className="btn-danger" onClick={() => cancel(sel.id)}>Cancel post</button></>}</div>
      </div>}</Modal>
    </div>
  );
}
