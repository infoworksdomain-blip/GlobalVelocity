import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { and, eq, or, sql, arrayContains } from "drizzle-orm";
import { canUseCharacterTier, consumeCredits, refundCredits, audit } from "@/lib/tenancy";
import { generateImage, store } from "@/lib/render";
import { publicUrl } from "@/lib/storage";
import { CREDIT_TARIFF } from "@/lib/plans";
import { z } from "zod";
export const GET = route(async ({ actor, url }) => {
  const q = url.searchParams;
  const rows = await db.select().from(schema.characters).where(and(eq(schema.characters.status, "published"), or(sql`${schema.characters.ownerAccountId} is null`, eq(schema.characters.ownerAccountId, actor.accountId)), q.get("gender") ? eq(schema.characters.gender, q.get("gender")!) : undefined, q.get("style") ? arrayContains(schema.characters.styleTags, [q.get("style")!]) : undefined, q.get("setting") ? arrayContains(schema.characters.settingTags, [q.get("setting")!]) : undefined));
  return { characters: rows.map((c) => ({ ...c, referenceImages: c.referenceImages.map((k) => (k.startsWith("data:") || k.startsWith("http") ? k : publicUrl(k)!)), mine: c.ownerAccountId === actor.accountId, locked: c.ownerAccountId !== actor.accountId && !canUseCharacterTier(actor.plan, c.tier) })) };
});
/** Create an AI influencer (FR-9.1): describe it → image generated (4 credits) or supply an uploaded reference image key. */
export const POST = route(async ({ actor, body }) => {
  const b = parse(z.object({ name: z.string().min(1).max(60), description: z.string().max(500).optional(), reference_key: z.string().optional(), gender: z.string().max(20).optional(), age_range: z.string().max(20).optional(), style_tags: z.array(z.string()).max(8).default([]), setting_tags: z.array(z.string()).max(8).default([]), language: z.string().max(8).default("en"), voice_id: z.string().max(60).optional() }), body);
  let refKey = b.reference_key; let credits = 0;
  if (!refKey) {
    credits = CREDIT_TARIFF.image; await consumeCredits(actor.accountId, credits, "image", "character", b.name);
    try { const { png } = await generateImage(`Portrait of ${b.name}, ${b.description ?? "friendly creator"}, ${b.gender ?? ""} ${b.age_range ?? ""}, natural light, phone camera, UGC style`); refKey = await store(`acct/${actor.accountId}/characters/${Date.now()}.png`, png, "image/png"); }
    catch (e) { await refundCredits(actor.accountId, credits, "character", b.name); throw e; }
  }
  const [c] = await db.insert(schema.characters).values({ ownerAccountId: actor.accountId, name: b.name, gender: b.gender, ageRange: b.age_range, styleTags: b.style_tags, settingTags: b.setting_tags, language: b.language, referenceImages: [refKey], voiceId: b.voice_id, tier: "free", status: "published" }).returning();
  await audit({ accountId: actor.accountId, actorId: actor.userId, action: "character.create", targetId: c.id, meta: { credits } });
  return { character: { ...c, referenceImages: [publicUrl(refKey)], mine: true, locked: false }, credits_used: credits };
});
