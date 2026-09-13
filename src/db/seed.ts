import "dotenv/config";
import { db, schema, sql } from "./index";
import { embed } from "@/lib/llm";

/** Seeds system data: AI model registry, sample synthetic characters, and trend recipes (metadata only — no third-party media). */
async function main() {
  await db.insert(schema.aiModels).values([
    { id: "claude-sonnet-5", provider: "anthropic", type: "llm", displayName: "Claude Sonnet 5", minPlan: "free" },
    { id: "flux-1.1-pro", provider: "fal", type: "image", displayName: "FLUX 1.1 Pro", creditMultiplier: "1", minPlan: "free" },
    { id: "kling-2", provider: "fal", type: "video", displayName: "Kling 2.0", creditMultiplier: "1", minPlan: "starter" },
    { id: "eleven-multilingual-v2", provider: "elevenlabs", type: "tts", displayName: "ElevenLabs Multilingual v2", minPlan: "free" },
    { id: "lipsync-2", provider: "sync", type: "lipsync", displayName: "Lipsync 2", creditMultiplier: "1", minPlan: "starter" },
  ]).onConflictDoNothing();

  const chars = [
    ["Maya", "female", "25-34", ["tech", "saas", "lifestyle"], ["office", "cafe"], "starter"], ["Leo", "male", "25-34", ["fitness", "finance"], ["gym", "car"], "starter"],
    ["Priya", "female", "18-24", ["beauty", "ecommerce"], ["bedroom", "outdoors"], "starter"], ["Marcus", "male", "35-44", ["b2b", "finance", "saas"], ["office"], "growth"],
    ["Sofia", "female", "25-34", ["travel", "apps"], ["outdoors", "kitchen"], "growth"], ["Ken", "male", "18-24", ["gaming", "apps"], ["bedroom"], "growth"],
    ["Amara", "female", "35-44", ["health", "parenting"], ["kitchen", "car"], "pro"], ["Diego", "male", "25-34", ["ecommerce", "dropshipping"], ["warehouse", "office"], "pro"],
  ] as const;
  for (const [name, gender, age, style, setting, tier] of chars) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="hsl(${(name.length * 47) % 360},55%,45%)"/><circle cx="256" cy="200" r="90" fill="#f5d5c0"/><rect x="146" y="300" width="220" height="160" rx="60" fill="#e8e8e8"/><text x="256" y="490" font-size="40" text-anchor="middle" fill="#fff" font-family="sans-serif">${name} · synthetic</text></svg>`;
    const dataUrl = "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
    await db.insert(schema.characters).values({ name, gender, ageRange: age, styleTags: [...style], settingTags: [...setting], tier, referenceImages: [dataUrl], voiceId: null, status: "published" }).onConflictDoNothing();
  }

  const recipes = [
    ["tiktok", "trend-001", "founder", "things_i_wish_i_knew", "3 things I wish I knew before starting my business", [{ segment: "hook", seconds: 2.5, text_slot: "3 things I wish I knew before…" }, { segment: "point 1", seconds: 3 }, { segment: "point 2", seconds: 3 }, { segment: "point 3", seconds: 3 }, { segment: "cta", seconds: 2.5 }], "POV text over lifestyle b-roll", 0.82],
    ["tiktok", "trend-002", "saas", "pov_text", "POV: you finally automated the thing you hated", [{ segment: "hook", seconds: 3, text_slot: "POV: …" }, { segment: "reveal", seconds: 4 }, { segment: "cta", seconds: 2 }], "Single-shot reaction with big text", 0.9],
    ["instagram", "trend-003", "ecommerce", "green_screen", "Reacting to my own product reviews", [{ segment: "hook", seconds: 2 }, { segment: "review 1", seconds: 4 }, { segment: "review 2", seconds: 4 }, { segment: "cta", seconds: 2 }], "Green screen over screenshots", 0.7],
    ["youtube", "trend-004", "apps", "before_after", "Before vs after using this app", [{ segment: "before", seconds: 4, text_slot: "Before:" }, { segment: "after", seconds: 4, text_slot: "After:" }, { segment: "cta", seconds: 2 }], "Split screen", 0.65],
    ["tiktok", "trend-005", "marketing", "day_in_life", "Day 1 of marketing my app for 30 days", [{ segment: "hook", seconds: 2.5, text_slot: "Day 1 of …" }, { segment: "what i did", seconds: 5 }, { segment: "result", seconds: 3 }, { segment: "cta", seconds: 2 }], "Vlog style with captions", 0.88],
    ["linkedin", "trend-006", "b2b", "hot_take", "Unpopular opinion: most marketing advice is wrong", [{ segment: "hook", seconds: 3, text_slot: "Unpopular opinion:" }, { segment: "argument", seconds: 6 }, { segment: "cta", seconds: 2 }], "Talking head, professional", 0.6],
  ] as const;
  for (const [platform, id, niche, fmt, hook, structure, style, velocity] of recipes) {
    await db.insert(schema.trends).values({ platform, externalPostId: id, postUrl: `https://example.com/${platform}/${id}`, creatorHandle: "curated", nicheTags: [niche, "founder", "smallbusiness"], formatType: fmt, hookText: hook, recipe: { structure: [...structure], style, why_it_works: "Fast hook, clear structure, strong CTA" }, metrics: { views: Math.round(velocity * 2_000_000), likes: Math.round(velocity * 120_000), comments: Math.round(velocity * 3_000) }, velocityScore: String(velocity), embedding: embed(`${niche} ${fmt} ${hook} ${style}`) }).onConflictDoNothing();
  }
  console.log("seeded");
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
