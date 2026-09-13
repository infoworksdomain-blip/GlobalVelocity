import { z } from "zod";
import { completeJson, embed } from "@/lib/llm";
import type { CrawlResult } from "@/lib/crawler";
import type { CompanyProfileData, ContentFormat, TrendRecipe } from "@/db/schema";

// ---------------- Company profile (M3) ----------------
const profileSchema = z.object({
  product_name: z.string(), website_url: z.string(), tagline: z.string().default(""), one_line_description: z.string(),
  category: z.enum(["saas", "mobile_app", "ecommerce", "service", "other"]).default("other"), industry: z.string().default(""),
  target_audience: z.array(z.object({ segment: z.string(), pain_points: z.array(z.string()).default([]), desires: z.array(z.string()).default([]) })).default([]),
  tone_of_voice: z.object({ adjectives: z.array(z.string()).default([]), do: z.array(z.string()).default([]), dont: z.array(z.string()).default([]) }).default({ adjectives: [], do: [], dont: [] }),
  key_features: z.array(z.string()).default([]), differentiators: z.array(z.string()).default([]),
  competitors: z.array(z.object({ name: z.string(), url: z.string().optional() })).default([]),
  pricing_summary: z.string().default(""), call_to_action: z.string().default(""),
  app_store_links: z.object({ ios: z.string().optional(), android: z.string().optional() }).default({}),
  brand: z.object({ logo_url: z.string().optional(), primary_color: z.string().optional(), secondary_color: z.string().optional(), screenshots: z.array(z.string()).default([]) }).default({ screenshots: [] }),
  hooks_seed: z.array(z.string()).default([]), content_pillars: z.array(z.string()).default([]), language: z.string().default("en"),
  confidence: z.record(z.number()).default({}),
});

export async function analyzeProfile(crawl: CrawlResult): Promise<CompanyProfileData> {
  const system = `You are a growth strategist. From website content, produce a Company Profile JSON with keys: product_name, website_url, tagline, one_line_description, category (saas|mobile_app|ecommerce|service|other), industry, target_audience[{segment,pain_points[],desires[]}], tone_of_voice{adjectives[],do[],dont[]}, key_features[], differentiators[], competitors[{name,url}], pricing_summary, call_to_action, app_store_links{ios,android}, brand{logo_url,primary_color,secondary_color,screenshots[]}, hooks_seed[] (8 short-form video hook ideas), content_pillars[] (4-6), language (ISO code), confidence{field:0-1}. Be concrete and specific to this product.`;
  const user = `URL: ${crawl.url}\nTitle: ${crawl.title}\nDescription: ${crawl.description}\nHeadings: ${crawl.headings.join(" | ")}\nApp links: ${JSON.stringify(crawl.appLinks)}\nImages: ${crawl.images.slice(0, 8).join(", ")}\n\nContent:\n${crawl.text.slice(0, 25_000)}`;
  const name = crawl.title.split(/[|\-–:]/)[0].trim() || new URL(crawl.url).hostname.replace("www.", "");
  return completeJson(system, user, profileSchema, () => ({
    product_name: name, website_url: crawl.url, tagline: crawl.description.slice(0, 80) || `${name} — the faster way`,
    one_line_description: crawl.description || `${name} helps people get more done with less effort.`, category: crawl.appLinks.ios ? ("mobile_app" as const) : ("saas" as const),
    industry: "Software", target_audience: [{ segment: "Founders and small teams", pain_points: ["No time for marketing", "Inconsistent posting", "Content that doesn't convert"], desires: ["Steady stream of signups", "Look professional", "Post daily without effort"] }],
    tone_of_voice: { adjectives: ["direct", "friendly", "confident"], do: ["Talk like a founder", "Use concrete numbers"], dont: ["Corporate jargon", "Overpromise"] },
    key_features: crawl.headings.slice(0, 5).length ? crawl.headings.slice(0, 5) : ["Fast setup", "Automation", "Analytics"],
    differentiators: ["Built for speed", "No learning curve"], competitors: [], pricing_summary: "Free to start", call_to_action: "Try it free",
    app_store_links: crawl.appLinks, brand: { logo_url: crawl.ogImage, primary_color: "#1F3A93", secondary_color: "#0B1F4B", screenshots: crawl.images.slice(0, 6) },
    hooks_seed: [`I stopped doing marketing manually because of ${name}`, `POV: you finally found a tool that ${name.toLowerCase()} users won't shut up about`, `3 things I wish I knew before trying ${name}`, `This is how I get customers while I sleep`, `Nobody talks about this ${name} feature`, `Day 1 of using ${name} for my business`, `Stop scrolling if you run a business`, `The $0 marketing strategy that actually works`],
    content_pillars: ["Behind the build", "Customer wins", "Tips & how-to", "Trends & memes"], language: "en", confidence: { product_name: 0.6, target_audience: 0.4 },
  }));
}
export const profileEmbedding = (p: CompanyProfileData) => embed([p.product_name, p.one_line_description, p.industry, ...p.key_features, ...p.content_pillars, ...p.target_audience.map((a) => a.segment)].join(" "));

