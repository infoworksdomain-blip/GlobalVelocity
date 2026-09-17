"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMe } from "@/lib/use-me";
import { api, FORMAT_LABEL, PLATFORM_LABEL } from "@/lib/api";
import { useAction, Spinner, Badge, Modal, Empty } from "@/components/ui";
import { MediaPreview, type Item } from "@/components/media";
import { EditModal, ScheduleModal } from "@/components/modals";
import { VideoEditModal } from "@/components/video-edit-modal";
import { TimelineEditor } from "@/components/timeline-editor";
type Stack = { items: Item[]; remaining: number; generating: number; refilled: boolean; daily_limit: number; saves_limit: number | null };
type Social = { id: string; platform: string; handle: string | null; status: string };

/** Velocity mode (M5): swipe/keyboard approval with undo, edit, schedule-on-keep, prefetch and auto-refill. */
export default function Blitz() {
  const { workspaceId, me, refresh } = useMe(); const { run, wall } = useAction();
  const [stack, setStack] = useState<Stack | null>(null); const [dir, setDir] = useState<"l" | "r" | null>(null); const [format, setFormat] = useState(""); const [last, setLast] = useState<Item | null>(null);
  const [editing, setEditing] = useState<Item | null>(null); const [scheduling, setScheduling] = useState<Item | null>(null); const [videoEditing, setVideoEditing] = useState<Item | null>(null); const [timelineEditing, setTimelineEditing] = useState<Item | null>(null); const [socials, setSocials] = useState<Social[]>([]); const [kept, setKept] = useState(0);
  const busy = useRef(false);
  const load = useCallback(async () => { if (!workspaceId) return; const s = await api<Stack>(`/workspaces/${workspaceId}/blitz?limit=8${format ? `&format=${format}` : ""}`); setStack(s); }, [workspaceId, format]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (workspaceId) api<{ socials: Social[] }>(`/workspaces/${workspaceId}/socials`).then((r) => setSocials(r.socials.filter((s) => s.status === "active"))); }, [workspaceId]);
  useEffect(() => { if (stack && stack.items.length === 0 && stack.generating > 0) { const t = setTimeout(load, 3000); return () => clearTimeout(t); } }, [stack, load]);
  const top = stack?.items[0];
  const swipe = useCallback(async (action: "keep" | "skip") => {
    if (!top || busy.current) return; busy.current = true; setDir(action === "keep" ? "r" : "l");
    const ok = await run(async () => api(`/content/${top.id}/swipe`, { method: "POST", json: { action } }));
    setTimeout(() => { setDir(null); busy.current = false; }, 320);
    if (ok) { setLast(top); if (action === "keep") { setKept((k) => k + 1); refresh(); } setStack((s) => s ? { ...s, items: s.items.slice(1), remaining: s.remaining - 1 } : s); if ((stack?.items.length ?? 0) <= 3) load(); }
    else { setDir(null); busy.current = false; }
  }, [top, run, refresh, stack, load]);
  const undo = async () => { if (!last) return; const ok = await run(async () => api(`/content/${last.id}/swipe`, { method: "POST", json: { action: "undo" } }), "Undone"); if (ok) { setStack((s) => s ? { ...s, items: [last, ...s.items] } : s); setLast(null); refresh(); } };
  useEffect(() => { const h = (e: KeyboardEvent) => { if (editing || scheduling || videoEditing || timelineEditing || (e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return; if (e.key === "ArrowRight" || e.key === "k") swipe("keep"); if (e.key === "ArrowLeft" || e.key === "s") swipe("skip"); if (e.key === "z" || e.key === "u") undo(); if (e.key === "e" && top) setEditing(top); if (e.key === "c" && top) setScheduling(top); if (e.key === "v" && top && top.media.video_url) setVideoEditing(top); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); });
  // touch swipe
  const touch = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touch.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => { if (touch.current === null) return; const dx = e.changedTouches[0].clientX - touch.current; touch.current = null; if (dx > 80) swipe("keep"); else if (dx < -80) swipe("skip"); };
  const generateMore = () => run(async () => { await api(`/workspaces/${workspaceId}/generate`, { method: "POST", json: { count: 20 } }); setTimeout(load, 2000); }, "Generating 20 more…");

  return (
    <div className="mx-auto max-w-5xl">{wall}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-extrabold">Velocity mode</h1><p className="text-sm text-[var(--color-muted)]">→ or K to keep · ← or S to skip · Z undo · E edit · C schedule · V edit video</p></div>
        <div className="flex items-center gap-2 text-sm"><select className="input w-auto" value={format} onChange={(e) => setFormat(e.target.value)}><option value="">All formats</option>{Object.entries(FORMAT_LABEL).filter(([k]) => k !== "upload").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select><Badge tone="brand">{kept} kept this session</Badge><Badge>{stack?.remaining ?? 0} left{stack?.generating ? ` · ${stack.generating} rendering` : ""}</Badge></div>
      </div>
      {!stack ? <div className="py-20 grid place-items-center"><Spinner /></div> : !top ? (
        stack.generating > 0 ? <div className="py-20 text-center"><Spinner className="mx-auto" /><p className="mt-3 text-[var(--color-muted)]">Rendering {stack.generating} new candidates…</p></div> :
        <Empty title="Your stack is empty" body={`Generate more candidates (daily limit ${stack.daily_limit} on your plan).`} action={<div className="flex gap-2 justify-center"><button className="btn-primary" onClick={generateMore}>Generate 20 more</button><Link href="/app/content" className="btn-secondary">Go to library</Link></div>} />
      ) : (
        <div className="mt-6 grid gap-8 md:grid-cols-[360px_1fr] items-start">
          <div className="relative mx-auto w-[320px]" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            {stack.items[1] && <div className="absolute inset-0 scale-95 translate-y-3 opacity-50 pointer-events-none"><MediaPreview item={stack.items[1]} /></div>}
            <div className={`relative ${dir === "r" ? "swipe-right" : dir === "l" ? "swipe-left" : ""}`}><MediaPreview item={top} autoPlay /></div>
            <div className="mt-4 flex items-center justify-center gap-4">
              <button onClick={() => swipe("skip")} className="h-14 w-14 rounded-full bg-[var(--color-surface)] border border-[var(--color-hairline)] text-2xl shadow hover:bg-[var(--color-surface-2)]" title="Skip (←)">✕</button>
              <button onClick={undo} disabled={!last} className="h-10 w-10 rounded-full bg-[var(--color-surface)] border border-[var(--color-hairline)] text-sm shadow disabled:opacity-40" title="Undo (Z)">↶</button>
              <button onClick={() => swipe("keep")} className="h-14 w-14 rounded-full bg-brand-600 text-white text-2xl shadow hover:bg-brand-700" title="Keep (→)">♥</button>
            </div>
          </div>
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2 flex-wrap"><Badge tone="brand">{FORMAT_LABEL[top.format]}</Badge>{top.character && <Badge>{top.character.name}</Badge>}{top.predicted_score !== null && <Badge tone="green">Score {Math.round((top.predicted_score ?? 0) * 100)}</Badge>}<span className="text-xs text-[var(--color-faint)]">{top.media.duration_ms ? `${Math.round(top.media.duration_ms / 1000)}s` : ""}</span></div>
            <h2 className="text-2xl font-bold">{top.hook}</h2>
            {top.script && <div><div className="label">Script</div><p className="text-sm text-[var(--color-text)] whitespace-pre-line">{top.script}</p></div>}
            <div><div className="label">Caption</div><p className="text-sm text-[var(--color-text)]">{top.caption}</p><p className="text-xs text-brand-600 mt-1">{top.hashtags.map((h) => `#${h}`).join(" ")}</p></div>
            <div className="flex gap-2 pt-2 flex-wrap"><button className="btn-secondary" onClick={() => setEditing(top)}>Edit (E)</button><button className="btn-secondary" onClick={() => setTimelineEditing(top)}>Timeline</button>{top.media.video_url && <button className="btn-secondary" onClick={() => setVideoEditing(top)}>Edit video (V)</button>}<button className="btn-secondary" onClick={() => setScheduling(top)} disabled={!me?.plan.limits.scheduling}>{me?.plan.limits.scheduling ? "Keep & schedule (C)" : "Schedule (paid plans)"}</button></div>
          </div>
        </div>
      )}
      <EditModal item={editing} onClose={() => setEditing(null)} onSaved={(u) => { setStack((s) => s ? { ...s, items: s.items.map((i) => (i.id === u.id ? u : i)) } : s); setEditing(null); }} />
      <ScheduleModal item={scheduling} socials={socials} onClose={() => setScheduling(null)} onDone={() => { setScheduling(null); setLast(null); setStack((s) => s ? { ...s, items: s.items.slice(1) } : s); setKept((k) => k + 1); refresh(); if ((stack?.items.length ?? 0) <= 3) load(); }} />
      {videoEditing && <VideoEditModal key={videoEditing.id} item={videoEditing} onClose={() => setVideoEditing(null)} onDone={() => { setVideoEditing(null); load(); }} />}
      {timelineEditing && <TimelineEditor key={timelineEditing.id} item={timelineEditing} provenance={(timelineEditing as unknown as { provenance?: Record<string, unknown> }).provenance ?? {}} onClose={() => setTimelineEditing(null)} onDone={() => { setTimelineEditing(null); load(); }} />}
    </div>
  );
}

