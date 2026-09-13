import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireWorkspace, consumeCredits, refundCredits, assertCanSave } from "@/lib/tenancy";
import { generateImage, store } from "@/lib/render";
import { CREDIT_TARIFF } from "@/lib/plans";
import { serializeItem } from "@/lib/content";
import { moderateText } from "@/lib/llm";
import { err } from "@/lib/errors";
import { z } from "zod";
/** AI Studio image generation (FR-9.2): 4 credits per image; optional character reference for consistency; saved to the library. */
export const POST = route(async ({ actor, body }) => {
  const b = parse(z.object({ workspace_id: z.string().uuid(), prompt: z.string().min(3).max(1000), character_id: z.string().uuid().optional(), count: z.number().int().min(1).max(4).default(1), save: z.boolean().default(true) }), body);
  const { ws, plan } = await requireWorkspace(actor, b.workspace_id, "editor");
  if (moderateText(b.prompt).status === "blocked") throw err(422, "MODERATION", "Prompt violates policy");
  const character = b.character_id ? await db.query.characters.findFirst({ where: eq(schema.characters.id, b.character_id) }) : null;
  const credits = b.count * CREDIT_TARIFF.image; await consumeCredits(ws.accountId, credits, "image", "studio", b.prompt.slice(0, 40));
  const images: string[] = [];
  try { for (let i = 0; i < b.count; i++) { const { png } = await generateImage(`${b.prompt}${character ? `, featuring ${character.name}` : ""}`, character?.referenceImages[0]); images.push(await store(`ws/${ws.id}/studio/${Date.now()}-${i}.png`, png, "image/png")); } }
  catch (e) { await refundCredits(ws.accountId, credits, "studio", "failed"); throw e; }
  if (!b.save) return { image_keys: images, credits_used: credits };
  await assertCanSave(ws.accountId, plan);
  const [item] = await db.insert(schema.contentItems).values({ workspaceId: ws.id, format: "upload", status: "saved", savedAt: new Date(), hook: b.prompt.slice(0, 80), caption: "", characterId: character?.id, isAiGenerated: true, media: { image_keys: images, thumbnail_key: images[0], width: 768, height: 1024 }, provenance: { studio: "image", prompt: b.prompt, credits_consumed: credits } }).returning();
  return { item: serializeItem(item), credits_used: credits };
});
