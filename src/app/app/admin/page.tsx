"use client";
import { useEffect, useState } from "react";
import { api, fmtNum } from "@/lib/api";
import { useAction, Badge, Spinner, statusTone, Modal } from "@/components/ui";
import { Users, KeyRound, Plug, Gauge, ShieldAlert, Send, Sparkles, ScrollText, Library, Search, Ban, RotateCcw, Trash2 } from "lucide-react";

const TABS = [["overview", "Overview", Gauge], ["accounts", "Accounts", Users], ["keys", "Keys & webhooks", KeyRound], ["integrations", "Integrations", Plug], ["moderation", "Moderation", ShieldAlert], ["publishing", "Publishing", Send], ["affiliates", "Affiliates", Sparkles], ["costs", "Costs", Gauge], ["curation", "Curation", Library], ["audit", "Audit log", ScrollText]] as const;
type Any = Record<string, never>;

export default function Admin() {
  const { run, wall } = useAction(); const [view, setView] = useState<string>("overview"); const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [q, setQ] = useState(""); const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [trendJson, setTrendJson] = useState(""); const [clip, setClip] = useState({ storage_key: "", creator_name: "", duration_ms: 30000, licence_type: "audio_replace", style_tags: "", tier: "growth" });
  const [reqId, setReqId] = useState(0);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkMeta, setBulkMeta] = useState({ category: "", style_tags: "", gender: "", setting: "", licence_type: "audio_replace", tier: "growth" });
  const [bulkProgress, setBulkProgress] = useState<{ uploaded: number; uploadFailed: number; total: number; batchId: string | null; completed: number; failed: number; status: string } | null>(null);
  // Guard against out-of-order responses when switching tabs quickly: only the latest request may set state.
  const load = (v = view, query = q) => { const id = reqId + 1; setReqId(id); setData(null); api<Record<string, unknown>>(`/admin?view=${v}${query ? `&q=${encodeURIComponent(query)}` : ""}`).then((d) => setReqId((cur) => { if (cur === id) setData(d); return cur; })).catch((e) => setReqId((cur) => { if (cur === id) setData({ error: e.message }); return cur; })); };
  useEffect(() => { if (view === "curation") setData({}); else load(view, ""); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [view]);
  const act = (body: Record<string, unknown>, msg: string) => run(async () => { await api("/admin", { method: "POST", json: body }); load(); setDetail(null); }, msg);
  const money = (c: number) => `$${(c / 100).toFixed(2)}`;
  const runBulkUpload = () => run(async () => {
    const styleTags = bulkMeta.style_tags.split(",").map((x) => x.trim()).filter(Boolean);
    setBulkProgress({ uploaded: 0, uploadFailed: 0, total: bulkFiles.length, batchId: null, completed: 0, failed: 0, status: "uploading" });
    let batchId: string | null = null;
    const CHUNK = 40;
    for (let i = 0; i < bulkFiles.length; i += CHUNK) {
      const slice = bulkFiles.slice(i, i + CHUNK);
      // A presign or register call failing shouldn't lose earlier chunks: only this slice is skipped, not the whole run.
      try {
        const { uploads } = await api<{ uploads: { key: string; upload_url: string }[] }>("/admin/ugc-clips/batch-presign", { method: "POST", json: { files: slice.map((f) => ({ filename: f.name, content_type: f.type || "video/mp4" })) } });
        const okKeys: string[] = [];
        for (let j = 0; j < slice.length; j++) {
          try {
            const r = await fetch(uploads[j].upload_url, { method: "PUT", body: slice[j], headers: { "content-type": slice[j].type || "video/mp4" } });
            if (r.ok) { okKeys.push(uploads[j].key); setBulkProgress((p) => p && { ...p, uploaded: p.uploaded + 1 }); }
            else setBulkProgress((p) => p && { ...p, uploadFailed: p.uploadFailed + 1 });
          } catch { setBulkProgress((p) => p && { ...p, uploadFailed: p.uploadFailed + 1 }); }
        }
        if (okKeys.length) {
          const regResult: { batch_id: string; registered: number } = await api("/admin/ugc-clips/batch-register", { method: "POST", json: { batch_id: batchId ?? undefined, clips: okKeys.map((key) => ({ storage_key: key, category: bulkMeta.category || undefined, style_tags: styleTags, gender: bulkMeta.gender || undefined, setting: bulkMeta.setting || undefined, licence_type: bulkMeta.licence_type, tier: bulkMeta.tier })) } });
          batchId = regResult.batch_id;
        }
      } catch { setBulkProgress((p) => p && { ...p, uploadFailed: p.uploadFailed + slice.length }); }
    }
    setBulkProgress((p) => p && { ...p, batchId, status: batchId ? "processing" : "done" });
    const poll = async () => {
      if (!batchId) return;
      const { batch } = await api<{ batch: { completedCount: number; failedCount: number; requestedCount: number; status: string } }>(`/admin/ugc-clip-batches/${batchId}`);
      setBulkProgress((p) => p && { ...p, completed: batch.completedCount, failed: batch.failedCount, status: batch.status });
      if (batch.status !== "done") setTimeout(poll, 3000);
    };
    poll();
    setBulkFiles([]);
  }, "Bulk upload started");

  return (
    <div className="space-y-5">{wall}
      <div><h1 className="page-title">Admin panel</h1><p className="text-sm text-slate-500 mt-1">Manage every account, key, integration and platform library.</p></div>
      <div className="flex flex-wrap gap-1 border-b border-slate-200">{TABS.map(([v, label, Icon]) => <button key={v} onClick={() => setView(v)} className={`flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px ${view === v ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}><Icon className="h-4 w-4" />{label}</button>)}</div>

      {!data ? <div className="py-20 grid place-items-center"><Spinner /></div> : data.error ? <p className="text-red-600">{String(data.error)}</p> : (
        <>
          {view === "overview" && (() => { const o = data as unknown as { users: number; plans: Record<string, number>; content: { n: number; today: number }; posts: { n: number; published: number; failed: number }; credits_used: number; mode: string }; return (
            <div className="space-y-4">
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                {[["Users", fmtNum(o.users), "total signups"], ["Paying accounts", String(o.plans.starter + o.plans.growth + o.plans.pro), `${o.plans.free} free`], ["Content items", `${fmtNum(o.content.n)}`, `${o.content.today} today`], ["Posts published", fmtNum(o.posts.published), `${o.posts.failed} failed`]].map(([l, v, s]) => <div key={l} className="kpi"><div className="text-xs font-medium text-slate-500">{l}</div><div className="mt-1 text-2xl font-extrabold tracking-tight">{v}</div><div className="text-xs text-slate-400 mt-0.5">{s}</div></div>)}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="card p-5"><div className="label">Plan distribution</div>{(["free", "starter", "growth", "pro"] as const).map((p) => { const total = Math.max(1, o.users); return <div key={p} className="mt-2"><div className="flex justify-between text-sm"><span className="capitalize">{p}</span><b>{o.plans[p]}</b></div><div className="h-1.5 rounded-full bg-slate-100 mt-1"><div className="h-1.5 rounded-full bg-brand-600" style={{ width: `${(100 * o.plans[p]) / total}%` }} /></div></div>; })}</div>
                <div className="card p-5"><div className="label">Platform</div><div className="text-sm space-y-2 mt-1"><div className="flex justify-between"><span>Provider mode</span><Badge tone={o.mode === "live" ? "green" : "amber"}>{o.mode}</Badge></div><div className="flex justify-between"><span>Credits consumed</span><b>{fmtNum(o.credits_used)}</b></div><div className="flex justify-between"><span>Scheduled posts</span><b>{fmtNum(o.posts.n)}</b></div></div></div>
              </div>
            </div>); })()}

          {view === "accounts" && data.accounts !== undefined && (() => { const rows = data.accounts as unknown as Record<string, never>[]; return (
            <div className="space-y-3">
              <div className="flex gap-2"><div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className="input pl-9" placeholder="Search by email, name or account id" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load("accounts", q)} /></div><button className="btn-secondary" onClick={() => load("accounts", q)}>Search</button><span className="ml-auto self-center text-xs text-slate-500">{rows.length} accounts</span></div>
              <div className="card overflow-hidden overflow-x-auto"><table className="table"><thead><tr><th>Account</th><th>Plan</th><th>Workspaces</th><th>Saves</th><th>Credits</th><th>Socials</th><th>Published</th><th>Keys</th><th>Status</th><th></th></tr></thead><tbody>
                {rows.map((a) => <tr key={String(a.accountId)}><td><button className="text-left" onClick={() => setDetail(a as unknown as Record<string, unknown>)}><div className="font-semibold text-brand-700 hover:underline">{String(a.email)}</div><div className="text-xs text-slate-400">{new Date(String(a.createdAt)).toLocaleDateString()}{a.affiliateRef ? ` · ref ${String(a.affiliateRef)}` : ""}</div></button></td>
                  <td><Badge tone={a.plan === "free" ? "slate" : "brand"}>{String(a.plan)}</Badge></td><td>{String(a.workspaces)}</td><td>{String(a.saves)}</td><td>{String(a.credits)}</td><td>{String(a.socials)}</td><td>{String(a.published)}</td><td>{String(a.keys)}</td>
                  <td>{a.suspendedAt ? <Badge tone="red">suspended</Badge> : a.graceUntil ? <Badge tone="amber">dunning</Badge> : <Badge tone="green">active</Badge>}</td>
                  <td className="text-right"><button className="btn-ghost px-2 py-1 text-xs" onClick={() => setDetail(a as unknown as Record<string, unknown>)}>Manage</button></td></tr>)}
                {rows.length === 0 && <tr><td colSpan={10} className="p-8 text-center text-slate-500">No accounts match.</td></tr>}
              </tbody></table></div>
            </div>); })()}

          {view === "keys" && data.keys !== undefined && (() => { const d = data as unknown as { keys: Record<string, never>[]; webhooks: Record<string, never>[]; socials: { platform: string; status: string; n: number }[]; rpm: Record<string, number> }; return (
            <div className="space-y-4">
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">{[["Active API keys", d.keys.filter((k) => !k.revokedAt).length], ["Revoked", d.keys.filter((k) => k.revokedAt).length], ["Webhooks", d.webhooks.length], ["Connected socials", d.socials.reduce((a, s) => a + s.n, 0)]].map(([l, v]) => <div key={String(l)} className="kpi"><div className="text-xs font-medium text-slate-500">{String(l)}</div><div className="mt-1 text-2xl font-extrabold">{String(v)}</div></div>)}</div>
              <div className="card overflow-hidden"><div className="px-4 py-3 text-sm font-semibold border-b border-slate-100">API keys (all accounts)</div><div className="overflow-x-auto"><table className="table"><thead><tr><th>Owner</th><th>Name</th><th>Prefix</th><th>Scopes</th><th>Rate limit</th><th>Last used</th><th>Status</th><th></th></tr></thead><tbody>
                {d.keys.map((k) => <tr key={String(k.id)}><td className="font-medium">{String(k.email)}</td><td>{String(k.name ?? "—")}</td><td className="font-mono text-xs">{String(k.prefix)}…</td><td className="max-w-[220px]"><div className="flex flex-wrap gap-1">{(k.scopes as unknown as string[]).map((s) => <Badge key={s}>{s}</Badge>)}</div></td><td className="text-slate-500">{d.rpm[String(k.plan)]}/min</td><td className="text-slate-500 text-xs">{k.lastUsedAt ? new Date(String(k.lastUsedAt)).toLocaleString() : "never"}</td><td>{k.revokedAt ? <Badge tone="red">revoked</Badge> : <Badge tone="green">active</Badge>}</td><td className="text-right">{!k.revokedAt && <button className="btn-ghost px-2 py-1 text-xs text-red-600" onClick={() => act({ action: "revoke_key", key_id: k.id }, "Key revoked")}>Revoke</button>}</td></tr>)}
                {d.keys.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-500">No API keys issued yet.</td></tr>}</tbody></table></div></div>
              <div className="card overflow-hidden"><div className="px-4 py-3 text-sm font-semibold border-b border-slate-100">Webhook endpoints</div><div className="overflow-x-auto"><table className="table"><thead><tr><th>Owner</th><th>URL</th><th>Events</th><th>Status</th><th></th></tr></thead><tbody>
                {d.webhooks.map((w) => <tr key={String(w.id)}><td className="font-medium">{String(w.email)}</td><td className="font-mono text-xs max-w-xs truncate">{String(w.url)}</td><td className="text-xs text-slate-500">{(w.events as unknown as string[]).join(", ")}</td><td>{w.enabled ? <Badge tone="green">enabled</Badge> : <Badge tone="slate">disabled</Badge>}</td><td className="text-right"><button className="btn-ghost px-2 py-1 text-xs" onClick={() => act({ action: "toggle_webhook", webhook_id: w.id, enabled: !w.enabled }, "Updated")}>{w.enabled ? "Disable" : "Enable"}</button></td></tr>)}
                {d.webhooks.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-500">No webhooks registered.</td></tr>}</tbody></table></div></div>
              <div className="card p-5"><div className="label">Connected social accounts by platform</div><div className="mt-2 flex flex-wrap gap-2">{d.socials.map((s) => <Badge key={s.platform + s.status} tone={s.status === "active" ? "green" : "amber"}>{s.platform}: {s.n} {s.status.replace("_", " ")}</Badge>)}{d.socials.length === 0 && <span className="text-sm text-slate-500">None connected.</span>}</div></div>
            </div>); })()}

          {view === "integrations" && data.integrations !== undefined && (() => { const d = data as unknown as { mode: string; integrations: { key: string; name: string; configured: boolean; envVars: string[]; docs: string }[] }; return (
            <div className="space-y-3">
              <div className={`rounded-xl border px-4 py-3 text-sm ${d.mode === "live" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>Provider mode: <b>{d.mode}</b>. {d.mode === "live" ? "Live providers are in use where configured; anything unconfigured falls back to mocks." : "All providers are mocked. Set PROVIDER_MODE=live once keys are in place."}</div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{d.integrations.map((i) => <div key={i.key} className="card card-hover p-4"><div className="flex items-start justify-between gap-2"><div className="font-semibold text-sm">{i.name}</div>{i.configured ? <Badge tone="green">configured</Badge> : <Badge tone="amber">not set</Badge>}</div><div className="mt-2 flex flex-wrap gap-1">{i.envVars.map((v) => <code key={v} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{v}</code>)}</div>{i.docs && <a className="mt-3 inline-block text-xs text-brand-700 underline" href={i.docs} target="_blank" rel="noreferrer">Provider console ↗</a>}</div>)}</div>
              <p className="text-xs text-slate-500">Credentials are read from the environment and never stored in the database. Restart the app and worker after changing them.</p>
            </div>); })()}

          {view === "moderation" && data.items !== undefined && <div className="card overflow-hidden"><table className="table"><thead><tr><th>Hook</th><th>Reasons</th><th></th></tr></thead><tbody>{(data.items as unknown as { id: string; hook: string | null; moderation: { reasons?: string[] } }[]).map((i) => <tr key={i.id}><td>{i.hook}</td><td className="text-slate-500">{i.moderation?.reasons?.join(", ")}</td><td className="text-right"><button className="btn-secondary px-2 py-1 text-xs" onClick={() => act({ action: "unblock_item", item_id: i.id }, "Unblocked")}>Unblock</button></td></tr>)}{!(data.items as unknown[]).length && <tr><td colSpan={3} className="p-8 text-center text-slate-500">Moderation queue is empty.</td></tr>}</tbody></table></div>}

          {view === "publishing" && data.failed !== undefined && <div className="space-y-3"><div className="flex flex-wrap gap-2">{(data.by_status as unknown as { status: string; n: number }[]).map((s) => <Badge key={s.status} tone={statusTone(s.status)}>{s.status}: {s.n}</Badge>)}</div><div className="card overflow-hidden"><table className="table"><thead><tr><th>Platform</th><th>Status</th><th>Error</th><th>Scheduled</th></tr></thead><tbody>{(data.failed as unknown as { id: string; platform: string; status: string; lastError: string | null; scheduledAt: string }[]).map((p) => <tr key={p.id}><td className="font-medium">{p.platform}</td><td><Badge tone={statusTone(p.status)}>{p.status}</Badge></td><td className="text-xs text-red-600 max-w-md truncate">{p.lastError}</td><td className="text-slate-500">{new Date(p.scheduledAt).toLocaleString()}</td></tr>)}{!(data.failed as unknown[]).length && <tr><td colSpan={4} className="p-8 text-center text-slate-500">No failed or held posts.</td></tr>}</tbody></table></div></div>}

          {view === "affiliates" && data.payable !== undefined && <div className="space-y-3"><div className="card p-5"><div className="label">Payable now (approved, unpaid)</div>{(data.payable as unknown as { affiliateId: string; code: string; payoutEmail: string | null; approvedCents: number }[]).map((p) => <div key={p.affiliateId} className="flex items-center gap-3 text-sm py-2 border-t border-slate-100"><b>{p.code}</b><span className="text-slate-500">{p.payoutEmail ?? "no payout email"}</span><span className="ml-auto font-semibold">{money(p.approvedCents)}</span><button className="btn-primary px-2.5 py-1 text-xs" disabled={p.approvedCents < 5000} onClick={() => act({ action: "mark_paid", affiliate_id: p.affiliateId }, "Marked paid")}>{p.approvedCents < 5000 ? "Below $50 min" : "Mark paid"}</button></div>)}{!(data.payable as unknown[]).length && <p className="text-sm text-slate-500 mt-1">Nothing payable.</p>}</div>
            <div className="card overflow-hidden"><table className="table"><thead><tr><th>Date</th><th>Affiliate</th><th>Payment</th><th>Commission</th><th>Status</th></tr></thead><tbody>{(data.commissions as unknown as { id: number; code: string; amountCents: number; commissionCents: number; status: string; createdAt: string }[]).map((c) => <tr key={c.id}><td>{new Date(c.createdAt).toLocaleDateString()}</td><td className="font-medium">{c.code}</td><td>{money(c.amountCents)}</td><td>{money(c.commissionCents)}</td><td><Badge tone={c.status === "paid" ? "green" : c.status === "approved" ? "blue" : "amber"}>{c.status}</Badge></td></tr>)}{!(data.commissions as unknown[]).length && <tr><td colSpan={5} className="p-8 text-center text-slate-500">No commissions yet.</td></tr>}</tbody></table></div></div>}

          {view === "costs" && data.days !== undefined && <div className="space-y-3"><div className="kpi inline-block"><div className="text-xs font-medium text-slate-500">Estimated provider + compute cost, last 30 days</div><div className="text-3xl font-extrabold mt-1">${String(data.total_est_usd)}</div><div className="text-xs text-slate-400 mt-1">Unit costs are configurable in the admin route</div></div>
            <div className="card overflow-hidden"><table className="table"><thead><tr><th>Day</th><th>Items</th><th>AI UGC</th><th>Credits</th><th>LLM calls</th><th>Published</th><th>Est. $</th></tr></thead><tbody>{(data.days as unknown as { day: string; items: number; ai_ugc: number; credits: number; llm_calls: number; published: number; est_cost_usd: number }[]).filter((d) => d.items || d.published).map((d) => <tr key={d.day}><td>{d.day}</td><td>{d.items}</td><td>{d.ai_ugc}</td><td>{d.credits}</td><td>{d.llm_calls}</td><td>{d.published}</td><td className="font-semibold">{d.est_cost_usd.toFixed(2)}</td></tr>)}</tbody></table></div></div>}

          {view === "curation" && <div className="grid gap-4 md:grid-cols-2">
            <div className="card p-5 space-y-2"><h2 className="font-semibold">Import trends (JSON array)</h2><p className="text-xs text-slate-500">Metadata and recipe only — never third-party media. Upserts on (platform, external_post_id).</p><textarea className="input font-mono text-xs" rows={12} value={trendJson} onChange={(e) => setTrendJson(e.target.value)} placeholder='[{"platform":"tiktok","external_post_id":"…","post_url":"…","recipe":{"structure":[],"style":""},"metrics":{"views":0}}]' /><button className="btn-primary" onClick={() => run(async () => { const r = await api<{ imported: number }>("/admin/trends", { method: "POST", json: JSON.parse(trendJson) }); setTrendJson(""); alert(`Imported ${r.imported}`); }, "Trends imported")}>Import</button></div>
            <div className="card p-5 space-y-2"><h2 className="font-semibold">Register human UGC clip</h2><p className="text-xs text-slate-500">Upload the clip in Studio first, then paste its storage key.</p>
              <input className="input" placeholder="ws/…/assets/clip.mp4" value={clip.storage_key} onChange={(e) => setClip({ ...clip, storage_key: e.target.value })} /><input className="input" placeholder="Creator name" value={clip.creator_name} onChange={(e) => setClip({ ...clip, creator_name: e.target.value })} /><input className="input" placeholder="Style tags, comma separated" value={clip.style_tags} onChange={(e) => setClip({ ...clip, style_tags: e.target.value })} />
              <div className="grid grid-cols-3 gap-2"><input type="number" className="input" value={clip.duration_ms} onChange={(e) => setClip({ ...clip, duration_ms: Number(e.target.value) })} /><select className="input" value={clip.licence_type} onChange={(e) => setClip({ ...clip, licence_type: e.target.value })}><option value="audio_replace">Audio replace</option><option value="subtitle_only">Subtitle only</option></select><select className="input" value={clip.tier} onChange={(e) => setClip({ ...clip, tier: e.target.value })}><option>starter</option><option>growth</option><option>pro</option></select></div>
              <button className="btn-primary" onClick={() => run(async () => { await api("/admin/ugc-clips", { method: "POST", json: { ...clip, style_tags: clip.style_tags.split(",").map((x) => x.trim()).filter(Boolean) } }); }, "Clip registered")}>Register</button></div>

            <div className="card p-5 space-y-2 md:col-span-2"><h2 className="font-semibold">Bulk upload UGC clips</h2><p className="text-xs text-slate-500">Select up to thousands of video files at once. Uploads go direct to storage; thumbnails and durations are extracted in the background — this page stays usable while that runs.</p>
              <input type="file" accept="video/*" multiple className="input" onChange={(e) => setBulkFiles(Array.from(e.target.files ?? []))} />
              {bulkFiles.length > 0 && <p className="text-xs text-slate-500">{bulkFiles.length} files selected</p>}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <input className="input" placeholder="Category (e.g. fitness)" value={bulkMeta.category} onChange={(e) => setBulkMeta({ ...bulkMeta, category: e.target.value })} />
                <input className="input" placeholder="Style tags, comma separated" value={bulkMeta.style_tags} onChange={(e) => setBulkMeta({ ...bulkMeta, style_tags: e.target.value })} />
                <input className="input" placeholder="Setting (e.g. gym)" value={bulkMeta.setting} onChange={(e) => setBulkMeta({ ...bulkMeta, setting: e.target.value })} />
                <select className="input" value={bulkMeta.gender} onChange={(e) => setBulkMeta({ ...bulkMeta, gender: e.target.value })}><option value="">Any gender</option><option value="male">Male</option><option value="female">Female</option></select>
                <select className="input" value={bulkMeta.licence_type} onChange={(e) => setBulkMeta({ ...bulkMeta, licence_type: e.target.value })}><option value="audio_replace">Audio replace</option><option value="subtitle_only">Subtitle only</option></select>
                <select className="input" value={bulkMeta.tier} onChange={(e) => setBulkMeta({ ...bulkMeta, tier: e.target.value })}><option value="free">free</option><option value="starter">starter</option><option value="growth">growth</option><option value="pro">pro</option></select>
              </div>
              <p className="text-xs text-slate-400">This metadata applies to the whole selection. Upload files with different categories/tags in separate batches.</p>
              <button className="btn-primary" disabled={!bulkFiles.length} onClick={runBulkUpload}>Upload {bulkFiles.length || ""} clips</button>
              {bulkProgress && <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-1">
                <div className="flex justify-between"><span>Uploading</span><b>{bulkProgress.uploaded + bulkProgress.uploadFailed} / {bulkProgress.total}</b></div>
                <div className="h-1.5 rounded-full bg-slate-200"><div className="h-1.5 rounded-full bg-brand-600" style={{ width: `${bulkProgress.total ? (100 * (bulkProgress.uploaded + bulkProgress.uploadFailed)) / bulkProgress.total : 0}%` }} /></div>
                {bulkProgress.uploadFailed > 0 && <div className="text-red-600">{bulkProgress.uploadFailed} files failed to upload and were skipped (not registered)</div>}
                {bulkProgress.batchId && <div className="flex justify-between pt-1"><span>Processing (thumbnails/duration)</span><b>{bulkProgress.completed + bulkProgress.failed} / {bulkProgress.uploaded} — {bulkProgress.status}</b></div>}
                {bulkProgress.failed > 0 && <div className="text-red-600">{bulkProgress.failed} failed to process</div>}
              </div>}
            </div>
          </div>}

          {view === "audit" && data.audit !== undefined && <div className="card overflow-hidden"><table className="table"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Detail</th></tr></thead><tbody>{(data.audit as unknown as { id: number; action: string; actorType: string; createdAt: string; meta: unknown }[]).map((a) => <tr key={a.id}><td className="text-slate-500 whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</td><td>{a.actorType}</td><td className="font-mono text-xs">{a.action}</td><td className="text-slate-500 text-xs max-w-md truncate">{JSON.stringify(a.meta)}</td></tr>)}</tbody></table></div>}
        </>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Manage account" wide>{detail && (() => { const a = detail as Any as Record<string, never>; return (
        <div className="space-y-4 text-sm">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-100 text-brand-700 font-bold">{String(a.email).slice(0, 1).toUpperCase()}</span><div><div className="font-semibold">{String(a.email)}</div><div className="text-xs text-slate-500">Account {String(a.accountId)}</div></div>{a.suspendedAt ? <Badge tone="red">suspended</Badge> : <Badge tone="green">active</Badge>}</div>
          <div className="grid grid-cols-3 gap-3">{[["Workspaces", a.workspaces], ["Saves", a.saves], ["Credits", a.credits], ["Socials", a.socials], ["Published", a.published], ["API keys", a.keys]].map(([l, v]) => <div key={String(l)} className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">{String(l)}</div><div className="text-lg font-bold">{String(v)}</div></div>)}</div>
          <div className="grid gap-2 md:grid-cols-2">
            <div><label className="label">Plan</label><select className="input" defaultValue={String(a.plan)} onChange={(e) => act({ action: "set_plan", account_id: a.accountId, plan: e.target.value }, "Plan updated")}>{["free", "starter", "growth", "pro"].map((p) => <option key={p}>{p}</option>)}</select></div>
            <div><label className="label">Grant credits</label><div className="flex gap-2"><input className="input" type="number" placeholder="100" id="gc" /><button className="btn-secondary" onClick={() => { const n = Number((document.getElementById("gc") as HTMLInputElement).value); if (n) act({ action: "grant_credits", account_id: a.accountId, credits: n }, "Credits granted"); }}>Grant</button></div></div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
            <button className="btn-secondary" onClick={() => act({ action: "reset_usage", account_id: a.accountId }, "Usage counters reset")}><RotateCcw className="h-3.5 w-3.5" />Reset usage counters</button>
            <button className="btn-secondary" onClick={() => act({ action: "revoke_all_keys", account_id: a.accountId }, "All keys revoked")}><Trash2 className="h-3.5 w-3.5" />Revoke all API keys</button>
            {a.suspendedAt ? <button className="btn-primary" onClick={() => act({ action: "restore_account", account_id: a.accountId }, "Account restored")}>Restore account</button>
              : <button className="btn-danger" onClick={() => confirm("Suspend this account? Members lose access; data is retained.") && act({ action: "suspend_account", account_id: a.accountId }, "Account suspended")}><Ban className="h-3.5 w-3.5" />Suspend account</button>}
          </div>
          <p className="text-xs text-slate-500">Stripe customer: {a.stripeCustomerId ? String(a.stripeCustomerId) : "none"} · Renews {a.renewsAt ? new Date(String(a.renewsAt)).toLocaleDateString() : "—"}</p>
        </div>); })()}</Modal>
    </div>
  );
}
