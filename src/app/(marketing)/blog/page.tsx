import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({ title: 'Blog — short-form marketing for founders', description: 'Practical guides on posting daily without burning out, UGC-style content, and attribution for social video.', path: '/blog' });
import Link from "next/link";
import { BLOG } from "@/content/site";

export default function Blog() { return <div className="mx-auto max-w-3xl px-4 py-16"><h1 className="text-4xl font-extrabold">Blog</h1><div className="mt-8 space-y-6">{BLOG.map((p) => <Link key={p.slug} href={`/blog/${p.slug}`} className="card p-6 block hover:shadow-md"><div className="text-xs text-slate-500">{p.date}</div><h2 className="text-xl font-bold mt-1">{p.title}</h2><p className="text-slate-600 mt-1">{p.excerpt}</p></Link>)}</div></div>; }
