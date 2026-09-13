"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
export default function Invite() {
  const { token } = useParams<{ token: string }>(); const router = useRouter(); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api<{ workspaceId: string }>(`/invites/${token}`, { method: "POST" }).then((r) => { localStorage.setItem("velocity.ws", r.workspaceId); router.replace("/app"); }).catch((e) => { if (e.status === 401) router.replace(`/login?callbackUrl=/invite/${token}`); else setErr(e.message); }); }, [token, router]);
  return <div className="min-h-screen grid place-items-center">{err ? <p className="text-red-600">{err}</p> : <p>Accepting invite…</p>}</div>;
}
