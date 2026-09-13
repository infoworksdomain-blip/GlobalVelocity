import { pageMeta } from "@/lib/seo";
import { notFound } from "next/navigation";
import { COMPARE } from "@/content/site";
import { SeoPage } from "@/components/seo-page";
export const generateStaticParams = () => COMPARE.map((t) => ({ slug: t.slug }));
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const t = COMPARE.find((x) => x.slug === slug); return pageMeta({ title: `${t?.title ?? "Comparison"} — which should you choose?`, description: t?.summary ?? "", path: `/compare/${slug}` }); }
export default async function Compare({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const t = COMPARE.find((x) => x.slug === slug); if (!t) notFound();
  return <SeoPage path={`/compare/${slug}`} eyebrow="Comparison" title={t.title} intro={t.summary} sections={[{ h: "Content generation", p: `Velocity generates AI UGC, slideshows, hook + demo videos, memes and trend remixes from your website. With ${t.them}, you bring your own content.` }, { h: "Approval speed", p: "Velocity mode lets you approve a month of posts in minutes with swipe or keyboard." }, { h: "Publishing", p: "Native publishing to TikTok, Instagram Reels, YouTube Shorts and LinkedIn with best-time queues and attribution." }]} cta="Switch to Velocity" />;
}
