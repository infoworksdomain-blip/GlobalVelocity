import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";
import { requireWorkspace, bumpUsage, limits, assertTrendRemix } from "@/lib/tenancy";
import { enqueue } from "@/lib/queue";
import { err } from "@/lib/errors";
import { z } from "zod";

const FORMATS = ["ai_ugc", "human_ugc", "slideshow", "hook_demo", "meme", "remix", "wall_of_text", "green_screen"] as const;
export const POST = route(async ({ actor, params, body }) => {
  const { ws, plan } = await requireWorkspace(actor, params.id, "editor");
  const b = parse(z.object({ count: z.number().int().min(1).max(100).default(30), formats: z.array(z.enum(FORMATS)).optional(), character_ids: z.array(z.string().uuid()).optional(), trend_ids: z.array(z.string().uuid()).optional(), language: z.string().max(8).optional(), angle_hints: z.array(z.string()).optional(), source: z.enum(["blitz", "studio", "api"]).default("blitz") }), body);
  const profile = await db.query.companyProfiles.findFirst({ where: and(eq(schema.companyProfiles.workspaceId, ws.id), eq(schema.companyProfiles.isCurrent, true)) });
  if (!profile) throw err(409, "PROFILE_REQUIRED", "Create a company profile first");
  if (b.trend_ids?.length) assertTrendRemix(plan);
  if (b.language && b.language !== profile.data.language && !limits(plan).multiLanguage) throw err(402, "PLAN_MULTI_LANGUAGE", "Multi-language content requires Pro");
  await bumpUsage(ws.accountId, "candidates_generated", b.count, "day", limits(plan).candidatesPerDay);
  const [batch] = await db.insert(schema.generationBatches).values({ workspaceId: ws.id, profileId: profile.id, requestedBy: actor.userId, source: actor.apiKey ? "api" : b.source, requestedCount: b.count, params: { formats: b.formats, character_ids: b.character_ids, trend_ids: b.trend_ids, language: b.language, angle_hints: b.angle_hints } }).returning();
  await enqueue("generate.batch", { batchId: batch.id });
  return { batch_id: batch.id, status: "queued" };
});
