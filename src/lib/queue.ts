import { Queue, type JobsOptions } from "bullmq";
import IORedis from "ioredis";

export const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", { maxRetriesPerRequest: null });
/** Two queues so CPU-heavy rendering never delays time-critical publishing (learned in the first runtime test). */
export type RenderJob = "generate.batch" | "generate.item" | "render.item";
export type CoreJob = "profile.analyze" | "publish.dispatch" | "publish.post" | "metrics.pull" | "tokens.refresh" | "automation.run" | "automations.tick" | "credits.allocate" | "digest.weekly" | "trends.refresh" | "webhook.deliver" | "affiliates.settle" | "cleanup";
export type JobName = RenderJob | CoreJob;
const RENDER: ReadonlySet<string> = new Set(["generate.batch", "generate.item", "render.item"]);

const g = globalThis as unknown as { qCore?: Queue; qRender?: Queue };
const opts = { connection, defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 30_000 }, removeOnComplete: 500, removeOnFail: 1000 } };
export const coreQueue = g.qCore ?? new Queue("velocity-core", opts);
export const renderQueue = g.qRender ?? new Queue("velocity-render", opts);
if (process.env.NODE_ENV !== "production") { g.qCore = coreQueue; g.qRender = renderQueue; }

export function enqueue<T extends object>(name: JobName, data: T, jobOpts?: JobsOptions) { return (RENDER.has(name) ? renderQueue : coreQueue).add(name, data, jobOpts); }
