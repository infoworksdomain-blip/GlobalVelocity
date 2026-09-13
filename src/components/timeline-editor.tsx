"use client";
import { useEffect, useState } from "react";
import { Modal, useAction, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import type { Item } from "@/components/media";
type Slide = { title: string; body: string };
/** Studio timeline editor (M10): edit/reorder slides or caption beats, meme lines, then save + re-render. */
export function TimelineEditor({ item, provenance, onClose, onDone }: { item: Item | null; provenance: Record<string, unknown>; onClose: () => void; onDone: () => void }) {
  const { run, busy, wall } = useAction();
  const [slides, setSlides] = useState<Slide[]>([]); const [beats, setBeats] = useState<string[]>([]); const [meme, setMeme] = useState({ top: "", bottom: "" }); const [status, setStatus] = useState<string | null>(null);
  useEffect(() => { if (!item) return; setSlides(((provenance.slides as Slide[]) ?? []).map((s) => ({ ...s }))); setBeats([...item.on_screen_text]); const m = provenance.meme as { top?: string; bottom?: string } | undefined; setMeme({ top: m?.top ?? "", bottom: m?.bottom ?? "" }); }, [item, provenance]);
  if (!item) return null;
  const isSlides = item.format === "slideshow", isMeme = item.format === "meme", isBeats = ["hook_demo", "remix", "ai_ugc", "human_ugc"].includes(item.format);
  const move = <T,>(arr: T[], i: number, d: number) => { const a = [...arr]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; };
  const save = () => run(async () => {
    await api(`/content/${item.id}`, { method: "PATCH", json: { ...(isSlides ? { slides, on_screen_text: slides.map((s) => s.title) } : {}), ...(isBeats ? { on_screen_text: beats } : {}), ...(isMeme ? { meme_top: meme.top, meme_bottom: meme.bottom } : {}) } });
    setStatus("Rendering…"); const { job_id } = await api<{ job_id: string }>(`/content/${item.id}/rerender`, { method: "POST" });
    for (;;) { await new Promise((r) => setTimeout(r, 2000)); const { job } = await api<{ job: { status: string; error?: string } }>(`/jobs/${job_id}`); if (job.status === "done") break; if (job.status === "failed") throw new Error(job.error ?? "Render failed"); }
    setStatus(null); onDone();
  }, "Re-rendered");
  return (
    <Modal open={!!item} onClose={onClose} title="Timeline" wide>{wall}
      <div className="space-y-3 text-sm">
        {isSlides && slides.map((s, i) => <div key={i} className="card p-3 flex gap-2 items-start"><div className="flex flex-col gap-1"><button className="btn-ghost px-2 py-0.5" onClick={() => setSlides(move(slides, i, -1))}>↑</button><button className="btn-ghost px-2 py-0.5" onClick={() => setSlides(move(slides, i, 1))}>↓</button></div><div className="flex-1 space-y-1"><div className="text-xs text-slate-400">Slide {i + 1} · 2.5s</div><input className="input" value={s.title} onChange={(e) => setSlides(slides.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} /><input className="input" value={s.body} onChange={(e) => setSlides(slides.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} /></div><button className="btn-ghost text-red-600" onClick={() => setSlides(slides.filter((_, j) => j !== i))}>✕</button></div>)}
        {isSlides && slides.length < 10 && <button className="btn-secondary" onClick={() => setSlides([...slides, { title: "New slide", body: "" }])}>+ Slide</button>}
        {isBeats && beats.map((b, i) => <div key={i} className="flex gap-2 items-center"><span className="w-14 text-xs text-slate-400">{i === 0 ? "Hook" : `Beat ${i}`} · 3s</span><input className="input" value={b} onChange={(e) => setBeats(beats.map((x, j) => (j === i ? e.target.value : x)))} /><button className="btn-ghost px-2" onClick={() => setBeats(move(beats, i, -1))}>↑</button><button className="btn-ghost px-2" onClick={() => setBeats(move(beats, i, 1))}>↓</button><button className="btn-ghost text-red-600 px-2" onClick={() => setBeats(beats.filter((_, j) => j !== i))}>✕</button></div>)}
        {isBeats && <button className="btn-secondary" onClick={() => setBeats([...beats, "New beat"])}>+ Beat</button>}
        {isMeme && <><div><label className="label">Top line</label><input className="input" value={meme.top} onChange={(e) => setMeme({ ...meme, top: e.target.value })} /></div><div><label className="label">Bottom line</label><input className="input" value={meme.bottom} onChange={(e) => setMeme({ ...meme, bottom: e.target.value })} /></div></>}
        {!isSlides && !isBeats && !isMeme && <p className="text-slate-500">This format has no editable timeline.</p>}
        <div className="flex justify-end gap-2 pt-2"><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={save}>{status ?? (busy ? <Spinner /> : "Save & re-render")}</button></div>
      </div>
    </Modal>
  );
}
