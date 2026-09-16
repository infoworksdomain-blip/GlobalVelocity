"use client";
import { useCallback, useEffect, useState } from "react";
import { useMe } from "@/lib/use-me";
import { api } from "@/lib/api";
import { useAction, Badge, Spinner } from "@/components/ui";
type M = { id: string; role: string; invitedEmail: string | null; acceptedAt: string | null; email: string | null; name: string | null };
export default function Members() {
  const { workspaceId, me } = useMe(); const { run, busy, wall } = useAction(); const [rows, setRows] = useState<M[] | null>(null); const [email, setEmail] = useState(""); const [role, setRole] = useState("editor"); const [link, setLink] = useState<string | null>(null);
  const load = useCallback(() => workspaceId && api<{ members: M[] }>(`/workspaces/${workspaceId}/members`).then((r) => setRows(r.members)).catch(() => setRows([])), [workspaceId]);
  useEffect(() => { load(); }, [load]);
  const invite = () => run(async () => { const r = await api<{ invite_link: string }>(`/workspaces/${workspaceId}/members`, { method: "POST", json: { email, role } }); setLink(r.invite_link); setEmail(""); load(); }, "Invite created");
  return (
    <div className="space-y-4 max-w-2xl">{wall}
      <div className="card p-5"><h2 className="font-bold">Invite a teammate</h2>{!me?.plan.limits.teamInvites && <p className="text-sm text-[var(--color-warning)] mt-1">Team invites require a paid plan.</p>}<div className="mt-3 flex gap-2"><input className="input" type="email" placeholder="colleague@company.com" value={email} onChange={(e) => setEmail(e.target.value)} /><select className="input w-auto" value={role} onChange={(e) => setRole(e.target.value)}><option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Viewer</option></select><button className="btn-primary" disabled={busy || !email} onClick={invite}>Invite</button></div>{link && <p className="mt-2 text-xs text-[var(--color-muted)]">Invite link (also emailed in live mode): <code className="bg-[var(--color-surface-2)] px-1">{link}</code></p>}<p className="mt-2 text-xs text-[var(--color-muted)]">Admin: manage everything · Editor: create, approve, schedule · Viewer: read-only.</p></div>
      <div className="card overflow-hidden">{!rows ? <div className="p-6"><Spinner /></div> : <table className="w-full text-sm"><thead className="bg-[var(--color-surface-2)] text-left"><tr><th className="p-3">Member</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3"></th></tr></thead><tbody>{rows.map((m) => <tr key={m.id} className="border-t border-[var(--color-hairline)]"><td className="p-3">{m.name ?? m.email ?? m.invitedEmail}</td><td className="p-3 capitalize">{m.role}</td><td className="p-3"><Badge tone={m.acceptedAt ? "green" : "amber"}>{m.acceptedAt ? "active" : "invited"}</Badge></td><td className="p-3 text-right"><button className="btn-ghost text-[var(--color-danger)] px-2 py-1 text-xs" onClick={() => run(async () => { await api(`/workspaces/${workspaceId}/members?memberId=${m.id}`, { method: "DELETE" }); load(); }, "Removed")}>Remove</button></td></tr>)}</tbody></table>}</div>
    </div>
  );
}
