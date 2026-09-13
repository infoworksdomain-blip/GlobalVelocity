import { pageMeta } from "@/lib/seo";
import { notFound } from "next/navigation";
import { ALTERNATIVES } from "@/content/site";
import { SeoPage } from "@/components/seo-page";
export const generateStaticParams = () => ALTERNATIVES.map((t) => ({ slug: t.slug }));
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const t = ALTERNATIVES.find((x) => x.slug === slug); return pageMeta({ title: t?.title ?? "Alternative", description: `Looking for a ${t?.them ?? ""} alternative? Velocity generates short-form content from your website, then schedules and publishes it to TikTok, Reels, Shorts and LinkedIn.`, path: `/alternatives/${slug}` }); }
export default async function Alt({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const t = ALTERNATIVES.find((x) => x.slug === slug); if (!t) notFound();
  return <SeoPage path={`/alternatives/${slug}`} eyebrow="Alternative" title={t.title} intro={`${t.them} is a great editor. Velocity is different: it generates the content for you from your website, then schedules and publishes it.`} bullets={["No editing timeline to learn", "Content generated from your Company Profile", "Swipe approval and native scheduling", "Analytics and attribution built in"]} />;
}
