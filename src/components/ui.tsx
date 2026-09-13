"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/api";

export function Spinner({ className = "" }: { className?: string }) {
  return <span className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600 ${className}`} />;
}
export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return <div className="card p-10 text-center"><h3 className="text-lg font-semibold">{title}</h3>{body && <p className="mt-1 text-sm text-muted">{body}</p>}{action && <div className="mt-4">{action}</div>}</div>;
}
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => { const h = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className={`card w-full ${wide ? "max-w-3xl" : "max-w-lg"} p-6 max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold">{title}</h3><button className="btn-ghost px-2" onClick={onClose} aria-label="Close">✕</button></div>
        {children}
      </div>
    </div>
  );
}
export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "blue" | "amber" | "red" | "brand" }) {
  const t = { slate: "bg-slate-100 text-slate-700", green: "bg-emerald-100 text-emerald-800", blue: "bg-sky-100 text-sky-800", amber: "bg-amber-100 text-amber-800", red: "bg-red-100 text-red-800", brand: "bg-brand-50 text-brand-700" }[tone];
  return <span className={`badge ${t}`}>{children}</span>;
}
export const statusTone = (s: string): "slate" | "green" | "blue" | "amber" | "red" | "brand" => (({ published: "green", scheduled: "blue", publishing: "blue", pending_approval: "amber", held: "amber", failed: "red", cancelled: "slate", saved: "brand", candidate: "slate", draft: "slate", generating: "amber", done: "green", running: "blue", queued: "slate", active: "green", paused: "amber", completed: "slate" } as Record<string, "slate" | "green" | "blue" | "amber" | "red" | "brand">)[s] ?? "slate");

/** Plan-limit wall shown whenever an API call returns 402 (FR-5.6, FR-18.2). */
export function PlanWall({ error, onClose }: { error: ApiError | null; onClose: () => void }) {
  return (
    <Modal open={!!error} onClose={onClose} title="Upgrade to keep going">
      <p className="text-sm text-slate-700">{error?.message}</p>
      <ul className="mt-4 space-y-1 text-sm text-slate-600 list-disc pl-5"><li>More content saves and daily candidates</li><li>Native scheduling to TikTok, Instagram, YouTube and LinkedIn</li><li>Trend remixing, more characters, automations</li></ul>
      <div className="mt-6 flex gap-2"><Link href="/pricing" className="btn-primary">See plans</Link><Link href="/app/settings/billing" className="btn-secondary">Billing</Link><button className="btn-ghost" onClick={onClose}>Not now</button></div>
    </Modal>
  );
}

// ---- Toasts ----
type Toast = { id: number; text: string; tone: "ok" | "err" };
const ToastCtx = createContext<{ push: (text: string, tone?: "ok" | "err") => void }>({ push: () => {} });
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: "ok" | "err" = "ok") => { const id = Date.now() + Math.random(); setItems((x) => [...x, { id, text, tone }]); setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4000); }, []);
  return <ToastCtx.Provider value={{ push }}>{children}<div className="fixed bottom-4 right-4 z-[60] space-y-2">{items.map((t) => <div key={t.id} className={`rounded-xl px-4 py-2.5 text-sm text-white shadow-lg ${t.tone === "ok" ? "bg-slate-900" : "bg-red-600"}`}>{t.text}</div>)}</div></ToastCtx.Provider>;
}
export const useToast = () => useContext(ToastCtx);

/** Hook: run an async action, surface 402 as a PlanWall, other errors as toasts. */
export function useAction() {
  const [wall, setWall] = useState<ApiError | null>(null); const [busy, setBusy] = useState(false); const { push } = useToast();
  const run = useCallback(async <T,>(fn: () => Promise<T>, okMsg?: string): Promise<T | null> => {
    setBusy(true);
    try { const r = await fn(); if (okMsg) push(okMsg); return r; }
    catch (e) { if (e instanceof ApiError && e.status === 402) setWall(e); else push(e instanceof Error ? e.message : "Something went wrong", "err"); return null; }
    finally { setBusy(false); }
  }, [push]);
  return { run, busy, wall: <PlanWall error={wall} onClose={() => setWall(null)} /> };
}
export function MockBanner({ mode }: { mode?: string }) {
  if (mode !== "mock") return null;
  return <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Mock provider mode: generation uses fixtures and “publishing” goes to a sandbox. Set <code>PROVIDER_MODE=live</code> and platform keys to go live.</div>;
}
