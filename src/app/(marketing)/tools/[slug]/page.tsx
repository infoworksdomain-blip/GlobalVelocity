import { pageMeta } from "@/lib/seo";
import { notFound } from "next/navigation";
import { TOOLS } from "@/content/site";
import { SeoPage } from "@/components/seo-page";
export const generateStaticParams = () => TOOLS.map((t) => ({ slug: t.slug }));
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const t = TOOLS.find((x) => x.slug === slug); return pageMeta({ title: `${t?.title ?? "Tool"} — free AI tool`, description: t?.intro ?? "", path: `/tools/${slug}` }); }
export default async function Tool({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const t = TOOLS.find((x) => x.slug === slug); if (!t) notFound();
  return <SeoPage path={`/tools/${slug}`} eyebrow="Free tool" title={t.title} intro={t.intro} bullets={t.bullets} sections={[{ h: `Why founders use the ${t.title.toLowerCase()}`, p: "Short-form video is the highest-leverage organic channel for early-stage products, but production time kills consistency. Generating from your website removes the blank page." }, { h: "Publish everywhere", p: "Every output is 9:16, captioned and ready for TikTok, Instagram Reels, YouTube Shorts and LinkedIn." }]} />;
}
