import { db, schema } from "@/db";
import { and, eq, isNull, sql as dsql, count } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { PLANS, tierRank } from "@/lib/plans";
import { err, planLimit } from "@/lib/errors";
import { sha256 } from "@/lib/crypto";
import { connection as redis } from "@/lib/queue";
import type { Plan, WorkspaceRole } from "@/db/schema";

const { accounts, workspaces, workspaceMembers, apiKeys, creditLedger, usageCounters, contentItems, socialAccounts, users } = schema;

export type Actor = {
  userId: string | null; accountId: string; plan: Plan; isPlatformAdmin: boolean;
  apiKey?: { id: string; scopes: string[]; workspaceIds: string[] };
};

export async function ensureAccountForUser(userId: string) {
  const existing = await db.query.accounts.findFirst({ where: eq(accounts.ownerUserId, userId) });
  if (existing) return existing;
  const [acc] = await db.insert(accounts).values({ ownerUserId: userId }).returning();
  const [ws] = await db.insert(workspaces).values({ accountId: acc.id, name: "My brand", slug: "default" }).returning();
  await db.insert(workspaceMembers).values({ workspaceId: ws.id, userId, role: "admin", acceptedAt: new Date() });
  await db.insert(creditLedger).values({ accountId: acc.id, delta: PLANS.free.limits.creditsMonthly, reason: "allocation", refType: "signup" });
  return acc;
}

/** Resolve the caller from a session cookie or an `Authorization: Bearer sk_...` API key. */
export async function getActor(req?: Request): Promise<Actor> {
  const header = req?.headers.get("authorization");
  if (header?.startsWith("Bearer sk_")) {
    const raw = header.slice(7);
    const key = await db.query.apiKeys.findFirst({ where: and(eq(apiKeys.keyHash, sha256(raw)), isNull(apiKeys.revokedAt)) });
    if (!key) throw err(401, "INVALID_API_KEY", "API key is invalid or revoked");
    const acc = await db.query.accounts.findFirst({ where: eq(accounts.id, key.accountId) });
    if (!acc) throw err(401, "INVALID_API_KEY", "Account not found");
    if (PLANS[acc.plan].limits.apiRpm === 0) throw planLimit("PLAN_API_ACCESS", "API access requires a paid plan");
    // per-plan rate limit (requests per minute) — FR-19.2
    const rlKey = `rl:${key.id}:${Math.floor(Date.now() / 60_000)}`;
    const n = await redis.incr(rlKey); if (n === 1) await redis.expire(rlKey, 65);
    if (n > PLANS[acc.plan].limits.apiRpm) throw err(429, "RATE_LIMITED", `Rate limit of ${PLANS[acc.plan].limits.apiRpm} requests/minute exceeded`, { retry_after: 60 - (Math.floor(Date.now() / 1000) % 60) });
    db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id)).catch(() => {});
    return { userId: null, accountId: acc.id, plan: acc.plan, isPlatformAdmin: false, apiKey: { id: key.id, scopes: key.scopes, workspaceIds: key.workspaceIds } };
  }
  const session = await auth();
  if (!session?.user?.id) throw err(401, "UNAUTHENTICATED", "Sign in required");
  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  const acc = await ensureAccountForUser(session.user.id);
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return { userId: session.user.id, accountId: acc.id, plan: acc.plan, isPlatformAdmin: !!user?.isPlatformAdmin || admins.includes(user?.email ?? "") };
}

export async function getActorOrNull(req?: Request) { try { return await getActor(req); } catch { return null; } }

const roleRank: Record<WorkspaceRole, number> = { viewer: 0, editor: 1, admin: 2 };

