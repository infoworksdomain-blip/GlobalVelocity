import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Convex holds ONLY live progress for GhostMode's website-scan/niche-match wizard step. Postgres
 * (jobs.progress/jobs.result, then companyProfiles/automations) remains the single source of truth --
 * this table is a UI-facing mirror, never load-bearing. See src/lib/convex-server.ts.
 */
export default defineSchema({
  ghostModeProgress: defineTable({
    jobId: v.string(),
    workspaceId: v.string(),
    status: v.string(),
    step: v.string(),
    pct: v.number(),
    nicheMatch: v.optional(v.any()),
    error: v.optional(v.string()),
  }).index("by_job", ["jobId"]),
});
