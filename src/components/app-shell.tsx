"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Zap, FolderOpen, Clapperboard, CalendarDays, Bot, BarChart3, Flame, Users, Settings, Shield, Bell, Search, ChevronDown, LogOut, Plus, Sparkles, CreditCard, Link2, Building2, Radio, Ghost } from "lucide-react";
import { useMe } from "@/lib/use-me";
import { api } from "@/lib/api";
import { Spinner, MockBanner } from "@/components/ui";

const NAV = [
  { group: "Create", items: [["/app/velocity", Zap, "Velocity mode"], ["/app/studio", Clapperboard, "Studio"], ["/app/content", FolderOpen, "Content"], ["/app/trends", Flame, "Trends"], ["/app/characters", Users, "Characters"]] },
  { group: "Publish", items: [["/app/calendar", CalendarDays, "Calendar"], ["/app/ghost-mode", Ghost, "Ghost Mode"], ["/app/automations", Bot, "Automations"], ["/app/analytics", BarChart3, "Analytics"]] },
  { group: "Account", items: [["/app/settings/profile", Settings, "Settings"], ["/app/settings/billing", CreditCard, "Billing"], ["/app/settings/api", Link2, "API & webhooks"], ["/app/affiliate", Sparkles, "Affiliate"]] },
] as const;
const COMMANDS = [["Velocity mode", "/app/velocity"], ["Studio", "/app/studio"], ["Content library", "/app/content"], ["Trends", "/app/trends"], ["Characters", "/app/characters"], ["Calendar", "/app/calendar"], ["Ghost Mode", "/app/ghost-mode"], ["Automations", "/app/automations"], ["Analytics", "/app/analytics"], ["Profile & workspace", "/app/settings/profile"], ["Social accounts", "/app/settings/socials"], ["Billing", "/app/settings/billing"], ["Team", "/app/settings/members"], ["API keys & webhooks", "/app/settings/api"], ["Website tracking", "/app/settings/tracking"], ["Affiliate", "/app/affiliate"], ["Admin", "/app/admin"]];
type Notif = { id: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string };

