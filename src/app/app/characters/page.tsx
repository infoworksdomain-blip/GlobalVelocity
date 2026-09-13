"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useMe } from "@/lib/use-me";
import { useAction, Spinner, Badge, Modal } from "@/components/ui";
type C = { id: string; name: string; gender: string | null; ageRange: string | null; styleTags: string[]; settingTags: string[]; referenceImages: string[]; tier: string; locked: boolean; mine: boolean };
/** AI UGC character library (M7) with tier locks and generate-with-character. */
export default function Characters() {
  const { workspaceId } = useMe(); const { run, wall } = useAction(); const [rows, setRows] = useState<C[] | null>(null); const [gender, setGender] = useState(""); const [style, setStyle] = useState(""); const [open, setOpen] = useState(false); const [f, setF] = useState({ name: "", description: "", gender: "female", age_range: "25-34", style_tags: "" }); const { refresh, me } = useMe();
  const create = () => run(async () => { await api("/characters", { method: "POST", json: { ...f, style_tags: f.style_tags.split(",").map((x) => x.trim()).filter(Boolean) } }); setOpen(false); refresh(); api<{ characters: C[] }>("/characters").then((r) => setRows(r.characters)); }, "Character created (4 credits)");
  useEffect(() => { api<{ characters: C[] }>(`/characters?gender=${gender}&style=${style}`).then((r) => setRows(r.characters)); }, [gender, style]);
  const gen = (c: C) => run(() => api(`/workspaces/${workspaceId}/generate`, { method: "POST", json: { count: 5, formats: ["ai_ugc"], character_ids: [c.id] } }), `Generating 5 videos with ${c.name}`);
  return (
    <div>{wall}
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-2xl font-extrabold">AI UGC characters</h1><div className="flex gap-2"><select className="input w-auto" value={gender} onChange={(e) => setGender(e.target.value)}><option value="">Any gender</option><option value="female">Female</option><option value="male">Male</option></select><input className="input w-40" placeholder="Style tag (e.g. saas)" value={style} onChange={(e) => setStyle(e.target.value)} /><button className="btn-primary" onClick={() => setOpen(true)}>+ Create my own</button></div></div>
      <p className="mt-1 text-sm text-slate-500">All characters are synthetic. Videos are flagged as AI-generated when published.</p>
      {!rows ? <div className="py-20 grid place-items-center"><Spinner /></div> : <div className="mt-4 grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">{rows.map((c) => <div key={c.id} className={`card overflow-hidden ${c.locked ? "opacity-70" : ""}`}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={c.referenceImages[0]} alt={`${c.name}, synthetic AI UGC character (${c.gender ?? ""} ${c.ageRange ?? ""})`} className="aspect-square w-full object-cover" /><div className="p-3"><div className="flex justify-between items-center"><b>{c.name}</b>{c.locked ? <Badge tone="amber">{c.tier}+</Badge> : c.mine ? <Badge tone="brand">mine</Badge> : null}</div><div className="text-xs text-slate-500">{c.gender} · {c.ageRange}</div><div className="mt-1 flex flex-wrap gap-1">{c.styleTags.slice(0, 3).map((t) => <span key={t} className="badge bg-slate-100 text-slate-600">{t}</span>)}</div><button className="btn-primary w-full mt-3 text-xs" disabled={c.locked} onClick={() => gen(c)}>{c.locked ? "Upgrade to use" : "Generate 5 videos"}</button>{c.mine && <button className="btn-secondary w-full mt-1 text-xs" onClick={() => run(async () => { await api(`/characters/${c.id}/images`, { method: "POST", json: {} }); refresh(); api<{ characters: C[] }>("/characters").then((r) => setRows(r.characters)); }, "Consistency pack added (12 credits)")}>+ Consistency pack ({c.referenceImages.length} views)</button>}</div></div>)}</div>}
      <Modal open={open} onClose={() => setOpen(false)} title="Create an AI influencer">
        <div className="space-y-3 text-sm"><p className="text-slate-600">A consistent character you can reuse across videos. Generating the reference image costs 4 credits (you have {me?.usage.credits}).</p>
          <input className="input" placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /><textarea className="input" rows={3} placeholder="Describe them: look, vibe, setting…" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-2"><select className="input" value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}><option value="female">Female</option><option value="male">Male</option><option value="nonbinary">Non-binary</option></select><select className="input" value={f.age_range} onChange={(e) => setF({ ...f, age_range: e.target.value })}>{["18-24", "25-34", "35-44", "45-54", "55+"].map((a) => <option key={a}>{a}</option>)}</select></div>
          <input className="input" placeholder="Style tags, comma separated (saas, fitness…)" value={f.style_tags} onChange={(e) => setF({ ...f, style_tags: e.target.value })} />
          <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" disabled={!f.name} onClick={create}>Generate (4 credits)</button></div></div>
      </Modal>
    </div>
  );
}
