import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsertProgress = mutation({
  args: {
    jobId: v.string(), workspaceId: v.string(), status: v.string(), step: v.string(), pct: v.number(),
    nicheMatch: v.optional(v.any()), error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("ghostModeProgress").withIndex("by_job", (q) => q.eq("jobId", args.jobId)).unique();
    if (existing) await ctx.db.patch(existing._id, args);
    else await ctx.db.insert("ghostModeProgress", args);
  },
});

export const getByJobId = query({
  args: { jobId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.query("ghostModeProgress").withIndex("by_job", (q) => q.eq("jobId", args.jobId)).unique();
  },
});
