import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireWorkspace, consumeCredits, assertCanSave, audit } from "@/lib/tenancy";
import { videoCredits } from "@/lib/render";
import { enqueue } from "@/lib/queue";
import { moderateText } from "@/lib/llm";
import { err } from "@/lib/errors";
import { z } from "zod";
/** AI Studio video generation (FR-9.2): 10 credits/second, charged up front (refunded on failure by the worker), rendered asynchronously as an ai_ugc item. */
export const POST = route(async ({ actor, body }) => {
  const b = parse(z.object({ workspace_id: z.string().uuid(), script: z.string().min(10).max(2000), character_id: z.string().uuid().optional(), seconds: z.number().int().min(5).max(60).default(20), caption: z.string().max(2200).optional() }), body);
  const { ws, plan } = await requireWorkspace(actor, b.workspace_id, "editor");
  if (moderateText(b.script).status === "blocked") throw err(422, "MODERATION", "Script violates policy");
  const character = b.character_id ? await db.query.characters.findFirst({ where: eq(schema.characters.id, b.character_id) }) : null;
  await assertCanSave(ws.accountId, plan);
  const credits = videoCredits(b.seconds); await consumeCredits(ws.accountId, credits, "video", "studio", b.script.slice(0, 40));
  const [item] = await db.insert(schema.contentItems).values({ workspaceId: ws.id, format: "ai_ugc", status: "generating", hook: b.script.split(/[.!?]/)[0].slice(0, 80), script: b.script, caption: b.caption ?? "", onScreenText: [b.script.split(/[.!?]/)[0].slice(0, 80)], characterId: character?.id, isAiGenerated: true, provenance: { studio: "video", requested_seconds: b.seconds, credits_consumed: credits } }).returning();
  const [job] = await db.insert(schema.jobs).values({ workspaceId: ws.id, type: "render.item" }).returning();
  await enqueue("render.item", { itemId: item.id, jobId: job.id, finalStatus: "saved" }, { priority: 1 });
  await audit({ accountId: ws.accountId, workspaceId: ws.id, actorId: actor.userId, action: "studio.video_generate", targetType: "content_item", targetId: item.id, meta: { credits, seconds: b.seconds } });
  return { item_id: item.id, job_id: job.id, credits_used: credits };
});
