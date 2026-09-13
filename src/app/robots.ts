import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? "";
  return { rules: [{ userAgent: "*", allow: ["/", "/t.js"], disallow: ["/app/", "/api/", "/login", "/invite/", "/r/", "/media/"] }, { userAgent: "GPTBot", disallow: ["/"] }], sitemap: `${base}/sitemap.xml`, host: base || undefined };
}