// ---------------- Angles + copy (M4) ----------------
export type Angle = { type: string; angle: string };
const anglesSchema = z.object({ angles: z.array(z.object({ type: z.string(), angle: z.string() })) });
export async function generateAngles(profile: CompanyProfileData, n: number, avoid: string[]): Promise<Angle[]> {
  const types = ["pain_point", "benefit", "comparison", "story", "objection", "feature_spotlight", "social_proof", "curiosity"];
  const system = `You write short-form video angles for a product. Return {"angles":[{"type","angle"}]} with ${n} distinct angles across types ${types.join(", ")}. Avoid these already-used angles: ${avoid.slice(0, 40).join(" | ") || "none"}.`;
  const user = `Product: ${profile.product_name}\n${profile.one_line_description}\nAudience: ${JSON.stringify(profile.target_audience)}\nFeatures: ${profile.key_features.join("; ")}\nDifferentiators: ${profile.differentiators.join("; ")}\nPillars: ${profile.content_pillars.join(", ")}`;
  const res = await completeJson(system, user, anglesSchema, () => ({
    angles: Array.from({ length: n }, (_, i) => {
      const t = types[i % types.length]; const f = profile.key_features[i % Math.max(1, profile.key_features.length)] ?? "the product";
      const pain = profile.target_audience[0]?.pain_points[i % 3] ?? "wasting time";
      return { type: t, angle: ({ pain_point: `Stop ${pain.toLowerCase()} — here's the fix`, benefit: `How ${f} saves you hours every week`, comparison: `${profile.product_name} vs doing it the old way`, story: `Day ${i + 1} of growing my business with ${profile.product_name}`, objection: `"I don't have time" — this is for you`, feature_spotlight: `Nobody talks about ${f}`, social_proof: `Why founders keep recommending ${profile.product_name}`, curiosity: `The one thing I'd never go back from` } as Record<string, string>)[t] };
    }),
  }));
  return res.angles.slice(0, n);
}

