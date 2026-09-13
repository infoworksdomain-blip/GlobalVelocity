import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({ title: 'Careers', description: 'We are a small team building marketing automation for founders. See how to get in touch about future roles.', path: '/careers' });

export default function Careers() { return <div className="mx-auto max-w-3xl px-4 py-16"><h1 className="text-4xl font-extrabold">Careers</h1><p className="mt-3 text-slate-600">We're a small team building marketing automation for founders. No open roles right now — say hello via the contact page.</p></div>; }
