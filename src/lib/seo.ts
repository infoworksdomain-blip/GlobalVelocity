import type { Metadata } from "next";
import { APP } from "@/content/site";
/** Builds unique titles, meta descriptions, canonical URLs and social (Open Graph + Twitter) tags for a page. */
export function pageMeta({ title, description, path, image, type = "website", published }: { title: string; description: string; path: string; image?: string; type?: "website" | "article"; published?: string }): Metadata {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const url = base + path;
  const og = image ?? `${base}/api/og?title=${encodeURIComponent(title)}`;
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: { title: `${title} · ${APP.name}`, description, url, siteName: APP.name, type, images: [{ url: og, width: 1200, height: 630, alt: title }], ...(published ? { publishedTime: published } : {}) },
    twitter: { card: "summary_large_image", title: `${title} · ${APP.name}`, description, images: [og], site: APP.twitter, creator: APP.twitter },
  };
}
