import { pageMeta } from "@/lib/seo";
import { notFound } from "next/navigation";
import { INDUSTRIES } from "@/content/site";
import { SeoPage } from "@/components/seo-page";
export const generateStaticParams = () => INDUSTRIES.map((t) => ({ slug: t.slug }));
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const t = INDUSTRIES.find((x) => x.slug === slug); return pageMeta({ title: `AI marketing for ${t?.title ?? "your industry"}`, description: t?.pitch ?? "", path: `/industries/${slug}` }); }
export default async function Industry({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const t = INDUSTRIES.find((x) => x.slug === slug); if (!t) notFound();
  return <SeoPage path={`/industries/${slug}`} eyebrow="Industry" title={`AI marketing for ${t.title}`} intro={t.pitch} bullets={["On-brand angles from your website", "Formats that work for your audience", "Publish daily without a team"]} />;
}
