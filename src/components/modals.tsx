"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, PLATFORM_LABEL } from "@/lib/api";
import { useAction, Spinner, Modal } from "@/components/ui";
import type { Item } from "@/components/media";
type Social = { id: string; platform: string; handle: string | null; status: string };
export function EditModal({ item, onClose, onSaved }: { item: Item | null; onClose: () => void; onSaved: (i: Item) => void }) {
  const { run, busy, wall } = useAction(); const [f, setF] = useState({ hook: "", script: "", caption: "", hashtags: "" });
  useEffect(() => { if (item) setF({ hook: item.hook ?? "", script: item.script ?? "", caption: item.caption ?? "", hashtags: item.hashtags.join(" ") }); }, [item]);
  return <Modal open={!!item} onClose={onClose} title="Edit copy">{wall}
    <div className="space-y-3"><div><label className="label">Hook</label><input className="input" value={f.hook} onChange={(e) => setF({ ...f, hook: e.target.value })} /></div><div><label className="label">Script</label><textarea className="input" rows={5} value={f.script} onChange={(e) => setF({ ...f, script: e.target.value })} /></div><div><label className="label">Caption</label><textarea className="input" rows={3} value={f.caption} onChange={(e) => setF({ ...f, caption: e.target.value })} /><div className="text-xs text-slate-400 text-right">{f.caption.length}/2200</div></div><div><label className="label">Hashtags (space separated)</label><input className="input" value={f.hashtags} onChange={(e) => setF({ ...f, hashtags: e.target.value })} /></div>
      <p className="text-xs text-slate-500">Copy changes apply to captions/scripts immediately; re-rendering video with new text happens in Studio.</p>
      <div className="flex gap-2 justify-end"><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={async () => { const r = await run(() => api<{ item: Item }>(`/content/${item!.id}`, { method: "PATCH", json: { hook: f.hook, script: f.script, caption: f.caption, hashtags: f.hashtags.split(/\s+/).map((h) => h.replace(/^#/, "")).filter(Boolean) } }), "Saved"); if (r) onSaved({ ...item!, ...r.item }); }}>Save</button></div></div>
  </Modal>;
}
export function ScheduleModal({ item, socials, onClose, onDone, viaSwipe = true }: { item: Item | null; socials: Social[]; onClose: () => void; onDone: () => void; viaSwipe?: boolean }) {
  const { run, busy, wall } = useAction(); const [sel, setSel] = useState<string[]>([]); const [when, setWhen] = useState(""); const [queue, setQueue] = useState(true); const [now, setNow] = useState(false);
  useEffect(() => { setSel(socials.map((s) => s.id)); }, [socials]);
  const submit = async () => {
    const r = await run(async () => {
      if (now) return api("/publish", { method: "POST", json: { content_item_id: item!.id, social_account_ids: sel } });
      const schedule = { social_account_ids: sel, scheduled_at: queue ? undefined : new Date(when).toISOString(), queue };
      return viaSwipe && item!.status === "candidate" ? api(`/content/${item!.id}/swipe`, { method: "POST", json: { action: "keep", schedule } }) : api("/schedule", { method: "POST", json: { content_item_id: item!.id, ...schedule } });
    }, now ? "Publishing now" : "Scheduled");
    if (r) onDone();
  };
  return <Modal open={!!item} onClose={onClose} title="Schedule">{wall}
    {socials.length === 0 ? <div className="text-sm">No social accounts connected. <Link className="underline" href="/app/settings/socials">Connect one</Link>.</div> : (
      <div className="space-y-4">
        <div><div className="label">Accounts</div><div className="flex flex-wrap gap-2">{socials.map((s) => <button key={s.id} onClick={() => setSel(sel.includes(s.id) ? sel.filter((x) => x !== s.id) : [...sel, s.id])} className={`badge px-3 py-1.5 ${sel.includes(s.id) ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700"}`}>{PLATFORM_LABEL[s.platform]} @{s.handle ?? "account"}</button>)}</div></div>
        <div className="space-y-2 text-sm"><label className="flex items-center gap-2"><input type="radio" checked={queue && !now} onChange={() => { setQueue(true); setNow(false); }} /> Add to queue (next best time per account)</label><label className="flex items-center gap-2"><input type="radio" checked={!queue && !now} onChange={() => { setQueue(false); setNow(false); }} /> Pick a time</label>{!queue && !now && <input type="datetime-local" className="input" value={when} onChange={(e) => setWhen(e.target.value)} />}<label className="flex items-center gap-2"><input type="radio" checked={now} onChange={() => setNow(true)} /> Publish now</label></div>
        <div className="flex gap-2 justify-end"><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || sel.length === 0 || (!queue && !now && !when)} onClick={submit}>{busy ? <Spinner /> : now ? "Publish" : "Schedule"}</button></div>
      </div>)}
  </Modal>;
}
