"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAction, Modal, Spinner } from "@/components/ui";
import type { Item } from "@/components/media";
import { DEFAULT_VIDEO_ADJUST, videoAdjustCss, VOICE_OPTIONS, type VideoAdjust, type AiVideoEditOp } from "@/lib/video-edit-options";

const TABS = ["trim", "adjust", "ai"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { trim: "Trim", adjust: "Adjust", ai: "AI Tools" };

async function pollJob(jobId: string): Promise<void> {
  for (;;) {
    await new Promise((r) => setTimeout(r, 2000));
    const { job } = await api<{ job: { status: string; error?: string } }>(`/jobs/${jobId}`);
    if (job.status === "done") return;
    if (job.status === "failed") throw new Error(job.error ?? "Edit failed");
  }
}

export function VideoEditModal({ item, onClose, onDone }: { item: Item | null; onClose: () => void; onDone: () => void }) {
  const { run, busy, wall } = useAction();
  const [tab, setTab] = useState<Tab>("trim");
  const durationMs = item?.media.duration_ms ?? 0;
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(durationMs);
  const [crop, setCrop] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [adjust, setAdjust] = useState<VideoAdjust>(DEFAULT_VIDEO_ADJUST);
  const [aiBusy, setAiBusy] = useState<AiVideoEditOp | null>(null);
  const [voiceId, setVoiceId] = useState(VOICE_OPTIONS[0].id);

  const src = item?.media.video_url ?? "";
  const trimChanged = trimStart > 0 || (durationMs > 0 && trimEnd < durationMs);
  const adjustChanged = adjust.brightness !== 1 || adjust.contrast !== 1 || adjust.saturation !== 1;
  const hasChanges = trimChanged || !!crop || adjustChanged;

  const save = () => run(async () => {
    const recipe: Record<string, unknown> = {};
    if (trimChanged) recipe.trim = { startMs: trimStart, endMs: trimEnd };
    if (crop) recipe.crop = crop;
    if (adjustChanged) recipe.adjust = adjust;
    const { job_id } = await api<{ job_id: string }>(`/content/${item!.id}/video-edit`, { method: "POST", json: recipe });
    await pollJob(job_id); onDone();
  }, "Saved");

  const runAiOp = (op: AiVideoEditOp) => run(async () => {
    setAiBusy(op);
    try { const { job_id } = await api<{ job_id: string }>(`/content/${item!.id}/video-edit/ai`, { method: "POST", json: { op, voice_id: op === "voice_swap" ? voiceId : undefined } }); await pollJob(job_id); onDone(); }
    finally { setAiBusy(null); }
  }, "Applied");

  const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

  return (
    <Modal open={!!item} onClose={onClose} title="Edit video" wide>{wall}
      {!item ? null : (
        <div className="space-y-3 text-sm">
          <div className="flex gap-1 border-b border-[var(--color-hairline)]">{TABS.map((t) => <button key={t} className={`px-3 py-2 text-sm font-medium border-b-2 ${tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-[var(--color-muted)]"}`} onClick={() => setTab(t)}>{TAB_LABEL[t]}</button>)}</div>

          <video key={src} src={src} controls className="w-full max-h-80 rounded-xl bg-black" style={{ filter: videoAdjustCss(adjust) }} />

          {tab === "trim" && <div className="space-y-3">
            {durationMs === 0 ? <p className="text-xs text-[var(--color-muted)]">This item has no known duration yet -- trim isn&apos;t available until it does.</p> : <>
              <label className="flex items-center gap-2"><span className="w-16 text-xs">Start</span><input type="range" min={0} max={durationMs} step={100} value={trimStart} onChange={(e) => setTrimStart(Math.min(Number(e.target.value), trimEnd - 500))} className="flex-1" /><span className="w-12 text-xs text-right">{fmt(trimStart)}</span></label>
              <label className="flex items-center gap-2"><span className="w-16 text-xs">End</span><input type="range" min={0} max={durationMs} step={100} value={trimEnd} onChange={(e) => setTrimEnd(Math.max(Number(e.target.value), trimStart + 500))} className="flex-1" /><span className="w-12 text-xs text-right">{fmt(trimEnd)}</span></label>
              <p className="text-xs text-[var(--color-muted)]">Keeping {fmt(trimEnd - trimStart)} of {fmt(durationMs)}</p>
            </>}
          </div>}

          {tab === "adjust" && <div className="space-y-3">
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!crop} onChange={(e) => setCrop(e.target.checked ? { x: 0, y: 0, width: 1080, height: 1920 } : null)} /><span className="text-xs">Crop (pixels, against source resolution)</span></label>
            {crop && <div className="grid grid-cols-4 gap-2">{(["x", "y", "width", "height"] as const).map((k) => <label key={k} className="text-xs">{k}<input type="number" min={0} className="input mt-1" value={crop[k]} onChange={(e) => setCrop({ ...crop, [k]: Number(e.target.value) })} /></label>)}</div>}
            <label className="flex items-center gap-2"><span className="w-24 text-xs">Brightness</span><input type="range" min={0.5} max={1.8} step={0.02} value={adjust.brightness} onChange={(e) => setAdjust({ ...adjust, brightness: Number(e.target.value) })} className="flex-1" /></label>
            <label className="flex items-center gap-2"><span className="w-24 text-xs">Contrast</span><input type="range" min={0.5} max={1.8} step={0.02} value={adjust.contrast} onChange={(e) => setAdjust({ ...adjust, contrast: Number(e.target.value) })} className="flex-1" /></label>
            <label className="flex items-center gap-2"><span className="w-24 text-xs">Saturation</span><input type="range" min={0} max={2} step={0.02} value={adjust.saturation} onChange={(e) => setAdjust({ ...adjust, saturation: Number(e.target.value) })} className="flex-1" /></label>
          </div>}

          {tab === "ai" && <div className="space-y-4">
            <div><button className="btn-secondary" disabled={!!aiBusy} onClick={() => runAiOp("auto_caption")}>{aiBusy === "auto_caption" ? <Spinner /> : "Auto-caption (transcribe & burn in)"}</button></div>
            {item.format === "human_ugc" ? (
              <div className="flex flex-wrap items-center gap-2">
                <select className="input w-auto" value={voiceId} onChange={(e) => setVoiceId(e.target.value)}>{VOICE_OPTIONS.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
                <button className="btn-secondary" disabled={!!aiBusy} onClick={() => runAiOp("voice_swap")}>{aiBusy === "voice_swap" ? <Spinner /> : "Swap voice"}</button>
              </div>
            ) : <p className="text-xs text-[var(--color-muted)]">Voice swap is only available for human UGC items.</p>}
            <p className="text-xs text-[var(--color-muted)]">AI tools apply immediately and don&apos;t need Save below.</p>
          </div>}

          <div className="flex gap-2 justify-end pt-2 border-t border-[var(--color-hairline)]"><button className="btn-ghost" onClick={onClose}>Close</button>{tab !== "ai" && <button className="btn-primary" disabled={busy || !hasChanges} onClick={save}>Save</button>}</div>
        </div>
      )}
    </Modal>
  );
}