export function AppShell({ children }: { children: React.ReactNode }) {
  const { me, loading, workspaceId, setWorkspaceId, workspace } = useMe(); const path = usePathname(); const router = useRouter();
  const [notifs, setNotifs] = useState<Notif[]>([]); const [open, setOpen] = useState(false); const [userOpen, setUserOpen] = useState(false); const [cmd, setCmd] = useState(false); const [q, setQ] = useState("");
  useEffect(() => { const load = () => api<{ notifications: Notif[] }>("/notifications").then((r) => setNotifs(r.notifications)).catch(() => {}); load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, []);
  useEffect(() => { const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmd((c) => !c); } if (e.key === "Escape") { setCmd(false); setOpen(false); setUserOpen(false); } }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, []);
  if (loading) return <div className="min-h-screen grid place-items-center"><Spinner /></div>;
  const unread = notifs.filter((n) => !n.readAt).length; const savesLimit = me?.plan.limits.saves; const pct = savesLimit ? Math.min(100, (100 * (me?.usage.saves ?? 0)) / savesLimit) : 4;
  const hits = COMMANDS.filter(([l]) => l.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  const isActive = (href: string) => path === href || (href === "/app/settings/profile" ? /\/app\/settings\/(profile|socials|members|tracking)/.test(path) : path.startsWith(href));
  return (
    <div className="min-h-screen md:grid md:grid-cols-[248px_1fr]" style={{ background: "var(--color-ink)" }}>
      <aside className="flex flex-col md:sticky md:top-0 md:h-screen" style={{ background: "var(--color-surface)", borderRight: "1px solid var(--color-hairline)" }}>
        <div className="px-4 pt-4 pb-3"><Link href="/app" className="flex items-center gap-2.5 font-bold text-[15px] tracking-tight font-display"><span className="grid h-8 w-8 place-items-center rounded-xl text-white" style={{ background: "linear-gradient(160deg, var(--color-brand-400), var(--color-brand-600))", boxShadow: "0 6px 16px -8px rgba(110,86,248,.7)" }}><Zap className="h-4 w-4" /></span>Velocity</Link></div>
        <div className="px-3 pb-2"><div className="relative"><Building2 className="absolute left-3 top-2.5 h-4 w-4" style={{ color: "var(--color-faint)" }} /><select className="input pl-9 pr-8 py-2 appearance-none font-medium" value={workspaceId ?? ""} onChange={(e) => e.target.value === "__new" ? router.push("/app/settings/profile?new=1") : setWorkspaceId(e.target.value)}>{me?.workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}{w.locked ? " (locked)" : ""}</option>)}<option value="__new">+ New workspace</option></select><ChevronDown className="absolute right-3 top-3 h-4 w-4 pointer-events-none" style={{ color: "var(--color-faint)" }} /></div></div>
        <nav className="px-3 flex-1 overflow-y-auto">{NAV.map((g) => <div key={g.group} className="mt-3"><div className="px-3 pb-1 text-[10.5px] font-bold uppercase tracking-[.12em]" style={{ color: "var(--color-faint)" }}>{g.group}</div><div className="space-y-0.5">{g.items.map(([href, Icon, label]) => <Link key={href} href={href} className={`nav-link ${isActive(href) ? "active" : ""}`}><Icon />{label}</Link>)}</div></div>)}
          {me?.isPlatformAdmin && <div className="mt-3"><div className="px-3 pb-1 text-[10.5px] font-bold uppercase tracking-[.12em]" style={{ color: "var(--color-faint)" }}>Platform</div><Link href="/app/admin" className={`nav-link ${path.startsWith("/app/admin") ? "active" : ""}`}><Shield />Admin panel</Link></div>}
        </nav>
        <div className="p-3">
          <div className="rounded-2xl p-4 text-white" style={{ background: "linear-gradient(160deg, var(--color-brand-700), var(--color-brand-900))", border: "1px solid rgba(255,255,255,.06)" }}>
            <div className="flex items-center justify-between text-xs"><span className="font-semibold">{me?.plan.name} plan</span><Link href="/app/settings/billing" className="rounded-full bg-white/15 px-2.5 py-0.5 font-semibold hover:bg-white/25">Upgrade</Link></div>
            <div className="mt-3 flex justify-between text-[11px] text-white/60"><span>Content saves</span><span>{me?.usage.saves}/{savesLimit === null ? "∞" : savesLimit}</span></div>
            <div className="mt-1 h-1.5 rounded-full bg-white/10"><div className="h-1.5 rounded-full" style={{ background: "var(--color-brand-400)", width: `${pct}%` }} /></div>
            <div className="mt-2 flex justify-between text-[11px] text-white/60"><span>AI Studio credits</span><span className="font-semibold text-white">{me?.usage.credits}</span></div>
          </div>
        </div>
      </aside>
      <div className="flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 flex items-center gap-3 backdrop-blur px-5 py-2.5" style={{ borderBottom: "1px solid var(--color-hairline)", background: "color-mix(in srgb, var(--color-ink) 80%, transparent)" }}>
          <div className="font-semibold text-sm flex items-center gap-2" style={{ color: "var(--color-text)" }}><span className="h-2 w-2 rounded-full" style={{ background: "var(--color-accent-500)", boxShadow: "0 0 8px var(--color-accent-500)" }} />{workspace?.name ?? "Workspace"}</div>
          <button onClick={() => setCmd(true)} className="ml-auto hidden md:flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs w-64" style={{ border: "1px solid var(--color-hairline-2)", background: "var(--color-surface-2)", color: "var(--color-muted)" }}><Search className="h-3.5 w-3.5" />Jump to…<kbd className="ml-auto rounded px-1.5 text-[10px]" style={{ border: "1px solid var(--color-hairline-2)", background: "var(--color-surface-3)" }}>⌘K</kbd></button>
          <Link href="/app/studio" className="btn-primary py-2 text-xs"><Plus className="h-3.5 w-3.5" />Create</Link>
          <div className="relative"><button className="btn-ghost relative px-2" onClick={() => setOpen(!open)} aria-label="Notifications"><Bell className="h-4 w-4" />{unread > 0 && <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: "var(--color-danger)" }}>{unread}</span>}</button>
            {open && <div className="absolute right-0 mt-2 w-80 card p-2 max-h-96 overflow-y-auto z-40 fade-up"><div className="px-2 py-1 text-xs font-semibold" style={{ color: "var(--color-muted)" }}>Notifications</div>{notifs.length === 0 && <div className="p-3 text-sm" style={{ color: "var(--color-muted)" }}>You&apos;re all caught up.</div>}{notifs.map((n) => <a key={n.id} href={n.link ?? "#"} onClick={() => api(`/notifications/${n.id}`, { method: "PATCH" })} className={`block rounded-xl p-3 text-sm hover:bg-white/[.04] ${n.readAt ? "opacity-60" : ""}`}><div className="font-semibold">{n.title}</div><div className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>{n.body}</div></a>)}</div>}
          </div>
          <div className="relative"><button className="flex items-center gap-2 rounded-xl pl-1 pr-2 py-1 text-xs font-medium" style={{ border: "1px solid var(--color-hairline-2)", background: "var(--color-surface-2)" }} onClick={() => setUserOpen(!userOpen)}><span className="grid h-6 w-6 place-items-center rounded-lg font-bold" style={{ background: "rgba(110,86,248,.18)", color: "#C2B2FD" }}>{(me?.user?.name ?? me?.user?.email ?? "?").slice(0, 1).toUpperCase()}</span><span className="hidden sm:inline max-w-[140px] truncate">{me?.user?.name ?? me?.user?.email}</span><ChevronDown className="h-3.5 w-3.5" style={{ color: "var(--color-faint)" }} /></button>
            {userOpen && <div className="absolute right-0 mt-2 w-56 card p-1.5 z-40 fade-up text-sm"><div className="px-3 py-2 text-xs truncate" style={{ color: "var(--color-muted)" }}>{me?.user?.email}</div><Link href="/app/settings/profile" className="nav-link"><Settings />Settings</Link><Link href="/app/settings/billing" className="nav-link"><CreditCard />Billing</Link><Link href="/app/settings/socials" className="nav-link"><Radio />Social accounts</Link><a href="/api/auth/signout" className="nav-link" style={{ color: "var(--color-danger)" }}><LogOut />Sign out</a></div>}
          </div>
        </header>
        <main className="p-5 md:p-7 flex-1 space-y-4 fade-up">{me?.mode === "mock" && <MockBanner mode={me.mode} />}{me?.account.graceUntil && <div className="rounded-xl px-3 py-2 text-xs" style={{ background: "rgba(251,113,133,.1)", border: "1px solid rgba(251,113,133,.25)", color: "var(--color-danger)" }}>Payment failed. Update your card in Billing to keep your plan.</div>}{children}</main>
      </div>
      {cmd && <div className="fixed inset-0 z-50 backdrop-blur-sm p-4 pt-[12vh]" style={{ background: "rgba(0,0,0,.55)" }} onClick={() => setCmd(false)}><div className="card mx-auto max-w-lg overflow-hidden fade-up" onClick={(e) => e.stopPropagation()}><div className="flex items-center gap-2 px-4" style={{ borderBottom: "1px solid var(--color-hairline)" }}><Search className="h-4 w-4" style={{ color: "var(--color-faint)" }} /><input autoFocus className="w-full py-3.5 text-sm outline-none bg-transparent" placeholder="Jump to a page…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && hits[0]) { router.push(hits[0][1]); setCmd(false); setQ(""); } }} /></div><div className="p-1.5 max-h-80 overflow-y-auto">{hits.map(([l, h]) => <button key={h} className="w-full text-left nav-link" onClick={() => { router.push(h); setCmd(false); setQ(""); }}>{l}<span className="ml-auto text-xs" style={{ color: "var(--color-faint)" }}>{h}</span></button>)}{hits.length === 0 && <div className="p-3 text-sm" style={{ color: "var(--color-muted)" }}>No matches</div>}</div></div></div>}
    </div>
  );
}