/** Verify the actor may access a workspace at the given role; returns workspace + owning account. */
export async function requireWorkspace(actor: Actor, workspaceId: string, minRole: WorkspaceRole = "viewer") {
  const ws = await db.query.workspaces.findFirst({ where: and(eq(workspaces.id, workspaceId), isNull(workspaces.deletedAt)) });
  if (!ws) throw err(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  if (actor.apiKey) {
    if (ws.accountId !== actor.accountId) throw err(403, "FORBIDDEN", "Key cannot access this workspace");
    if (actor.apiKey.workspaceIds.length && !actor.apiKey.workspaceIds.includes(ws.id)) throw err(403, "FORBIDDEN", "Key not scoped to this workspace");
    if (minRole !== "viewer" && !actor.apiKey.scopes.some((s) => s.endsWith(":write") || s === "publish")) throw err(403, "FORBIDDEN", "Key lacks write scope");
    return { ws, role: "editor" as WorkspaceRole, plan: actor.plan };
  }
  if (actor.isPlatformAdmin) return { ws, role: "admin" as WorkspaceRole, plan: actor.plan };
  const m = await db.query.workspaceMembers.findFirst({ where: and(eq(workspaceMembers.workspaceId, ws.id), eq(workspaceMembers.userId, actor.userId!)) });
  if (!m?.acceptedAt) throw err(403, "FORBIDDEN", "Not a member of this workspace");
  if (roleRank[m.role] < roleRank[minRole]) throw err(403, "FORBIDDEN", `Requires ${minRole} role`);
  if (ws.locked) throw planLimit("WORKSPACE_LOCKED", "This workspace is locked because it exceeds your plan's workspace limit");
  const acc = await db.query.accounts.findFirst({ where: eq(accounts.id, ws.accountId) });
  return { ws, role: m.role, plan: (acc?.plan ?? "free") as Plan };
}

export const limits = (plan: Plan) => PLANS[plan].limits;

// ---------- Entitlement checks (server-side; return 402 with machine-readable codes) ----------
export async function assertCanCreateWorkspace(accountId: string, plan: Plan) {
  const [{ n }] = await db.select({ n: count() }).from(workspaces).where(and(eq(workspaces.accountId, accountId), isNull(workspaces.deletedAt)));
  if (n >= limits(plan).workspaces) throw planLimit("PLAN_LIMIT_WORKSPACES", `Your plan allows ${limits(plan).workspaces} workspace(s)`);
}
export async function countSaves(accountId: string) {
  const [{ n }] = await db.select({ n: count() }).from(contentItems)
    .innerJoin(workspaces, eq(workspaces.id, contentItems.workspaceId))
    .where(and(eq(workspaces.accountId, accountId), isNull(contentItems.deletedAt), dsql`${contentItems.status} in ('saved','draft','scheduled','published')`));
  return n;
}
export async function assertCanSave(accountId: string, plan: Plan) {
  const max = limits(plan).saves; if (max === null) return;
  if ((await countSaves(accountId)) >= max) throw planLimit("PLAN_LIMIT_SAVES", `You've used all ${max} content saves on the ${PLANS[plan].name} plan`);
}
export async function assertCanConnectSocial(workspaceId: string, plan: Plan, platform: schema.Platform) {
  const l = limits(plan);
  if (!l.platforms.includes(platform)) throw planLimit("PLAN_PLATFORM", `Connecting ${platform} requires a paid plan`);
  if (l.socialsPerPlatform !== null) {
    const [{ n }] = await db.select({ n: count() }).from(socialAccounts).where(and(eq(socialAccounts.workspaceId, workspaceId), eq(socialAccounts.platform, platform)));
    if (n >= l.socialsPerPlatform) throw planLimit("PLAN_LIMIT_SOCIALS", `Your plan allows ${l.socialsPerPlatform} ${platform} account(s) per workspace`);
  }
}
export function assertScheduling(plan: Plan) { if (!limits(plan).scheduling) throw planLimit("PLAN_SCHEDULING", "Scheduling requires a paid plan"); }
export function assertTrendRemix(plan: Plan) { if (!limits(plan).trendRemix) throw planLimit("PLAN_TREND_REMIX", "Trend details and remixing require a paid plan"); }
export function canUseCharacterTier(plan: Plan, tier: Plan) { const ct = limits(plan).characterTier; return tierRank(ct) >= tierRank(tier); }

// ---------- Usage counters (daily / monthly) ----------
export async function bumpUsage(accountId: string, metric: string, by: number, period: "day" | "month", max?: number) {
  const d = new Date(); const periodStart = period === "day" ? d.toISOString().slice(0, 10) : d.toISOString().slice(0, 7) + "-01";
  const [row] = await db.insert(usageCounters).values({ accountId, metric, periodStart, value: by })
    .onConflictDoUpdate({ target: [usageCounters.accountId, usageCounters.metric, usageCounters.periodStart], set: { value: dsql`${usageCounters.value} + ${by}` } }).returning();
  if (max !== undefined && row.value > max) {
    await db.update(usageCounters).set({ value: dsql`${usageCounters.value} - ${by}` }).where(and(eq(usageCounters.accountId, accountId), eq(usageCounters.metric, metric), eq(usageCounters.periodStart, periodStart)));
    throw planLimit("PLAN_LIMIT_" + metric.toUpperCase(), `Daily limit of ${max} reached for ${metric.replace(/_/g, " ")}`);
  }
  return row.value;
}

// ---------- Credits ----------
export async function creditBalance(accountId: string) {
  const [{ s }] = await db.select({ s: dsql<number>`coalesce(sum(${creditLedger.delta}),0)::int` }).from(creditLedger).where(eq(creditLedger.accountId, accountId));
  return s;
}
export async function consumeCredits(accountId: string, amount: number, reason: "image" | "video", refType: string, refId: string) {
  if (amount <= 0) return;
  const bal = await creditBalance(accountId);
  if (bal < amount) throw planLimit("CREDITS_EXHAUSTED", `This needs ${amount} credits; you have ${bal}`);
  await db.insert(creditLedger).values({ accountId, delta: -amount, reason, refType, refId });
}
export async function refundCredits(accountId: string, amount: number, refType: string, refId: string) {
  if (amount > 0) await db.insert(creditLedger).values({ accountId, delta: amount, reason: "refund", refType, refId });
}
export async function audit(a: { accountId?: string; workspaceId?: string; actorId?: string | null; action: string; targetType?: string; targetId?: string; meta?: unknown }) {
  await db.insert(schema.auditLog).values({ accountId: a.accountId, workspaceId: a.workspaceId, actorId: a.actorId ?? undefined, actorType: a.actorId ? "user" : "system", action: a.action, targetType: a.targetType, targetId: a.targetId, meta: a.meta as never }).catch(() => {});
}
