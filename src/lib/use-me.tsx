"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";

export type Me = {
  user: { id: string; email: string; name: string | null; image: string | null; timezone: string } | null;
  account: { id: string; plan: "free" | "starter" | "growth" | "pro"; billingInterval: string | null; planRenewsAt: string | null; graceUntil: string | null };
  plan: { id: string; name: string; priceMonth: number; limits: Record<string, unknown> & { saves: number | null; candidatesPerDay: number; scheduling: boolean; trendRemix: boolean; apiRpm: number } };
  usage: { credits: number; saves: number }; workspaces: { id: string; name: string; slug: string; locked: boolean; timezone: string; role?: string }[]; isPlatformAdmin: boolean; mode: string;
};
type Ctx = { me: Me | null; loading: boolean; refresh: () => Promise<void>; workspaceId: string | null; setWorkspaceId: (id: string) => void; workspace: Me["workspaces"][number] | null };
const C = createContext<Ctx>({ me: null, loading: true, refresh: async () => {}, workspaceId: null, setWorkspaceId: () => {}, workspace: null });

export function MeProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null); const [loading, setLoading] = useState(true); const [workspaceId, setWs] = useState<string | null>(null);
  const refresh = useCallback(async () => { try { const m = await api<Me>("/me"); setMe(m); setWs((cur) => { const saved = cur ?? (typeof window !== "undefined" ? localStorage.getItem("velocity.ws") : null); return m.workspaces.some((w) => w.id === saved) ? saved : m.workspaces[0]?.id ?? null; }); } catch { setMe(null); } finally { setLoading(false); } }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const setWorkspaceId = (id: string) => { setWs(id); localStorage.setItem("velocity.ws", id); };
  return <C.Provider value={{ me, loading, refresh, workspaceId, setWorkspaceId, workspace: me?.workspaces.find((w) => w.id === workspaceId) ?? null }}>{children}</C.Provider>;
}
export const useMe = () => useContext(C);
