"use client";
import { useEffect, useState } from "react";
import { Modal, useAction, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import type { Item, OverlayStyle } from "@/components/media";
type Slide = { title: string; body: string };
const FONTS = ["DejaVu Sans, Arial, sans-serif", "Georgia, serif", "Courier New, monospace"];
/** Studio timeline editor (M10): edit/reorder slides or caption beats, meme lines, then save + re-render. */
export function TimelineEditor({ item, provenance, onClose, onDone }: { item: Item | null; provenance: Record<string, unknown>; onClose: () => void; onDone: () => void }) {
  const { run, busy, wall } = useAction();
  const [slides, setSlides] = useState<Slide[]>([]); const [beats, setBeats] = useState<string[]>([]); const [durations, setDurations] = useState<number[]>([]); const [meme, setMeme] = useState({ top: "", bottom: "" }); const [status, setStatus] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<OverlayStyle>({});
  useEffect(() => { if (!item) return; setSlides(((provenance.slides as Slide[]) ?? []).map((s) => ({ ...s }))); setBeats([...item.on_screen_text]); const bd = provenance.beat_durations as number[] | undefined; setDurations(item.on_screen_text.map((_, i) => bd?.[i] ?? 3)); const m = provenance.meme as { top?: string; bottom?: string } | undefined; setMeme({ top: m?.top ?? "", bottom: m?.bottom ?? "" }); setOverlay(item.overlay_style ?? {}); }, [item, provenance]);
  if (!item) return null;
  const isSlides = item.format === "slideshow", isMeme = item.format === "meme", isBeats = ["hook_demo", "remix", "ai_ugc", "human_ugc", "wall_of_text", "green_screen"].includes(item.format);
  // Only hook_demo/remix/wall_of_text have no synthesized voice track to desync from -- human_ugc/ai_ugc/
  // green_screen beat timing is derived from TTS audio length, so editing it independently there would
  // break lip-sync/pacing.
  const isTimedBeats = item.format === "hook_demo" || item.format === "remix" || item.format === "wall_of_text";
  const move = <T,>(arr: T[], i: number, d: number) => { const a = [...arr]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; };
  const save = () => run(async () => {
    await api(`/content/${item.id}`, { method: "PATCH", json: { ...(isSlides ? { slides, on_screen_text: slides.map((s) => s.title) } : {}), ...(isBeats ? { on_screen_text: beats } : {}), ...(isMeme ? { meme_top: meme.top, meme_bottom: meme.bottom } : {}), ...(isBeats ? { overlay_style: Object.keys(overlay).length ? overlay : null } : {}), ...(isTimedBeats ? { beat_durations: durations } : {}) } });
    setStatus("Rendering…"); const { job_id } = await api<{ job_id: string }>(`/content/${item.id}/rerender`, { method: "POST" });
    for (;;) { await new Promise((r) => setTimeout(r, 2000)); const { job } = await api<{ job: { status: string; error?: string } }>(`/jobs/${job_id}`); if (job.status === "done") break; if (job.status === "failed") throw new Error(job.error ?? "Render failed"); }
    setStatus(null); onDone();
  }, "Re-rendered");
  return (
    <Modal open={!!item} onClose={onClose} title="Timeline" wide>{wall}
      <div className="space-y-3 text-sm">
        {isSlides && slides.map((s, i) => <div key={i} className="card p-3 flex gap-2 items-start"><div className="flex flex-col gap-1"><button className="btn-ghost px-2 py-0.5" onClick={() => setSlides(move(slides, i, -1))}>↑</button><button className="btn-ghost px-2 py-0.5" onClick={() => setSlides(move(slides, i, 1))}>↓</button></div><div className="flex-1 space-y-1"><div className="text-xs text-slate-400">Slide {i + 1} · 2.5s</div><input className="input" value={s.title} onChange={(e) => setSlides(slides.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} /><input className="input" value={s.body} onChange={(e) => setSlides(slides.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} /></div><button className="btn-ghost text-red-600" onClick={() => setSlides(slides.filter((_, j) => j !== i))}>✕</button></div>)}
        {isSlides && slides.length < 10 && <button className="btn-secondary" onClick={() => setSlides([...slides, { title: "New slide", body: "" }])}>+ Slide</button>}
        {isBeats && beats.map((b, i) => <div key={i} className="flex gap-2 items-center">
          <span className="w-14 text-xs text-slate-400">{i === 0 ? "Hook" : `Beat ${i}`}</span>
          {isTimedBeats ? <input type="number" min={0.5} max={30} step={0.5} className="input w-20" value={durations[i] ?? 3} onChange={(e) => setDurations(durations.map((d, j) => (j === i ? Number(e.target.value) : d)))} title="Duration (seconds)" /> : <span className="text-xs text-slate-400 w-20">3s</span>}
          <input className="input" value={b} onChange={(e) => setBeats(beats.map((x, j) => (j === i ? e.target.value : x)))} />
          <button className="btn-ghost px-2" onClick={() => { setBeats(move(beats, i, -1)); setDurations(move(durations, i, -1)); }}>↑</button>
          <button className="btn-ghost px-2" onClick={() => { setBeats(move(beats, i, 1)); setDurations(move(durations, i, 1)); }}>↓</button>
          <button className="btn-ghost text-red-600 px-2" onClick={() => { setBeats(beats.filter((_, j) => j !== i)); setDurations(durations.filter((_, j) => j !== i)); }}>✕</button>
        </div>)}
        {isBeats && <button className="btn-secondary" onClick={() => { setBeats([...beats, "New beat"]); setDurations([...durations, 3]); }}>+ Beat</button>}
        {isBeats && <div className="card p-3 space-y-2">
          <div className="text-xs font-semibold text-slate-500">Text style</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <select className="input" value={overlay.font_family ?? ""} onChange={(e) => setOverlay({ ...overlay, font_family: e.target.value || undefined })}><option value="">Default font</option>{FONTS.map((f) => <option key={f} value={f}>{f.split(",")[0]}</option>)}</select>
            <select className="input" value={overlay.font_size_px ?? ""} onChange={(e) => setOverlay({ ...overlay, font_size_px: e.target.value ? Number(e.target.value) : undefined })}><option value="">Default size</option>{[48, 64, 88, 112, 140].map((n) => <option key={n} value={n}>{n}px</option>)}</select>
            <label className="flex items-center gap-2 px-1"><input type="checkbox" checked={overlay.bold !== false} onChange={(e) => setOverlay({ ...overlay, bold: e.target.checked })} />Bold</label>
            <select className="input" value={overlay.position ?? ""} onChange={(e) => setOverlay({ ...overlay, position: (e.target.value || undefined) as OverlayStyle["position"] })}><option value="">Default position</option><option value="top">Top</option><option value="center">Center</option><option value="bottom">Bottom</option></select>
          </div>
          <div className="flex items-center gap-2"><label className="text-xs text-slate-500">Color</label><input type="color" value={overlay.color ?? "#ffffff"} onChange={(e) => setOverlay({ ...overlay, color: e.target.value })} className="h-8 w-14 rounded border border-slate-200" />{overlay.color && <button className="btn-ghost text-xs px-2" onClick={() => setOverlay({ ...overlay, color: undefined })}>Reset to default</button>}</div>
        </div>}
        {isMeme && <><div><label className="label">Top line</label><input className="input" value={meme.top} onChange={(e) => setMeme({ ...meme, top: e.target.value })} /></div><div><label className="label">Bottom line</label><input className="input" value={meme.bottom} onChange={(e) => setMeme({ ...meme, bottom: e.target.value })} /></div></>}
        {!isSlides && !isBeats && !isMeme && <p className="text-slate-500">This format has no editable timeline.</p>}
        <div className="flex justify-end gap-2 pt-2"><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={save}>{status ?? (busy ? <Spinner /> : "Save & re-render")}</button></div>
      </div>
    </Modal>
  );
}
