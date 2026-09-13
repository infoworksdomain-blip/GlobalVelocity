"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/lib/use-me";
import { api } from "@/lib/api";
export default function AppHome() {
  const { workspaceId, loading } = useMe(); const router = useRouter();
  useEffect(() => { if (loading || !workspaceId) return; api<{ profile: unknown }>(`/workspaces/${workspaceId}/profile`).then((r) => router.replace(r.profile ? "/app/velocity" : "/app/onboarding")).catch(() => router.replace("/app/onboarding")); }, [workspaceId, loading, router]);
  return null;
}
