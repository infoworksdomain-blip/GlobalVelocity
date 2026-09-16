import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireWorkspace, consumeCredits } from "@/lib/tenancy";
import { err } from "@/lib/errors";
import { enqueue } from "@/lib/queue";
import { CREDIT_TARIFF } from "@/lib/plans";
import { z } from "zod";

const TARIFF = { bg_remove: CREDIT_TARIFF.imageBgRemove, inpaint: CREDIT_TARIFF.imageInpaint, upscale: CREDIT_TARIFF.imageUpscale } as const;

/** AI-powered edits (bg removal/inpaint/upscale) -- real fal.ai queue-API calls, unpredictable latency,
 *  so this is async: enqueue + return a job id, same jobs/poll pattern as /content/[itemId]/rerender. */
export const POST = route(async ({ actor, params, body }) => {
  const item = await db.query.contentItems.findFirst({ where: eq(schema.contentItems.id, params.itemId) });
  if (!item || item.deletedAt) throw err(404, "CONTENT_NOT_FOUND", "Content not found");
  const { ws } = await requireWorkspace(actor, item.workspaceId, "editor");
  if (!item.media.image_keys?.[0]) throw err(409, "NO_IMAGE", "This item has no image to edit");
  const b = parse(z.object({ op: z.enum(["bg_remove", "inpaint", "upscale"]), mask_key: z.string().optional() }), body);
  if (b.op === "inpaint" && !b.mask_key) throw err(400, "VALIDATION", "mask_key is required for inpaint");

  const cost = TARIFF[b.op];
  await consumeCredits(ws.accountId, cost, "image", "content_item", item.id);
  const [job] = await db.insert(schema.jobs).values({ workspaceId: item.workspaceId, type: "image.ai_edit" }).returning();
  await enqueue("image.ai_edit", { itemId: item.id, jobId: job.id, op: b.op, maskKey: b.mask_key, accountId: ws.accountId, creditsUsed: cost }, { priority: 1 });
  return { job_id: job.id };
});
