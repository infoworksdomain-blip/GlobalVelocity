import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { err } from "@/lib/errors";
import { embed } from "@/lib/llm";
import { z } from "zod";
/** Curator bulk import of trend records (metadata + recipe only). Accepts JSON array; upserts on (platform, external_post_id). */
const rec = z.object({ platform: z.enum(["tiktok", "instagram", "youtube", "linkedin"]), external_post_id: z.string(), post_url: z.string().url(), creator_handle: z.string().optional(), niche_tags: z.array(z.string()).default([]), format_type: z.string().optional(), hook_text: z.string().optional(), recipe: z.object({ structure: z.array(z.object({ segment: z.string(), seconds: z.number(), text_slot: z.string().optional() })), style: z.string(), sound: z.string().optional(), why_it_works: z.string().optional() }), metrics: z.object({ views: z.number(), likes: z.number().default(0), comments: z.number().default(0), shares: z.number().optional(), posted_at: z.string().optional() }) });
export const POST = route(async ({ actor, body }) => {
  if (!actor.isPlatformAdmin) throw err(403, "FORBIDDEN", "Admin only");
  const rows = parse(z.array(rec).min(1).max(500), body);
  let n = 0;
  for (const t of rows) {
    await db.insert(schema.trends).values({ platform: t.platform, externalPostId: t.external_post_id, postUrl: t.post_url, creatorHandle: t.creator_handle, nicheTags: t.niche_tags, formatType: t.format_type, hookText: t.hook_text, recipe: t.recipe, metrics: t.metrics, velocityScore: String(Math.min(1, t.metrics.views / 2_000_000)), embedding: embed(`${t.niche_tags.join(" ")} ${t.format_type ?? ""} ${t.hook_text ?? ""} ${t.recipe.style}`), firstSeenAt: t.metrics.posted_at ? new Date(t.metrics.posted_at) : new Date() })
      .onConflictDoUpdate({ target: [schema.trends.platform, schema.trends.externalPostId], set: { metrics: t.metrics, recipe: t.recipe, hookText: t.hook_text, nicheTags: t.niche_tags, metricsUpdatedAt: new Date(), status: "active" } });
    n++;
  }
  return { imported: n };
});
