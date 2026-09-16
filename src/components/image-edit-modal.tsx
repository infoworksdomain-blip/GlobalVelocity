"use client";
import { useCallback, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { api } from "@/lib/api";
import { useAction, Modal, Spinner } from "@/components/ui";
import type { Item } from "@/components/media";
import { FILTER_PRESETS, DEFAULT_ADJUST, adjustCss, type ImageAdjust, type FilterPresetId, type TextOverlayBox, type ImageEditRecipe, type AiEditOp } from "@/lib/image-filters";

const ASPECTS: { label: string; value: number }[] = [{ label: "9:16", value: 9 / 16 }, { label: "1:1", value: 1 }, { label: "4:5", value: 4 / 5 }];
const TABS = ["adjust", "filters", "text", "ai"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { adjust: "Adjust", filters: "Filters", text: "Text", ai: "AI Tools" };

async function pollJob(jobId: string): Promise<void> {
  for (;;) {
    await new Promise((r) => setTimeout(r, 2000));
    const { job } = await api<{ job: { status: string; error?: string } }>(`/jobs/${jobId}`);
    if (job.status === "done") return;
    if (job.status === "failed") throw new Error(job.error ?? "Edit failed");
  }
}

export function ImageEditModal({ item, workspaceId, onClose, onDone }: { item: Item | null; workspaceId: string; onClose: () => void; onDone: () => void }) {
  const { run, busy, wall } = useAction();
  const [tab, setTab] = useState<Tab>("adjust");
  const [aspect, setAspect] = useState(ASPECTS[0].value);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [adjust, setAdjust] = useState<ImageAdjust>(DEFAULT_ADJUST);
  const [filterPreset, setFilterPreset] = useState<FilterPresetId>("original");
  const [texts, setTexts] = useState<TextOverlayBox[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const textAreaRef = useRef<HTMLDivElement>(null);
  const [aiBusy, setAiBusy] = useState<AiEditOp | null>(null);
  const [masking, setMasking] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paintingRef = useRef(false);

  const src = item?.media.image_urls[0] ?? "";
  const onCropComplete = useCallback((_: Area, pixels: Area) => setCroppedAreaPixels(pixels), []);
  const buildRecipe = (): ImageEditRecipe => {
    const r: ImageEditRecipe = {};
    if (croppedAreaPixels) r.crop = croppedAreaPixels;
    if (rotation) r.rotate = rotation;
    if (adjust.brightness !== 1 || adjust.contrast !== 1 || adjust.saturation !== 1) r.adjust = adjust;
    if (filterPreset !== "original") r.filterPreset = filterPreset;
    if (texts.length) r.textOverlays = texts;
    return r;
  };
  const hasChanges = Object.keys(buildRecipe()).length > 0;

  const save = () => run(async () => { await api(`/content/${item!.id}/image-edit`, { method: "POST", json: buildRecipe() }); onDone(); }, "Saved");

  const runAiOp = (op: AiEditOp, maskKey?: string) => run(async () => {
    setAiBusy(op);
    try { const { job_id } = await api<{ job_id: string }>(`/content/${item!.id}/image-edit/ai`, { method: "POST", json: { op, mask_key: maskKey } }); await pollJob(job_id); onDone(); }
    finally { setAiBusy(null); }
  }, "Applied");

  const startMask = () => {
    setMasking(true);
    requestAnimationFrame(() => { const c = canvasRef.current; if (c) { const ctx = c.getContext("2d")!; ctx.fillStyle = "#000"; ctx.fillRect(0, 0, c.width, c.height); } });
  };
  const paintAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current; if (!c) return;
    const rect = c.getBoundingClientRect(); const x = ((e.clientX - rect.left) / rect.width) * c.width; const y = ((e.clientY - rect.top) / rect.height) * c.height;
    const ctx = c.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, Math.max(c.width, c.height) * 0.04, 0, Math.PI * 2); ctx.fill();
  };
  const submitMask = () => run(async () => {
    const c = canvasRef.current; if (!c) return;
    const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), "image/png"));
    const pre = await api<{ upload_url: string; key: string }>(`/workspaces/${workspaceId}/upload`, { method: "POST", json: { filename: "mask.png", content_type: "image/png" } });
    await fetch(pre.upload_url, { method: "PUT", body: blob, headers: { "content-type": "image/png" } });
    setMasking(false);
    await runAiOp("inpaint", pre.key);
  });

  const addText = () => setTexts([...texts, { text: "New text", xPct: 50, yPct: 50, fontSizePx: 64, color: "#ffffff", bold: true }]);
  const updateText = (i: number, patch: Partial<TextOverlayBox>) => setTexts(texts.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  return (
    <Modal open={!!item} onClose={onClose} title="Edit image" wide>{wall}
      {!item ? null : (
        <div className="space-y-3 text-sm">
          <div className="flex gap-1 border-b border-[var(--color-hairline)]">{TABS.map((t) => <button key={t} className={`px-3 py-2 text-sm font-medium border-b-2 ${tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-[var(--color-muted)]"}`} onClick={() => setTab(t)}>{TAB_LABEL[t]}</button>)}</div>

          {tab === "adjust" && <div className="space-y-3">
            <div className="relative h-80 w-full bg-black rounded-xl overflow-hidden">
              <Cropper image={src} crop={crop} zoom={zoom} rotation={rotation} aspect={aspect} onCropChange={setCrop} onZoomChange={setZoom} onRotationChange={setRotation} onCropComplete={onCropComplete} style={{ mediaStyle: { filter: adjustCss(adjust) + " " + (FILTER_PRESETS.find((p) => p.id === filterPreset)?.css ?? "none") } }} />
            </div>
            <div className="flex gap-2">{ASPECTS.map((a) => <button key={a.label} className={`badge px-3 py-1.5 ${aspect === a.value ? "bg-brand-600 text-white" : "bg-[var(--color-surface-2)]"}`} onClick={() => setAspect(a.value)}>{a.label}</button>)}</div>
            <label className="flex items-center gap-2"><span className="w-24 text-xs">Zoom</span><input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1" /></label>
            <label className="flex items-center gap-2"><span className="w-24 text-xs">Rotate</span><input type="range" min={-180} max={180} step={1} value={rotation} onChange={(e) => setRotation(Number(e.target.value))} className="flex-1" /></label>
            <label className="flex items-center gap-2"><span className="w-24 text-xs">Brightness</span><input type="range" min={0.5} max={1.8} step={0.02} value={adjust.brightness} onChange={(e) => setAdjust({ ...adjust, brightness: Number(e.target.value) })} className="flex-1" /></label>
            <label className="flex items-center gap-2"><span className="w-24 text-xs">Contrast</span><input type="range" min={0.5} max={1.8} step={0.02} value={adjust.contrast} onChange={(e) => setAdjust({ ...adjust, contrast: Number(e.target.value) })} className="flex-1" /></label>
            <label className="flex items-center gap-2"><span className="w-24 text-xs">Saturation</span><input type="range" min={0} max={2} step={0.02} value={adjust.saturation} onChange={(e) => setAdjust({ ...adjust, saturation: Number(e.target.value) })} className="flex-1" /></label>
          </div>}

          {tab === "filters" && <div className="grid grid-cols-4 gap-2">
            {FILTER_PRESETS.map((p) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <button key={p.id} className={`rounded-lg overflow-hidden border-2 ${filterPreset === p.id ? "border-brand-600" : "border-transparent"}`} onClick={() => setFilterPreset(p.id)}>
                <img src={src} alt={p.label} className="aspect-square w-full object-cover" style={{ filter: p.css }} />
                <div className="text-xs py-1 bg-[var(--color-surface-2)]">{p.label}</div>
              </button>
            ))}
          </div>}

          {tab === "text" && <div className="space-y-3">
            <div ref={textAreaRef} className="relative h-80 w-full bg-black rounded-xl overflow-hidden select-none"
              onPointerMove={(e) => { if (dragIdx === null || !textAreaRef.current) return; const r = textAreaRef.current.getBoundingClientRect(); updateText(dragIdx, { xPct: Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)), yPct: Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)) }); }}
              onPointerUp={() => setDragIdx(null)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="Preview" className="h-full w-full object-cover pointer-events-none" style={{ filter: adjustCss(adjust) + " " + (FILTER_PRESETS.find((p) => p.id === filterPreset)?.css ?? "none") }} />
              {texts.map((t, i) => <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2 cursor-move font-extrabold" style={{ left: `${t.xPct}%`, top: `${t.yPct}%`, color: t.color, fontSize: t.fontSizePx / 2.5, fontWeight: t.bold === false ? 500 : 800, textShadow: "0 0 6px rgba(0,0,0,.8)" }} onPointerDown={() => setDragIdx(i)}>{t.text || "Text"}</div>)}
            </div>
            <button className="btn-secondary" disabled={texts.length >= 5} onClick={addText}>+ Text box</button>
            {texts.map((t, i) => <div key={i} className="card p-3 flex flex-wrap items-center gap-2">
              <input className="input flex-1 min-w-[120px]" value={t.text} onChange={(e) => updateText(i, { text: e.target.value })} />
              <input type="color" value={t.color} onChange={(e) => updateText(i, { color: e.target.value })} className="h-8 w-10 rounded border border-[var(--color-hairline)]" />
              <select className="input w-auto" value={t.fontSizePx} onChange={(e) => updateText(i, { fontSizePx: Number(e.target.value) })}>{[32, 48, 64, 88, 112].map((n) => <option key={n} value={n}>{n}px</option>)}</select>
              <button className="btn-ghost text-[var(--color-danger)]" onClick={() => setTexts(texts.filter((_, j) => j !== i))}>Remove</button>
            </div>)}
          </div>}

          {tab === "ai" && <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button className="btn-secondary" disabled={!!aiBusy} onClick={() => runAiOp("bg_remove")}>{aiBusy === "bg_remove" ? <Spinner /> : "Remove background"}</button>
              <button className="btn-secondary" disabled={!!aiBusy} onClick={() => runAiOp("upscale")}>{aiBusy === "upscale" ? <Spinner /> : "Upscale 2x"}</button>
            </div>
            {!masking ? <button className="btn-secondary" disabled={!!aiBusy} onClick={startMask}>Remove object (paint over it)</button> : (
              <div className="space-y-2">
                <p className="text-xs text-[var(--color-muted)]">Paint over the area you want removed, then apply.</p>
                <div className="relative h-80 w-full bg-black rounded-xl overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="Preview" className="absolute inset-0 h-full w-full object-cover opacity-60" />
                  <canvas ref={canvasRef} width={540} height={960} className="absolute inset-0 h-full w-full opacity-50 cursor-crosshair"
                    onPointerDown={(e) => { paintingRef.current = true; paintAt(e); }} onPointerMove={(e) => paintingRef.current && paintAt(e)} onPointerUp={() => (paintingRef.current = false)} onPointerLeave={() => (paintingRef.current = false)} />
                </div>
                <div className="flex gap-2"><button className="btn-ghost" onClick={() => setMasking(false)}>Cancel</button><button className="btn-primary" disabled={!!aiBusy} onClick={submitMask}>{aiBusy === "inpaint" ? <Spinner /> : "Apply"}</button></div>
              </div>
            )}
            <p className="text-xs text-[var(--color-muted)]">AI tools apply immediately and don&apos;t need Save below.</p>
          </div>}

          <div className="flex gap-2 justify-end pt-2 border-t border-[var(--color-hairline)]"><button className="btn-ghost" onClick={onClose}>Close</button>{tab !== "ai" && <button className="btn-primary" disabled={busy || !hasChanges} onClick={save}>Save</button>}</div>
        </div>
      )}
    </Modal>
  );
}
