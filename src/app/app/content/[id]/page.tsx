"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, FORMAT_LABEL, PLATFORM_LABEL, fmtNum } from "@/lib/api";
import { useAction, Spinner, Badge, statusTone } from "@/components/ui";
import { MediaPreview, type Item } from "@/components/media";
import { EditModal, ScheduleModal } from "@/components/modals";
import { TimelineEditor } from "@/components/timeline-editor";
import { ImageEditModal } from "@/components/image-edit-modal";
import { useMe } from "@/lib/use-me";
type Detail = Item & { versions: { id: string; version: number; snapshot: Record<string, unknown>; createdAt: string }[]; scheduled_posts: { id: string; status: string; scheduledAt: string; permalink: string | null; platform: string; handle: string | null }[]; latest_metrics: { views: number; likes: number; comments: number; shares: number } | null; provenance: Record<string, unknown> };
type Social = { id: string; platform: string; handle: string | null; status: string };
export default function ContentDetail() {
  const { id } = useParams<{ id: string }>(); const router = useRouter(); const { workspaceId, refresh } = useMe(); const { run, wall } = useAction();
  const [item, setItem] = useState<Detail | null>(null); const [editing, setEditing] = useState(false); const [timeline, setTimeline] = useState(false); const [sched, setSched] = useState(false); const [imgEdit, setImgEdit] = useState(false); const [socials, setSocials] = useState<Social[]>([]);
  const load = () => api<{ item: Detail }>(`/content/${id}`).then((r) => setItem(r.item));
  const [rerendering, setRerendering] = useState(false);
  const rerender = () => run(async () => { const { job_id } = await api<{ job_id: string }>(`/content/${id}/rerender`, { method: "POST" }); setRerendering(true); const poll = async () => { const { job } = await api<{ job: { status: string; error?: string } }>(`/jobs/${job_id}`); if (job.status === "done") { setRerendering(false); load(); } else if (job.status === "failed") { setRerendering(false); throw new Error(job.error ?? "Render failed"); } else setTimeout(poll, 2000); }; await poll(); }, "Re-render queued");
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);
  useEffect(() => { if (workspaceId) api<{ socials: Social[] }>(`/workspaces/${workspaceId}/socials`).then((r) => setSocials(r.socials.filter((s) => s.status === "active"))); }, [workspaceId]);
  if (!item) return <div className="py-20 grid place-items-center"><Spinner /></div>;
  const m = item.latest_metrics;
  return (
    <div className="grid gap-6 md:grid-cols-[340px_1fr]">{wall}
      <div><MediaPreview item={item} /><div className="mt-3 flex flex-wrap gap-2"><button className="btn-primary" onClick={() => setSched(true)}>Schedule</button><button className="btn-secondary" onClick={() => setEditing(true)}>Edit</button><button className="btn-secondary" onClick={() => setTimeline(true)}>Timeline</button>{item.media.image_urls.filter(Boolean).length > 0 && <button className="btn-secondary" onClick={() => setImgEdit(true)}>Edit image</button>}<button className="btn-secondary" disabled={rerendering} onClick={rerender}>{rerendering ? "Rendering…" : "Re-render"}</button><button className="btn-secondary" onClick={() => run(async () => { const r = await api<{ url: string }>(`/content/${id}?download=1`); window.open(r.url, "_blank"); })}>Download</button><button className="btn-secondary" onClick={() => run(() => api(`/content/${id}/similar`, { method: "POST", json: { count: 5 } }), "Generating 5 similar — check Velocity mode")}>Generate similar</button><button className="btn-secondary" onClick={() => run(async () => { await api(`/content/${id}?action=duplicate`, { method: "POST" }); refresh(); }, "Duplicated")}>Duplicate</button><button className="btn-danger" onClick={() => run(async () => { await api(`/content/${id}`, { method: "DELETE" }); refresh(); router.push("/app/content"); })}>Delete</button></div></div>
      <div className="space-y-4">
        <div className="flex gap-2 items-center"><Badge tone="brand">{FORMAT_LABEL[item.format]}</Badge><Badge tone={statusTone(item.status)}>{item.status}</Badge>{item.character && <Badge>{item.character.name}</Badge>}</div>
        <h1 className="text-2xl font-extrabold">{item.hook}</h1>
        {item.script && <div className="card p-4"><div className="label">Script</div><p className="text-sm whitespace-pre-line">{item.script}</p></div>}
        <div className="card p-4"><div className="label">Caption</div><p className="text-sm">{item.caption}</p><p className="text-xs text-brand-600 mt-1">{item.hashtags.map((h) => `#${h}`).join(" ")}</p></div>
        {m && <div className="grid grid-cols-4 gap-3">{[["Views", m.views], ["Likes", m.likes], ["Comments", m.comments], ["Shares", m.shares]].map(([l, v]) => <div key={l as string} className="kpi"><div className="text-xs text-[var(--color-muted)]">{l}</div><div className="text-xl font-bold">{fmtNum(v as number)}</div></div>)}</div>}
        <div className="card p-4"><div className="label">Posts</div>{item.scheduled_posts.length === 0 ? <p className="text-sm text-[var(--color-muted)]">Not scheduled yet.</p> : <ul className="text-sm space-y-1">{item.scheduled_posts.map((p) => <li key={p.id} className="flex justify-between"><span>{PLATFORM_LABEL[p.platform]} @{p.handle} · {new Date(p.scheduledAt).toLocaleString()}</span><span className="flex gap-2 items-center"><Badge tone={statusTone(p.status)}>{p.status}</Badge>{p.permalink && <a className="underline" href={p.permalink} target="_blank">View</a>}</span></li>)}</ul>}<Link href="/app/calendar" className="text-xs underline text-[var(--color-muted)] mt-2 inline-block">Open calendar</Link></div>
        <div className="card p-4"><div className="label">Versions</div>{item.versions.length === 0 ? <p className="text-sm text-[var(--color-muted)]">No edits yet.</p> : <ul className="text-sm space-y-1">{item.versions.map((v) => <li key={v.id} className="flex justify-between"><span>v{v.version} · {String(v.snapshot.hook ?? "")}</span><span className="text-[var(--color-muted)]">{new Date(v.createdAt).toLocaleString()}</span></li>)}</ul>}</div>
        <div className="card p-4"><div className="label">Provenance</div><pre className="text-xs text-[var(--color-muted)] overflow-x-auto">{JSON.stringify(item.provenance, null, 2)}</pre></div>
      </div>
      <TimelineEditor item={timeline ? item : null} provenance={item.provenance} onClose={() => setTimeline(false)} onDone={() => { setTimeline(false); load(); }} />
      <EditModal item={editing ? item : null} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />
      <ImageEditModal item={imgEdit ? item : null} workspaceId={workspaceId ?? ""} onClose={() => setImgEdit(false)} onDone={() => { setImgEdit(false); load(); }} />
      <ScheduleModal item={sched ? item : null} socials={socials} viaSwipe={false} onClose={() => setSched(false)} onDone={() => { setSched(false); load(); }} />
    </div>
  );
}
