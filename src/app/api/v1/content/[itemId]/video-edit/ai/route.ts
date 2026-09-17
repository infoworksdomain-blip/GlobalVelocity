import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireWorkspace, consumeCredits } from "@/lib/tenancy";
import { err } from "@/lib/errors";
import { enqueue } from "@/lib/queue";
import { CREDIT_TARIFF } from "@/lib/plans";
import { z } from "zod";

const TARIFF = { auto_caption: CREDIT_TARIFF.videoAutoCaption, voice_swap: CREDIT_TARIFF.videoVoiceSwap } as const;

/** AI video edits (auto-caption via Whisper, voice-swap via ElevenLabs) -- real provider calls, async,
 *  same jobs/poll + credit debit-refund-on-failure pattern as /content/[itemId]/image-edit/ai. */
export const POST = route(async ({ actor, params, body }) => {
  const item = await db.query.contentItems.findFirst({ where: eq(schema.contentItems.id, params.itemId) });
  if (!item || item.deletedAt) throw err(404, "CONTENT_NOT_FOUND", "Content not found");
  const { ws } = await requireWorkspace(actor, item.workspaceId, "editor");
  if (!item.media.video_key) throw err(409, "NO_VIDEO", "This item has no video to edit");
  const b = parse(z.object({ op: z.enum(["auto_caption", "voice_swap"]), voice_id: z.string().optional() }), body);
  // Format-guarded server-side, not just hidden in the UI -- voice_swap only makes sense for human_ugc
  // clips with a replaceable TTS audio track (hook_demo/remix have no voice at all; ai_ugc's voice is
  // baked into a provider-driven lip-synced render).
  if (b.op === "voice_swap" && item.format !== "human_ugc") throw err(409, "UNSUPPORTED_FORMAT", "Voice swap is only available for human UGC items");

  const cost = TARIFF[b.op];
  await consumeCredits(ws.accountId, cost, "video", "content_item", item.id);
  const [job] = await db.insert(schema.jobs).values({ workspaceId: item.workspaceId, type: "video.ai_edit" }).returning();
  await enqueue("video.ai_edit", { itemId: item.id, jobId: job.id, op: b.op, voiceId: b.voice_id, accountId: ws.accountId, creditsUsed: cost }, { priority: 1 });
  return { job_id: job.id };
});
