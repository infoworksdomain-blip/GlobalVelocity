import { pageMeta } from "@/lib/seo";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BLOG } from "@/content/site";
import { ShareRow } from "@/components/share";
export const generateStaticParams = () => BLOG.map((t) => ({ slug: t.slug }));
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const t = BLOG.find((x) => x.slug === slug); return pageMeta({ title: t?.title ?? "Article", description: t?.excerpt ?? "", path: `/blog/${slug}`, type: "article", published: t?.date }); }
export default async function Post({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const p = BLOG.find((x) => x.slug === slug); if (!p) notFound();
  return <article className="mx-auto max-w-3xl px-4 py-16"><div className="text-xs text-slate-500">{p.date}</div><h1 className="text-4xl font-extrabold mt-1">{p.title}</h1>{p.body.map((para, i) => <p key={i} className="mt-5 text-lg text-slate-700">{para}</p>)}<section className="mt-12"><h2 className="font-bold">Keep reading</h2><div className="mt-3 grid gap-2 sm:grid-cols-2">{BLOG.filter((x) => x.slug !== p.slug).map((x) => <Link key={x.slug} href={`/blog/${x.slug}`} className="card card-hover px-4 py-3 text-sm font-medium">{x.title}</Link>)}</div><p className="mt-4 text-sm text-slate-500">Get started: <Link className="underline" href="/login">create a free account</Link> or read the <Link className="underline" href="/faq">FAQ</Link>.</p></section><ShareRow path={`/blog/${p.slug}`} title={p.title} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "BlogPosting", headline: p.title, datePublished: p.date, description: p.excerpt, author: { "@type": "Organization", name: "Velocity" } }) }} /></article>;
}
