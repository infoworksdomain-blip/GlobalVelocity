import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireWorkspace } from "@/lib/tenancy";
import { err } from "@/lib/errors";
import { enqueue } from "@/lib/queue";
import { z } from "zod";

const recipeSchema = z.object({
  trim: z.object({ startMs: z.number().min(0), endMs: z.number().positive() }).optional(),
  crop: z.object({ x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive() }).optional(),
  adjust: z.object({ brightness: z.number().min(0.1).max(3), contrast: z.number().min(0.1).max(3), saturation: z.number().min(0).max(3) }).optional(),
});

/** Local video edits (trim/crop/adjust) -- always async (ffmpeg re-encode, unlike the sharp-based sync
 *  image-edit route), free -- no credit charge, matching the local-op precedent. */
export const POST = route(async ({ actor, params, body }) => {
  const item = await db.query.contentItems.findFirst({ where: eq(schema.contentItems.id, params.itemId) });
  if (!item || item.deletedAt) throw err(404, "CONTENT_NOT_FOUND", "Content not found");
  await requireWorkspace(actor, item.workspaceId, "editor");
  if (!item.media.video_key) throw err(409, "NO_VIDEO", "This item has no video to edit");
  const recipe = parse(recipeSchema, body);
  if (item.status === "generating") throw err(409, "BUSY", "Item is busy");

  const [job] = await db.insert(schema.jobs).values({ workspaceId: item.workspaceId, type: "video.edit" }).returning();
  await enqueue("video.edit", { itemId: item.id, jobId: job.id, recipe }, { priority: 1 });
  return { job_id: job.id };
});
