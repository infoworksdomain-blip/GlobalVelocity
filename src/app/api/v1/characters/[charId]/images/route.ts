import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { consumeCredits, refundCredits } from "@/lib/tenancy";
import { generateImage, store } from "@/lib/render";
import { publicUrl } from "@/lib/storage";
import { CREDIT_TARIFF } from "@/lib/plans";
import { err } from "@/lib/errors";
import { z } from "zod";
/** Consistency pack (FR-9.1): generate additional reference views of an owned character (4 credits each) so downstream video keeps the same face. */
export const POST = route(async ({ actor, params, body }) => {
  const b = parse(z.object({ views: z.array(z.string().max(80)).min(1).max(4).default(["smiling close-up", "three-quarter view", "talking, phone camera"]) }), body);
  const c = await db.query.characters.findFirst({ where: and(eq(schema.characters.id, params.charId), eq(schema.characters.ownerAccountId, actor.accountId)) });
  if (!c) throw err(404, "CHARACTER_NOT_FOUND", "Only your own characters can be extended");
  const credits = b.views.length * CREDIT_TARIFF.image; await consumeCredits(actor.accountId, credits, "image", "character_pack", c.id);
  const keys: string[] = [];
  try { for (const v of b.views) { const { png } = await generateImage(`${c.name}, ${v}, same person as reference, consistent face and hair`, c.referenceImages[0]); keys.push(await store(`acct/${actor.accountId}/characters/${c.id}-${Date.now()}-${keys.length}.png`, png, "image/png")); } }
  catch (e) { await refundCredits(actor.accountId, credits, "character_pack", c.id); throw e; }
  const [u] = await db.update(schema.characters).set({ referenceImages: [...c.referenceImages, ...keys] }).where(eq(schema.characters.id, c.id)).returning();
  return { character: { ...u, referenceImages: u.referenceImages.map((k) => (k.startsWith("data:") || k.startsWith("http") ? k : publicUrl(k)!)) }, credits_used: credits };
});
