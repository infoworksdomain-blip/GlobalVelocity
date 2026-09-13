"use client";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMe } from "@/lib/use-me";
import { api, PLATFORM_LABEL } from "@/lib/api";
import { useAction, Spinner, Badge, Modal, useToast } from "@/components/ui";
type Social = { id: string; platform: string; handle: string | null; displayName: string | null; avatarUrl: string | null; status: string; tokenExpiresAt: string | null; postingSlots: { weekday: number; time: string }[] };
export default function Socials() {
  const { workspaceId, me } = useMe(); const { run, wall } = useAction(); const { push } = useToast(); const sp = useSearchParams();
  const [rows, setRows] = useState<Social[] | null>(null); const [mode, setMode] = useState("mock"); const [slotsFor, setSlotsFor] = useState<Social | null>(null); const [slots, setSlots] = useState("");
  const load = useCallback(() => workspaceId && api<{ socials: Social[]; mode: string }>(`/workspaces/${workspaceId}/socials`).then((r) => { setRows(r.socials); setMode(r.mode); }), [workspaceId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (sp.get("connected")) push(`${PLATFORM_LABEL[sp.get("connected")!]} connected`); if (sp.get("error")) push(`Connection failed: ${sp.get("error")}`, "err"); }, [sp, push]);
  const connect = (platform: string) => run(async () => { const r = await fetch(`/api/v1/socials/connect/${platform}/start?workspace_id=${workspaceId}`, { redirect: "manual" }); if (r.status === 402 || r.status === 400 || r.status === 403) { const j = await r.json(); const { ApiError } = await import("@/lib/api"); throw new ApiError(r.status, j.error?.code, j.error?.message, j.error); } window.location.href = `/api/v1/socials/connect/${platform}/start?workspace_id=${workspaceId}`; });
  const saveSlots = () => run(async () => { await api(`/socials/${slotsFor!.id}`, { method: "PATCH", json: { posting_slots: slots.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const [d, t] = l.split(/\s+/); return { weekday: Number(d), time: t }; }) } }); setSlotsFor(null); load(); }, "Posting slots saved");
  return (
    <div className="space-y-4">{wall}
      {mode === "mock" && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Mock mode: “connecting” creates a sandbox account and “publishing” returns example permalinks. Set platform keys and <code>PROVIDER_MODE=live</code> for real OAuth.</div>}
      <div className="grid gap-3 md:grid-cols-2">{Object.entries(PLATFORM_LABEL).map(([k, v]) => { const mine = rows?.filter((s) => s.platform === k) ?? []; const allowed = (me?.plan.limits.platforms as string[] | undefined)?.includes(k); return (
        <div key={k} className="card p-5"><div className="flex items-center justify-between"><h2 className="font-bold">{v}</h2><button className="btn-secondary" onClick={() => connect(k)}>{allowed ? "+ Connect" : "Connect (paid)"}</button></div>
          {mine.length === 0 ? <p className="mt-2 text-sm text-slate-500">Not connected.</p> : mine.map((s) => <div key={s.id} className="mt-3 flex items-center gap-3 text-sm">{s.avatarUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={s.avatarUrl} alt={`Profile picture for ${s.handle ?? s.displayName ?? "connected account"}`} className="h-8 w-8 rounded-full" />}<div className="flex-1"><div className="font-medium">@{s.handle ?? s.displayName}</div><div className="text-xs text-slate-500">{s.postingSlots.length ? `${s.postingSlots.length} posting slots` : "Default slots 09:00 / 13:00 / 19:00"}</div></div><Badge tone={s.status === "active" ? "green" : "amber"}>{s.status.replace("_", " ")}</Badge>{s.status !== "active" && <button className="btn-primary px-2 py-1 text-xs" onClick={() => connect(k)}>Reconnect</button>}<button className="btn-ghost px-2 py-1 text-xs" onClick={() => { setSlotsFor(s); setSlots(s.postingSlots.map((x) => `${x.weekday} ${x.time}`).join("\n")); }}>Slots</button><button className="btn-ghost px-2 py-1 text-xs text-red-600" onClick={() => confirm("Disconnect? Scheduled posts to this account are cancelled.") && run(async () => { await api(`/socials/${s.id}`, { method: "DELETE" }); load(); }, "Disconnected")}>Remove</button></div>)}
        </div>); })}</div>
      {!rows && <Spinner />}
      <Modal open={!!slotsFor} onClose={() => setSlotsFor(null)} title="Posting slots"><p className="text-sm text-slate-600">One per line: <code>weekday HH:MM</code> (0 = Sunday … 6 = Saturday), workspace timezone. Queue scheduling picks the next free slot.</p><textarea className="input mt-3" rows={8} value={slots} onChange={(e) => setSlots(e.target.value)} placeholder={"1 09:00\n1 18:00\n3 12:00"} /><div className="mt-3 flex justify-end gap-2"><button className="btn-ghost" onClick={() => setSlotsFor(null)}>Cancel</button><button className="btn-primary" onClick={saveSlots}>Save</button></div></Modal>
    </div>
  );
}
