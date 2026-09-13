import type { MetadataRoute } from "next";
import { TOOLS, COMPARE, ALTERNATIVES, INDUSTRIES, BLOG } from "@/content/site";
export default function sitemap(): MetadataRoute.Sitemap {
  const b = process.env.APP_URL ?? "http://localhost:3000";
  return [
    "", "/pricing", "/faq", "/blog", "/developers", "/affiliates", "/contact", "/privacy", "/terms",
    ...TOOLS.map((t) => `/tools/${t.slug}`), ...COMPARE.map((t) => `/compare/${t.slug}`), ...ALTERNATIVES.map((t) => `/alternatives/${t.slug}`), ...INDUSTRIES.map((t) => `/industries/${t.slug}`), ...BLOG.map((t) => `/blog/${t.slug}`),
  ].map((p) => ({ url: b + p, lastModified: new Date() }));
}
