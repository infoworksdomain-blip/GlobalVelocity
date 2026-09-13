import { db, schema } from "@/db";
import { and, eq, gte, inArray } from "drizzle-orm";
import type { AutomationConfig } from "@/db/schema";

export type Slot = { socialAccountId: string; at: Date };

/** Build the slot plan for an automation over its horizon, honouring guardrails (FR-14.5): per-platform daily caps, spacing, existing posts. */
export async function planAutomation(a: { workspaceId: string; config: AutomationConfig }, timezone: string): Promise<{ slots: Slot[]; perAccount: Record<string, number> }> {
  const c = a.config;
  const socials = c.social_account_ids.length ? await db.select().from(schema.socialAccounts).where(and(eq(schema.socialAccounts.workspaceId, a.workspaceId), inArray(schema.socialAccounts.id, c.social_account_ids), eq(schema.socialAccounts.status, "active"))) : [];
  const existing = await db.select({ socialAccountId: schema.scheduledPosts.socialAccountId, at: schema.scheduledPosts.scheduledAt }).from(schema.scheduledPosts)
    .where(and(eq(schema.scheduledPosts.workspaceId, a.workspaceId), gte(schema.scheduledPosts.scheduledAt, new Date()), inArray(schema.scheduledPosts.status, ["scheduled", "pending_approval", "publishing"])));
  const platformCap: Record<string, number> = { tiktok: 10, instagram: 25, youtube: 6, linkedin: 10 };
  const slots: Slot[] = []; const perAccount: Record<string, number> = {};
  const times = c.times.length ? c.times : ["09:00", "13:00", "19:00"];
  const start = new Date(); start.setUTCHours(0, 0, 0, 0);
  for (let d = 0; d < c.horizon_days; d++) {
    const day = new Date(start.getTime() + d * 86_400_000);
    const weekday = day.getUTCDay(); if (c.weekdays.length && !c.weekdays.includes(weekday)) continue;
    for (const s of socials) {
      const cap = Math.min(c.posts_per_day, c.max_per_platform_per_day || platformCap[s.platform] || 10, platformCap[s.platform] ?? 10);
      const already = existing.filter((e) => e.socialAccountId === s.id && e.at.toISOString().slice(0, 10) === day.toISOString().slice(0, 10)).length;
      let n = 0;
      for (const t of times) {
        if (n + already >= cap) break;
        const at = localToUtc(day, t, timezone); if (at.getTime() < Date.now() + 10 * 60_000) continue;
        const tooClose = [...existing, ...slots.map((x) => ({ socialAccountId: x.socialAccountId, at: x.at }))].some((e) => e.socialAccountId === s.id && Math.abs(e.at.getTime() - at.getTime()) < (c.min_spacing_minutes || 60) * 60_000);
        if (tooClose) continue;
        slots.push({ socialAccountId: s.id, at }); n++; perAccount[s.id] = (perAccount[s.id] ?? 0) + 1;
      }
    }
  }
  return { slots, perAccount };
}

/** Convert a "HH:MM" wall-clock time on a given UTC date to a UTC instant in the given IANA timezone. */
export function localToUtc(dayUtc: Date, hhmm: string, timezone: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const guess = new Date(Date.UTC(dayUtc.getUTCFullYear(), dayUtc.getUTCMonth(), dayUtc.getUTCDate(), h, m));
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(guess);
    const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asLocal = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"));
    return new Date(guess.getTime() - (asLocal - guess.getTime()));
  } catch { return guess; }
}
