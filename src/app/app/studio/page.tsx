"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/lib/use-me";
import { api, FORMAT_LABEL } from "@/lib/api";
import { useAction, Spinner, Badge } from "@/components/ui";
type Char = { id: string; name: string; locked: boolean };
/** Content Studio (M10) + AI Studio entry (M9): generate targeted batches, upload media, brand assets. */
export default function Studio() {
  const { workspaceId, me, refresh } = useMe(); const { run, busy, wall } = useAction(); const router = useRouter();
  const [formats, setFormats] = useState<string[]>(["ai_ugc", "slideshow"]); const [count, setCount] = useState(10); const [chars, setChars] = useState<Char[]>([]); const [charId, setCharId] = useState(""); const [lang, setLang] = useState("");
  const [file, setFile] = useState<File | null>(null); const [purpose, setPurpose] = useState<"content" | "asset">("content"); const [kind, setKind] = useState("screenshot"); const [hook, setHook] = useState(""); const [caption, setCaption] = useState(""); const [progress, setProgress] = useState<string | null>(null);
  const [est, setEst] = useState<number | null>(null); const [imgs, setImgs] = useState(1); const [secs, setSecs] = useState(15); const [prompt, setPrompt] = useState(""); const [script, setScript] = useState("");
  useEffect(() => { api<{ characters: Char[] }>("/characters").then((r) => setChars(r.characters.filter((c) => !c.locked))); }, []);
  useEffect(() => { api<{ credits: number }>("/credits", { method: "POST", json: { images: imgs, video_seconds: secs } }).then((r) => setEst(r.credits)); }, [imgs, secs]);
  const generate = () => run(async () => { await api(`/workspaces/${workspaceId}/generate`, { method: "POST", json: { count, formats, character_ids: charId ? [charId] : undefined, language: lang || undefined, source: "studio" } }); router.push("/app/velocity"); }, `Generating ${count} — opening Velocity mode`);
  const upload = () => run(async () => {
    if (!file) return; setProgress("Requesting upload…");
    const p = await api<{ upload_url: string; key: string }>(`/workspaces/${workspaceId}/upload`, { method: "POST", json: { filename: file.name, content_type: file.type, purpose } });
    setProgress("Uploading…"); const r = await fetch(p.upload_url, { method: "PUT", headers: { "content-type": file.type }, body: file }); if (!r.ok) throw new Error("Upload failed — check S3/MinIO CORS and credentials");
    setProgress("Registering…"); await api(`/workspaces/${workspaceId}/upload`, { method: "PUT", json: { key: p.key, purpose, kind, mime: file.type, hook: hook || undefined, caption: caption || undefined } });
    setProgress(null); setFile(null); refresh(); if (purpose === "content") router.push("/app/content");
  }, purpose === "content" ? "Added to library" : "Asset saved");
  return (
    <div>{wall}<h1 className="text-2xl font-extrabold mb-4">Studio</h1>
    <div className="grid gap-6 md:grid-cols-2">
      <div className="card p-6 space-y-4">
        <h2 className="text-xl font-bold">Generate a targeted batch</h2>
        <div><div className="label">Formats</div><div className="flex flex-wrap gap-2">{Object.entries(FORMAT_LABEL).filter(([k]) => k !== "upload").map(([k, v]) => <button key={k} onClick={() => setFormats(formats.includes(k) ? formats.filter((f) => f !== k) : [...formats, k])} className={`badge px-3 py-1.5 ${formats.includes(k) ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700"}`}>{v}</button>)}</div></div>
        <div className="grid grid-cols-2 gap-3"><div><label className="label">Count</label><input type="number" className="input" min={1} max={100} value={count} onChange={(e) => setCount(Number(e.target.value))} /></div><div><label className="label">Character (AI UGC)</label><select className="input" value={charId} onChange={(e) => setCharId(e.target.value)}><option value="">Auto</option>{chars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div></div>
        <div><label className="label">Language {me?.plan.limits.multiLanguage ? "" : "(Pro)"}</label><input className="input" placeholder="en" value={lang} onChange={(e) => setLang(e.target.value)} disabled={!me?.plan.limits.multiLanguage} /></div>
        <p className="text-xs text-slate-500">Daily candidate limit: {me?.plan.limits.candidatesPerDay}. Batches land in Velocity mode for approval.</p>
        <button className="btn-primary" disabled={busy || formats.length === 0} onClick={generate}>{busy ? <Spinner /> : "Generate"}</button>
      </div>
      <div className="space-y-6">
        <div className="card p-6 space-y-3">
          <h2 className="text-xl font-bold">Upload</h2>
          <div className="flex gap-2 text-sm"><label className="flex items-center gap-1"><input type="radio" checked={purpose === "content"} onChange={() => setPurpose("content")} /> Content (video/image to schedule)</label><label className="flex items-center gap-1"><input type="radio" checked={purpose === "asset"} onChange={() => setPurpose("asset")} /> Brand asset</label></div>
          {purpose === "asset" && <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}><option value="screenshot">Screenshot</option><option value="logo">Logo</option><option value="demo_video">Demo video</option><option value="image">Image</option></select>}
          {purpose === "content" && <><input className="input" placeholder="Hook / title" value={hook} onChange={(e) => setHook(e.target.value)} /><textarea className="input" rows={2} placeholder="Caption" value={caption} onChange={(e) => setCaption(e.target.value)} /></>}
          <input type="file" accept="video/mp4,video/quicktime,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button className="btn-secondary" disabled={!file || busy} onClick={upload}>{progress ?? "Upload"}</button>
          <p className="text-xs text-slate-500">Brand screenshots are used as the visual bed in generated slideshows and hook + demo videos.</p>
        </div>
        <div className="card p-6 space-y-3">
          <div className="flex items-center justify-between"><h2 className="text-xl font-bold">AI Studio</h2><Badge>{me?.usage.credits} credits</Badge></div>
          <p className="text-sm text-slate-600">Image and video generation on credits (4 per image, 10 per second of video). Live generation requires an image/video provider key; in mock mode the estimate below still works.</p>
          <div className="grid grid-cols-2 gap-3"><div><label className="label">Images</label><input type="number" className="input" min={0} value={imgs} onChange={(e) => setImgs(Number(e.target.value))} /></div><div><label className="label">Video seconds</label><input type="number" className="input" min={0} value={secs} onChange={(e) => setSecs(Number(e.target.value))} /></div></div>
          <p className="text-sm">Estimated cost: <b>{est ?? "…"} credits</b></p>
          <textarea className="input" rows={2} placeholder="Image prompt (e.g. product on a desk, morning light, phone photo)" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <button className="btn-secondary" disabled={busy || prompt.length < 3} onClick={() => run(async () => { await api("/studio/image", { method: "POST", json: { workspace_id: workspaceId, prompt, character_id: charId || undefined, count: imgs } }); refresh(); router.push("/app/content"); }, `Generated ${imgs} image(s)`)}>Generate {imgs} image{imgs > 1 ? "s" : ""} ({imgs * 4} credits)</button>
          <textarea className="input" rows={3} placeholder="Video script for the character to say" value={script} onChange={(e) => setScript(e.target.value)} />
          <button className="btn-secondary" disabled={busy || script.length < 10} onClick={() => run(async () => { await api("/studio/video", { method: "POST", json: { workspace_id: workspaceId, script, character_id: charId || undefined, seconds: secs } }); refresh(); router.push("/app/content?status=saved,draft,scheduled,published,failed"); }, `Video queued (${secs * 10} credits) — appears in Content when rendered`)}>Generate {secs}s video ({secs * 10} credits)</button>
        </div>
      </div>
    </div></div>
  );
}
