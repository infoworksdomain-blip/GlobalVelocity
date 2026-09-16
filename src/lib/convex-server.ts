import { ConvexHttpClient } from "convex/browser";
import { api } from "@convex/_generated/api";

// Node-safe client (works outside the browser) -- lets the BullMQ worker push GhostMode scan/niche-match
// progress into Convex for the wizard's live-updating UI. Optional: if CONVEX_URL isn't set, every call
// below is a no-op, so the app works identically without Convex configured (see src/lib/render/pipeline.ts-
// style graceful degradation used throughout this app for optional integrations).
let client: ConvexHttpClient | null = null;
const convex = () => (process.env.CONVEX_URL ? (client ??= new ConvexHttpClient(process.env.CONVEX_URL)) : null);

export async function pushGhostModeProgress(args: {
  jobId: string; workspaceId: string; status: string; step: string; pct: number; nicheMatch?: unknown; error?: string;
}) {
  // A Convex outage must never fail the real, Postgres-backed job it's mirroring -- fire-and-forget.
  try { await convex()?.mutation(api.ghostMode.upsertProgress, args); } catch (e) { console.error("[convex] pushGhostModeProgress failed:", e); }
}
