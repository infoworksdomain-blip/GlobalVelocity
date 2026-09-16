"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const TABS = [["profile", "Profile & workspace"], ["socials", "Social accounts"], ["billing", "Billing"], ["members", "Team"], ["api", "API keys"], ["tracking", "Website tracking"]];
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const p = usePathname();
  return <div><h1 className="text-2xl font-extrabold">Settings</h1><div className="mt-3 flex flex-wrap gap-1 border-b border-[var(--color-hairline)]">{TABS.map(([k, l]) => <Link key={k} href={`/app/settings/${k}`} className={`px-3 py-2 text-sm font-medium border-b-2 ${p.includes(`/settings/${k}`) ? "border-brand-600 text-brand-700" : "border-transparent text-[var(--color-muted)]"}`}>{l}</Link>)}<Link href="/app/affiliate" className="px-3 py-2 text-sm font-medium text-[var(--color-muted)]">Affiliate</Link></div><div className="mt-6">{children}</div></div>;
}
