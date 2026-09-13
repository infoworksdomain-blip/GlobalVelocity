import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { eq, desc, sql, count, and, isNull } from "drizzle-orm";
import { err } from "@/lib/errors";
import { applyPlan } from "@/lib/stripe";
import { z } from "zod";
/** Platform admin (M22): overview, user/plan/credit ops, moderation queue, publishing health, trend/character curation. */
export const GET = route(async ({ actor, url }) => {
  if (!actor.isPlatformAdmin) throw err(403, "FORBIDDEN", "Admin only");
  const view = url.searchParams.get("view") ?? "overview";
  if (view === "users") return { users: await db.select({ id: schema.users.id, email: schema.users.email, name: schema.users.name, createdAt: schema.users.createdAt, accountId: schema.accounts.id, plan: schema.accounts.plan, stripeCustomerId: schema.accounts.stripeCustomerId }).from(schema.users).leftJoin(schema.accounts, eq(schema.accounts.ownerUserId, schema.users.id)).orderBy(desc(schema.users.createdAt)).limit(200) };
  if (view === "moderation") return { items: await db.select().from(schema.contentItems).where(sql`${schema.contentItems.moderation}->>'status' = 'blocked'`).orderBy(desc(schema.contentItems.createdAt)).limit(100) };
  if (view === "publishing") return { failed: await db.select({ id: schema.scheduledPosts.id, status: schema.scheduledPosts.status, lastError: schema.scheduledPosts.lastError, platform: schema.socialAccounts.platform, scheduledAt: schema.scheduledPosts.scheduledAt }).from(schema.scheduledPosts).innerJoin(schema.socialAccounts, eq(schema.socialAccounts.id, schema.scheduledPosts.socialAccountId)).where(sql`${schema.scheduledPosts.status} in ('failed','held')`).orderBy(desc(schema.scheduledPosts.updatedAt)).limit(100), by_status: await db.select({ status: schema.scheduledPosts.status, n: count() }).from(schema.scheduledPosts).groupBy(schema.scheduledPosts.status) };
  if (view === "accounts") {
    const q = url.searchParams.get("q")?.trim();
    const rows = await db.select({
      accountId: schema.accounts.id, plan: schema.accounts.plan, interval: schema.accounts.billingInterval, renewsAt: schema.accounts.planRenewsAt, graceUntil: schema.accounts.graceUntil,
      suspendedAt: schema.accounts.deletedAt, stripeCustomerId: schema.accounts.stripeCustomerId, affiliateRef: schema.accounts.affiliateRef, createdAt: schema.accounts.createdAt,
      ownerId: schema.users.id, email: schema.users.email, name: schema.users.name,
      workspaces: sql<number>`(select count(*) from workspaces w where w.account_id = ${schema.accounts.id} and w.deleted_at is null)::int`,
      saves: sql<number>`(select count(*) from content_items ci join workspaces w on w.id = ci.workspace_id where w.account_id = ${schema.accounts.id} and ci.deleted_at is null and ci.status in ('saved','draft','scheduled','published'))::int`,
      credits: sql<number>`(select coalesce(sum(delta),0) from credit_ledger cl where cl.account_id = ${schema.accounts.id})::int`,
      socials: sql<number>`(select count(*) from social_accounts sa join workspaces w on w.id = sa.workspace_id where w.account_id = ${schema.accounts.id})::int`,
      published: sql<number>`(select count(*) from scheduled_posts sp join workspaces w on w.id = sp.workspace_id where w.account_id = ${schema.accounts.id} and sp.status = 'published')::int`,
      keys: sql<number>`(select count(*) from api_keys k where k.account_id = ${schema.accounts.id} and k.revoked_at is null)::int`,
      lastSeen: sql<string>`(select max(created_at) from audit_log al where al.account_id = ${schema.accounts.id})`,
    }).from(schema.accounts).innerJoin(schema.users, eq(schema.users.id, schema.accounts.ownerUserId))
      .where(q ? sql`(${schema.users.email} ilike ${"%" + q + "%"} or ${schema.users.name} ilike ${"%" + q + "%"} or ${schema.accounts.id}::text = ${q})` : undefined)
      .orderBy(desc(schema.accounts.createdAt)).limit(200);
    return { accounts: rows };
  }
  if (view === "keys") {
    const rows = await db.select({ id: schema.apiKeys.id, name: schema.apiKeys.name, prefix: schema.apiKeys.prefix, scopes: schema.apiKeys.scopes, lastUsedAt: schema.apiKeys.lastUsedAt, revokedAt: schema.apiKeys.revokedAt, createdAt: schema.apiKeys.createdAt, accountId: schema.apiKeys.accountId, email: schema.users.email, plan: schema.accounts.plan })
      .from(schema.apiKeys).innerJoin(schema.accounts, eq(schema.accounts.id, schema.apiKeys.accountId)).innerJoin(schema.users, eq(schema.users.id, schema.accounts.ownerUserId)).orderBy(desc(schema.apiKeys.createdAt)).limit(300);
    const hooks = await db.select({ id: schema.webhooks.id, url: schema.webhooks.url, events: schema.webhooks.events, enabled: schema.webhooks.enabled, createdAt: schema.webhooks.createdAt, email: schema.users.email, accountId: schema.webhooks.accountId })
      .from(schema.webhooks).innerJoin(schema.accounts, eq(schema.accounts.id, schema.webhooks.accountId)).innerJoin(schema.users, eq(schema.users.id, schema.accounts.ownerUserId)).orderBy(desc(schema.webhooks.createdAt)).limit(200);
    const socials = await db.select({ platform: schema.socialAccounts.platform, status: schema.socialAccounts.status, n: count() }).from(schema.socialAccounts).groupBy(schema.socialAccounts.platform, schema.socialAccounts.status);
    return { keys: rows, webhooks: hooks, socials, rpm: { free: 0, starter: 60, growth: 300, pro: 1000 } };
  }
  if (view === "integrations") {
    const env = (k: string) => !!process.env[k];
    return { mode: process.env.PROVIDER_MODE ?? "mock", integrations: [
      { key: "anthropic", name: "Anthropic (copy & profiles)", configured: env("ANTHROPIC_API_KEY"), envVars: ["ANTHROPIC_API_KEY"], docs: "https://docs.anthropic.com" },
      { key: "firecrawl", name: "Firecrawl (JS crawling fallback)", configured: env("FIRECRAWL_API_KEY"), envVars: ["FIRECRAWL_API_KEY"], docs: "https://firecrawl.dev" },
      { key: "elevenlabs", name: "ElevenLabs (voice)", configured: env("ELEVENLABS_API_KEY"), envVars: ["ELEVENLABS_API_KEY"], docs: "https://elevenlabs.io/docs" },
      { key: "video", name: "Talking-head video provider", configured: env("VIDEO_PROVIDER_URL"), envVars: ["VIDEO_PROVIDER_URL", "VIDEO_PROVIDER_KEY"], docs: "" },
      { key: "image", name: "Image generation (fal-compatible)", configured: env("IMAGE_PROVIDER_URL"), envVars: ["IMAGE_PROVIDER_URL", "IMAGE_PROVIDER_KEY"], docs: "https://fal.ai" },
      { key: "tiktok", name: "TikTok publishing", configured: env("TIKTOK_CLIENT_KEY"), envVars: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"], docs: "https://developers.tiktok.com" },
      { key: "meta", name: "Instagram Reels (Meta)", configured: env("META_APP_ID"), envVars: ["META_APP_ID", "META_APP_SECRET"], docs: "https://developers.facebook.com" },
      { key: "youtube", name: "YouTube Shorts (Google)", configured: env("GOOGLE_YT_CLIENT_ID"), envVars: ["GOOGLE_YT_CLIENT_ID", "GOOGLE_YT_CLIENT_SECRET"], docs: "https://console.cloud.google.com" },
      { key: "linkedin", name: "LinkedIn", configured: env("LINKEDIN_CLIENT_ID"), envVars: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"], docs: "https://www.linkedin.com/developers" },
      { key: "stripe", name: "Stripe billing", configured: env("STRIPE_SECRET_KEY"), envVars: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_*"], docs: "https://dashboard.stripe.com" },
      { key: "email", name: "Transactional email (Resend)", configured: env("RESEND_API_KEY"), envVars: ["RESEND_API_KEY", "EMAIL_FROM"], docs: "https://resend.com" },
      { key: "storage", name: `Storage (${process.env.STORAGE_DRIVER ?? "local"})`, configured: (process.env.STORAGE_DRIVER ?? "local") === "local" || env("S3_BUCKET"), envVars: ["STORAGE_DRIVER", "S3_*"], docs: "" },
      { key: "tokens", name: "Token encryption key", configured: env("TOKEN_ENCRYPTION_KEY"), envVars: ["TOKEN_ENCRYPTION_KEY"], docs: "" },
    ] };
  }
  if (view === "affiliates") return { commissions: await db.select({ id: schema.affiliateCommissions.id, status: schema.affiliateCommissions.status, amountCents: schema.affiliateCommissions.amountCents, commissionCents: schema.affiliateCommissions.commissionCents, createdAt: schema.affiliateCommissions.createdAt, code: schema.affiliates.code, payoutEmail: schema.affiliates.payoutEmail }).from(schema.affiliateCommissions).innerJoin(schema.affiliates, eq(schema.affiliates.id, schema.affiliateCommissions.affiliateId)).orderBy(desc(schema.affiliateCommissions.createdAt)).limit(300), payable: await db.select({ affiliateId: schema.affiliateCommissions.affiliateId, code: schema.affiliates.code, payoutEmail: schema.affiliates.payoutEmail, approvedCents: sql<number>`sum(commission_cents)::int` }).from(schema.affiliateCommissions).innerJoin(schema.affiliates, eq(schema.affiliates.id, schema.affiliateCommissions.affiliateId)).where(eq(schema.affiliateCommissions.status, "approved")).groupBy(schema.affiliateCommissions.affiliateId, schema.affiliates.code, schema.affiliates.payoutEmail) };
  if (view === "costs") {
    // Estimated unit costs (USD) — tune to your contracts. Credits map to provider spend; renders map to CPU minutes.
    const unit = { llm_call: 0.01, image: 0.04, video_second: 0.08, render_cpu_min: 0.002, storage_gb_month: 0.02 };
    const days = await db.execute(sql`select to_char(d, 'YYYY-MM-DD') as day,
        (select count(*) from content_items ci where ci.created_at::date = d) as items,
        (select count(*) from content_items ci where ci.created_at::date = d and ci.format = 'ai_ugc') as ai_ugc,
        (select coalesce(-sum(delta),0) from credit_ledger cl where cl.created_at::date = d and reason in ('image','video')) as credits,
        (select count(*) from scheduled_posts sp where sp.published_at::date = d) as published,
        (select count(*) from jobs j where j.created_at::date = d and j.type = 'profile.analyze') as analyses
      from generate_series(current_date - 29, current_date, '1 day') d order by d`);
    const rows = (days as unknown as { day: string; items: string; ai_ugc: string; credits: string; published: string; analyses: string }[]).map((r) => { const items = Number(r.items), aiugc = Number(r.ai_ugc), credits = Number(r.credits), analyses = Number(r.analyses); const llm = items * 2 + analyses; const est = llm * unit.llm_call + credits * 0.01 + items * 0.5 * unit.render_cpu_min; return { day: r.day, items, ai_ugc: aiugc, credits, published: Number(r.published), analyses, llm_calls: llm, est_cost_usd: Math.round(est * 100) / 100 }; });
    return { unit, days: rows, total_est_usd: Math.round(rows.reduce((a, r) => a + r.est_cost_usd, 0) * 100) / 100 };
  }
  if (view === "audit") return { audit: await db.select().from(schema.auditLog).orderBy(desc(schema.auditLog.createdAt)).limit(200) };
  const [[u], [plans], [items], [posts], [cred]] = await Promise.all([
    db.select({ n: count() }).from(schema.users), db.select({ free: sql<number>`count(*) filter (where plan='free')::int`, starter: sql<number>`count(*) filter (where plan='starter')::int`, growth: sql<number>`count(*) filter (where plan='growth')::int`, pro: sql<number>`count(*) filter (where plan='pro')::int` }).from(schema.accounts),
    db.select({ n: count(), today: sql<number>`count(*) filter (where created_at > now() - interval '1 day')::int` }).from(schema.contentItems), db.select({ n: count(), published: sql<number>`count(*) filter (where status='published')::int`, failed: sql<number>`count(*) filter (where status='failed')::int` }).from(schema.scheduledPosts),
    db.select({ used: sql<number>`coalesce(-sum(delta) filter (where reason in ('image','video')),0)::int` }).from(schema.creditLedger),
  ]);
  return { users: u.n, plans, content: items, posts, credits_used: cred.used, mode: process.env.PROVIDER_MODE ?? "mock" };
});
export const POST = route(async ({ actor, body }) => {
  if (!actor.isPlatformAdmin) throw err(403, "FORBIDDEN", "Admin only");
  const b = parse(z.object({ action: z.enum(["set_plan", "grant_credits", "unblock_item", "retire_trend", "set_character_status", "mark_paid", "suspend_account", "restore_account", "revoke_key", "revoke_all_keys", "toggle_webhook", "reset_usage"]), affiliate_id: z.string().uuid().optional(), key_id: z.string().uuid().optional(), webhook_id: z.string().uuid().optional(), enabled: z.boolean().optional(), account_id: z.string().uuid().optional(), plan: z.enum(["free", "starter", "growth", "pro"]).optional(), credits: z.number().int().optional(), item_id: z.string().uuid().optional(), trend_id: z.string().uuid().optional(), character_id: z.string().uuid().optional(), status: z.string().optional() }), body);
  if (b.action === "set_plan" && b.account_id && b.plan) await applyPlan(b.account_id, b.plan, "month", null, new Date(Date.now() + 30 * 86.4e6));
  if (b.action === "grant_credits" && b.account_id && b.credits) await db.insert(schema.creditLedger).values({ accountId: b.account_id, delta: b.credits, reason: "admin", refType: "admin", refId: actor.userId ?? "admin" });
  if (b.action === "unblock_item" && b.item_id) await db.update(schema.contentItems).set({ moderation: { status: "ok" }, status: "candidate" }).where(eq(schema.contentItems.id, b.item_id));
  if (b.action === "retire_trend" && b.trend_id) await db.update(schema.trends).set({ status: "retired" }).where(eq(schema.trends.id, b.trend_id));
  if (b.action === "suspend_account" && b.account_id) await db.update(schema.accounts).set({ deletedAt: new Date() }).where(eq(schema.accounts.id, b.account_id));
  if (b.action === "restore_account" && b.account_id) await db.update(schema.accounts).set({ deletedAt: null }).where(eq(schema.accounts.id, b.account_id));
  if (b.action === "revoke_key" && b.key_id) await db.update(schema.apiKeys).set({ revokedAt: new Date() }).where(eq(schema.apiKeys.id, b.key_id));
  if (b.action === "revoke_all_keys" && b.account_id) await db.update(schema.apiKeys).set({ revokedAt: new Date() }).where(and(eq(schema.apiKeys.accountId, b.account_id), isNull(schema.apiKeys.revokedAt)));
  if (b.action === "toggle_webhook" && b.webhook_id) await db.update(schema.webhooks).set({ enabled: b.enabled ?? false }).where(eq(schema.webhooks.id, b.webhook_id));
  if (b.action === "reset_usage" && b.account_id) await db.delete(schema.usageCounters).where(eq(schema.usageCounters.accountId, b.account_id));
  if (b.action === "mark_paid" && b.affiliate_id) await db.update(schema.affiliateCommissions).set({ status: "paid" }).where(and(eq(schema.affiliateCommissions.affiliateId, b.affiliate_id), eq(schema.affiliateCommissions.status, "approved")));
  if (b.action === "set_character_status" && b.character_id && b.status) await db.update(schema.characters).set({ status: b.status as "draft" | "published" | "retired" }).where(eq(schema.characters.id, b.character_id));
  await db.insert(schema.auditLog).values({ actorId: actor.userId, actorType: "admin", action: `admin.${b.action}`, meta: b });
  return { ok: true };
});