export type Copy = { hook: string; script: string; on_screen_text: string[]; caption: string; hashtags: string[]; slides?: { title: string; body: string }[]; meme_top?: string; meme_bottom?: string };
const copySchema = z.object({
  hook: z.string(), script: z.string(), on_screen_text: z.array(z.string()).default([]), caption: z.string(), hashtags: z.array(z.string()).default([]),
  slides: z.array(z.object({ title: z.string(), body: z.string() })).optional(), meme_top: z.string().optional(), meme_bottom: z.string().optional(),
});
const formatBrief: Record<ContentFormat, string> = {
  ai_ugc: "A 25-40 second talking-head UGC script spoken casually to camera, first person, phone-camera energy. 80-120 words.",
  human_ugc: "A 20-30 second voiceover script to lay over real creator b-roll. 60-90 words.",
  slideshow: "A TikTok photo carousel: 5-7 slides, each with a punchy title (<=8 words) and a one-sentence body. Slide 1 is the hook, last slide is the CTA. Return them in slides[].",
  hook_demo: "A 15-25 second hook + demo: an on-screen hook line, then 3-4 short on-screen text beats describing what the viewer sees. Return beats in on_screen_text.",
  meme: "A meme: meme_top and meme_bottom lines that reframe the audience's pain point with humour. Keep each under 12 words.",
  remix: "A remix of a trending format: fill the recipe's text slots with product-specific lines; keep the structure and timing.",
  upload: "Caption only.",
};
export async function generateCopy(profile: CompanyProfileData, angle: Angle, format: ContentFormat, opts: { language?: string; trend?: TrendRecipe | null; platformHint?: string }): Promise<Copy> {
  const system = `You are a short-form content writer for TikTok/Reels/Shorts/LinkedIn. Tone: ${profile.tone_of_voice.adjectives.join(", ")}. Do: ${profile.tone_of_voice.do.join("; ")}. Don't: ${profile.tone_of_voice.dont.join("; ")}. Never make medical, financial or guaranteed-results claims. Write in language "${opts.language ?? profile.language}". Return JSON {hook, script, on_screen_text[], caption, hashtags[], slides?[], meme_top?, meme_bottom?}. Hook <= 12 words. Caption <= 300 chars ending with a CTA. 4-6 hashtags without #.`;
  const user = `Product: ${profile.product_name} — ${profile.one_line_description}\nFeatures: ${profile.key_features.join("; ")}\nAudience: ${profile.target_audience.map((a) => a.segment).join(", ")}\nCTA: ${profile.call_to_action}\nAngle (${angle.type}): ${angle.angle}\nFormat brief: ${formatBrief[format]}\n${opts.trend ? `Trend recipe: ${JSON.stringify(opts.trend)}` : ""}`;
  const tags = ["founder", "smallbusiness", "marketing", "growth", "startup", "buildinpublic"];
  return completeJson(system, user, copySchema, () => ({
    hook: angle.angle.length > 70 ? angle.angle.slice(0, 67) + "…" : angle.angle,
    script: `${angle.angle}. Okay so here's the thing — I run a small business and for months I kept putting off marketing. Then I tried ${profile.product_name}. ${profile.key_features[0] ?? "It does the boring part for you"}. ${profile.differentiators[0] ?? "And it's fast"}. If you've been putting it off too, ${profile.call_to_action || "go try it"}. Link in bio.`,
    on_screen_text: [angle.angle, profile.key_features[0] ?? "It just works", profile.differentiators[0] ?? "Fast setup", profile.call_to_action || "Try it free"],
    caption: `${angle.angle} 🏎️ ${profile.call_to_action || "Try it free"} — link in bio`,
    hashtags: tags,
    slides: format === "slideshow" ? [{ title: angle.angle.slice(0, 40), body: "Here's what changed for me." }, { title: profile.key_features[0] ?? "Feature 1", body: "It handles the part I hated." }, { title: profile.key_features[1] ?? "Feature 2", body: "Set it once, runs daily." }, { title: profile.differentiators[0] ?? "Why it's different", body: "No learning curve." }, { title: profile.call_to_action || "Try it free", body: `${profile.product_name} — link in bio` }] : undefined,
    meme_top: format === "meme" ? "Me: I'll do marketing tomorrow" : undefined,
    meme_bottom: format === "meme" ? `Also me, 6 months later: still no customers` : undefined,
  }));
}

/** Simple performance prior used to order the Velocity stack (FR-5 / design decision †). */
export function predictedScore(format: ContentFormat, trendVelocity: number | null, angleNovelty: number) {
  const base: Record<ContentFormat, number> = { ai_ugc: 0.62, human_ugc: 0.66, slideshow: 0.6, hook_demo: 0.55, meme: 0.5, remix: 0.58, upload: 0.5 };
  return Math.min(0.99, base[format] + (trendVelocity ?? 0) * 0.2 + angleNovelty * 0.15);
}
