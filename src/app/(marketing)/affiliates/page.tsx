import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({ title: 'Affiliate program — 30% lifetime commission', description: 'Refer founders and creators to Velocity and earn 30% of every payment for as long as they stay subscribed. 60-day cookie, monthly payouts.', path: '/affiliates' });
import Link from "next/link";

export default function Affiliates() { return <div className="mx-auto max-w-3xl px-4 py-16"><h1 className="text-4xl font-extrabold">Earn 30% lifetime commission</h1><p className="mt-3 text-lg text-slate-600">Refer founders and creators. You earn 30% of every payment they make, for as long as they stay subscribed.</p><ul className="mt-6 space-y-2 text-slate-700"><li>✓ 30% recurring, lifetime</li><li>✓ 60-day cookie</li><li>✓ Monthly payouts, $50 minimum</li><li>✓ Real-time dashboard</li></ul><Link href="/app/affiliate" className="btn-primary mt-8">Join the program</Link></div>; }
