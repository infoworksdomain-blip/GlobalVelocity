"use client";
import { useCallback, useEffect, useState } from "react";
import { useMe } from "@/lib/use-me";
import { api } from "@/lib/api";
import { useAction, Badge } from "@/components/ui";
type T = { sites: { id: string; domain: string; siteKey: string; verifiedAt: string | null }[]; snippet: string | null; links: { id: string; slug: string; url: string; clicks: number; scheduledPostId: string | null; createdAt: string }[]; by_post: { trackedLinkId: string; event: string; count: number }[] };
export default function Tracking() {
  const { workspaceId } = useMe(); const { run, busy, wall } = useAction(); const [t, setT] = useState<T | null>(null); const [domain, setDomain] = useState("");
  const load = useCallback(() => workspaceId && api<T>(`/workspaces/${workspaceId}/tracking`).then(setT), [workspaceId]);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-4 max-w-3xl">{wall}
      <div className="card p-5"><h2 className="font-bold">Website tracking</h2><p className="text-sm text-slate-600 mt-1">Install a lightweight snippet to attribute visits, signups and purchases to the posts that drove them. Each scheduled post gets a tracked link automatically.</p>
        {t?.sites.length ? <div className="mt-3 space-y-2">{t.sites.map((s) => <div key={s.id} className="flex items-center gap-2 text-sm"><b>{s.domain}</b><Badge tone={s.verifiedAt ? "green" : "amber"}>{s.verifiedAt ? "receiving events" : "waiting for first event"}</Badge></div>)}<pre className="rounded-xl bg-slate-900 text-slate-100 p-3 text-xs overflow-x-auto">{t.snippet}</pre><p className="text-xs text-slate-500">Track conversions: <code>velocity.track(&apos;signup&apos;)</code> · <code>velocity.track(&apos;purchase&apos;, {`{ value: 49, currency: 'USD', order_id: '123' }`})</code>. Server-side: POST the same JSON to <code>/api/t/v1</code>.</p></div>
          : <div className="mt-3 flex gap-2"><input className="input" placeholder="yourproduct.com" value={domain} onChange={(e) => setDomain(e.target.value)} /><button className="btn-primary" disabled={busy || !domain} onClick={() => run(async () => { await api(`/workspaces/${workspaceId}/tracking`, { method: "POST", json: { domain } }); load(); }, "Site added")}>Add site</button></div>}
      </div>
      <div className="card overflow-hidden"><div className="p-3 label">Tracked links</div><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-3">Link</th><th className="p-3">Clicks</th><th className="p-3">Visits</th><th className="p-3">Signups</th><th className="p-3">Purchases</th></tr></thead><tbody>{(t?.links ?? []).map((l) => { const ev = (e: string) => t?.by_post.find((b) => b.trackedLinkId === l.id && b.event === e)?.count ?? 0; return <tr key={l.id} className="border-t border-slate-100"><td className="p-3 font-mono text-xs">{l.url}</td><td className="p-3">{l.clicks}</td><td className="p-3">{ev("pageview")}</td><td className="p-3">{ev("signup")}</td><td className="p-3">{ev("purchase")}</td></tr>; })}{!t?.links.length && <tr><td className="p-6 text-slate-500" colSpan={5}>Links appear here when you schedule posts.</td></tr>}</tbody></table></div>
    </div>
  );
}
