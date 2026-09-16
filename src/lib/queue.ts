import { Queue, type JobsOptions } from "bullmq";
import IORedis from "ioredis";

export const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", { maxRetriesPerRequest: null });
/** Three queues: render (heavy ffmpeg, slow) and core (time-critical: publishing, tokens) must never wait on
 *  each other (learned in the first runtime test) -- ingest (bulk clip thumbnailing) is split out for the same
 *  reason: thumbnailing thousands of uploaded clips must not starve either of them. */
export type RenderJob = "generate.batch" | "generate.item" | "render.item";
export type IngestJob = "ugc.thumbnail" | "ugc_image.process";
export type CoreJob = "profile.analyze" | "publish.dispatch" | "publish.post" | "metrics.pull" | "tokens.refresh" | "automation.run" | "automations.tick" | "credits.allocate" | "digest.weekly" | "trends.refresh" | "webhook.deliver" | "affiliates.settle" | "cleanup" | "content.recover";
export type JobName = RenderJob | IngestJob | CoreJob;
const RENDER: ReadonlySet<string> = new Set(["generate.batch", "generate.item", "render.item"]);
const INGEST: ReadonlySet<string> = new Set(["ugc.thumbnail", "ugc_image.process"]);

const g = globalThis as unknown as { qCore?: Queue; qRender?: Queue; qIngest?: Queue };
const opts = { connection, defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 30_000 }, removeOnComplete: 500, removeOnFail: 1000 } };
export const coreQueue = g.qCore ?? new Queue("velocity-core", opts);
export const renderQueue = g.qRender ?? new Queue("velocity-render", opts);
export const ingestQueue = g.qIngest ?? new Queue("velocity-ingest", opts);
if (process.env.NODE_ENV !== "production") { g.qCore = coreQueue; g.qRender = renderQueue; g.qIngest = ingestQueue; }

export function enqueue<T extends object>(name: JobName, data: T, jobOpts?: JobsOptions) {
  const q = RENDER.has(name) ? renderQueue : INGEST.has(name) ? ingestQueue : coreQueue;
  return q.add(name, data, jobOpts);
}
