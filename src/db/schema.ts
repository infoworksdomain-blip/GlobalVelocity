import {
  pgTable, uuid, text, timestamp, boolean, integer, bigint, jsonb, numeric, primaryKey, uniqueIndex, index, bigserial, date, customType,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

const vector = customType<{ data: number[]; driverData: string }>({
  dataType() { return "vector(1536)"; },
  toDriver(v) { return `[${v.join(",")}]`; },
  fromDriver(v) { return String(v).replace(/[\[\]]/g, "").split(",").filter(Boolean).map(Number); },
});
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const now = () => ts("created_at").notNull().defaultNow();

// ---------------- Auth.js tables ----------------
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: ts("email_verified"),
  image: text("image"),
  timezone: text("timezone").default("UTC").notNull(),
  notificationPrefs: jsonb("notification_prefs").$type<Record<string, boolean>>().default({}).notNull(),
  isPlatformAdmin: boolean("is_platform_admin").default(false).notNull(),
  createdAt: now(),
});
export const authAccounts = pgTable("auth_accounts", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").$type<AdapterAccountType>().notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"), access_token: text("access_token"), expires_at: integer("expires_at"),
  token_type: text("token_type"), scope: text("scope"), id_token: text("id_token"), session_state: text("session_state"),
}, (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]);
export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: ts("expires").notNull(),
});
export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(), token: text("token").notNull(), expires: ts("expires").notNull(),
}, (t) => [primaryKey({ columns: [t.identifier, t.token] })]);

// ---------------- Tenancy ----------------
export type Plan = "free" | "starter" | "growth" | "pro";
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => users.id),
  plan: text("plan").$type<Plan>().notNull().default("free"),
  billingInterval: text("billing_interval").$type<"month" | "year">(),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  planRenewsAt: ts("plan_renews_at"),
  graceUntil: ts("grace_until"),
  signupAttribution: jsonb("signup_attribution").$type<Record<string, string>>().default({}).notNull(),
  affiliateRef: text("affiliate_ref"),
  createdAt: now(), deletedAt: ts("deleted_at"),
});
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  name: text("name").notNull(), slug: text("slug").notNull(),
  timezone: text("timezone").default("UTC").notNull(),
  locked: boolean("locked").default(false).notNull(),
  createdAt: now(), deletedAt: ts("deleted_at"),
}, (t) => [uniqueIndex("ws_account_slug").on(t.accountId, t.slug)]);
export type WorkspaceRole = "admin" | "editor" | "viewer";
export const workspaceMembers = pgTable("workspace_members", {
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  role: text("role").$type<WorkspaceRole>().notNull(),
  invitedEmail: text("invited_email"), inviteToken: text("invite_token"), acceptedAt: ts("accepted_at"),
  id: uuid("id").defaultRandom().notNull(),
  createdAt: now(),
}, (t) => [primaryKey({ columns: [t.id] }), index("wm_ws").on(t.workspaceId)]);

// ---------------- Brand profile ----------------
export const companyProfiles = pgTable("company_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  isCurrent: boolean("is_current").notNull().default(true),
  websiteUrl: text("website_url").notNull(),
  data: jsonb("data").$type<CompanyProfileData>().notNull(),
  embedding: vector("embedding"),
  source: text("source").$type<"crawl" | "manual" | "edit">().notNull(),
  createdAt: now(),
});
export type CompanyProfileData = {
  product_name: string; website_url: string; tagline: string; one_line_description: string;
  category: "saas" | "mobile_app" | "ecommerce" | "service" | "other"; industry: string;
  target_audience: { segment: string; pain_points: string[]; desires: string[] }[];
  tone_of_voice: { adjectives: string[]; do: string[]; dont: string[] };
  key_features: string[]; differentiators: string[]; competitors: { name: string; url?: string }[];
  pricing_summary: string; call_to_action: string; app_store_links: { ios?: string; android?: string };
  brand: { logo_url?: string; primary_color?: string; secondary_color?: string; screenshots: string[] };
  hooks_seed: string[]; content_pillars: string[]; language: string; confidence: Record<string, number>;
};
export const brandAssets = pgTable("brand_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  kind: text("kind").$type<"logo" | "screenshot" | "demo_video" | "image" | "font" | "other">().notNull(),
  storageKey: text("storage_key").notNull(), mime: text("mime"), width: integer("width"), height: integer("height"), durationMs: integer("duration_ms"),
  createdAt: now(),
});

// ---------------- Libraries ----------------
export const characters = pgTable("characters", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerAccountId: uuid("owner_account_id").references(() => accounts.id),
  name: text("name").notNull(), gender: text("gender"), ageRange: text("age_range"),
  styleTags: text("style_tags").array().default([]).notNull(), settingTags: text("setting_tags").array().default([]).notNull(),
  language: text("language").default("en").notNull(),
  referenceImages: jsonb("reference_images").$type<string[]>().default([]).notNull(),
  sampleVideoUrl: text("sample_video_url"), voiceId: text("voice_id"),
  heygenTalkingPhotoId: text("heygen_talking_photo_id"),
  tier: text("tier").$type<Plan>().notNull().default("pro"),
  status: text("status").$type<"draft" | "published" | "retired">().notNull().default("published"),
  createdAt: now(),
});
export const ugcClipBatches = pgTable("ugc_clip_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdBy: uuid("created_by").references(() => users.id),
  requestedCount: integer("requested_count").default(0).notNull(),
  completedCount: integer("completed_count").default(0).notNull(),
  failedCount: integer("failed_count").default(0).notNull(),
  status: text("status").$type<"queued" | "running" | "done">().notNull().default("queued"),
  createdAt: now(), completedAt: ts("completed_at"),
});
export const ugcClips = pgTable("ugc_clips", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorName: text("creator_name"), gender: text("gender"), styleTags: text("style_tags").array().default([]).notNull(),
  category: text("category"),
  setting: text("setting"), durationMs: integer("duration_ms").notNull(), hasSpeech: boolean("has_speech").default(false).notNull(), transcript: text("transcript"),
  licenceType: text("licence_type").$type<"audio_replace" | "subtitle_only">().notNull(),
  territories: text("territories").array().default(["worldwide"]).notNull(), licenceExpiresAt: ts("licence_expires_at"),
  storageKey: text("storage_key").notNull(), thumbnailKey: text("thumbnail_key"),
  tier: text("tier").$type<Plan>().notNull().default("growth"),
  status: text("status").$type<"processing" | "published" | "failed" | "archived">().notNull().default("published"),
  ingestBatchId: uuid("ingest_batch_id").references(() => ugcClipBatches.id),
  createdAt: now(),
}, (t) => [
  index("ugc_status_tier").on(t.status, t.tier),
  index("ugc_category").on(t.category),
  index("ugc_created_at").on(t.createdAt),
  index("ugc_style_gin").using("gin", t.styleTags),
]);
export type Platform = "tiktok" | "instagram" | "youtube" | "linkedin";
export type TrendRecipe = { structure: { segment: string; seconds: number; text_slot?: string }[]; style: string; sound?: string; why_it_works?: string };
export const trends = pgTable("trends", {
  id: uuid("id").primaryKey().defaultRandom(),
  platform: text("platform").$type<Platform>().notNull(),
  externalPostId: text("external_post_id").notNull(), postUrl: text("post_url").notNull(), creatorHandle: text("creator_handle"),
  nicheTags: text("niche_tags").array().default([]).notNull(), formatType: text("format_type"), hookText: text("hook_text"),
  recipe: jsonb("recipe").$type<TrendRecipe>().notNull(),
  metrics: jsonb("metrics").$type<{ views: number; likes: number; comments: number; shares?: number; posted_at?: string }>().default({ views: 0, likes: 0, comments: 0 }).notNull(),
  velocityScore: numeric("velocity_score").default("0"),
  embedding: vector("embedding"),
  firstSeenAt: ts("first_seen_at").defaultNow().notNull(), metricsUpdatedAt: ts("metrics_updated_at"),
  status: text("status").notNull().default("active"),
}, (t) => [uniqueIndex("trend_platform_post").on(t.platform, t.externalPostId)]);
export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  format: text("format").notNull(), name: text("name").notNull(), spec: jsonb("spec").$type<Record<string, unknown>>().notNull(),
  previewKey: text("preview_key"), status: text("status").notNull().default("published"), createdAt: now(),
});
export const aiModels = pgTable("ai_models", {
  id: text("id").primaryKey(), provider: text("provider").notNull(),
  type: text("type").$type<"llm" | "image" | "video" | "tts" | "lipsync">().notNull(),
  displayName: text("display_name"), creditMultiplier: numeric("credit_multiplier").default("1"), minPlan: text("min_plan").$type<Plan>().default("free"),
  enabled: boolean("enabled").default(true).notNull(),
});

// ---------------- Content ----------------
export type ContentFormat = "ai_ugc" | "human_ugc" | "slideshow" | "hook_demo" | "meme" | "remix" | "upload";
export type ContentStatus = "generating" | "candidate" | "skipped" | "saved" | "draft" | "scheduled" | "published" | "failed" | "archived";
export type ContentMedia = { video_key?: string; image_keys?: string[]; thumbnail_key?: string; duration_ms?: number; width?: number; height?: number };
export type OverlayPosition = "top" | "center" | "bottom";
export type OverlayStyle = { font_family?: string; font_size_px?: number; bold?: boolean; color?: string; position?: OverlayPosition; background_opacity?: number };
export const generationBatches = pgTable("generation_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  profileId: uuid("profile_id").references(() => companyProfiles.id),
  requestedBy: uuid("requested_by"),
  source: text("source").$type<"blitz" | "studio" | "automation" | "api" | "similar">().notNull(),
  params: jsonb("params").$type<Record<string, unknown>>().default({}).notNull(),
  requestedCount: integer("requested_count").notNull(), completedCount: integer("completed_count").default(0).notNull(), failedCount: integer("failed_count").default(0).notNull(),
  status: text("status").notNull().default("queued"), createdAt: now(), completedAt: ts("completed_at"),
});
export const contentItems = pgTable("content_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  batchId: uuid("batch_id").references(() => generationBatches.id),
  format: text("format").$type<ContentFormat>().notNull(),
  status: text("status").$type<ContentStatus>().notNull().default("generating"),
  angle: text("angle"), hook: text("hook"), script: text("script"),
  onScreenText: jsonb("on_screen_text").$type<string[]>().default([]).notNull(),
  caption: text("caption"), hashtags: text("hashtags").array().default([]).notNull(),
  language: text("language").default("en").notNull(),
  characterId: uuid("character_id").references(() => characters.id), ugcClipId: uuid("ugc_clip_id").references(() => ugcClips.id),
  trendId: uuid("trend_id").references(() => trends.id), templateId: uuid("template_id").references(() => templates.id),
  media: jsonb("media").$type<ContentMedia>().default({}).notNull(),
  overlayStyle: jsonb("overlay_style").$type<OverlayStyle>(),
  provenance: jsonb("provenance").$type<Record<string, unknown>>().default({}).notNull(),
  predictedScore: numeric("predicted_score"),
  isAiGenerated: boolean("is_ai_generated").default(true).notNull(),
  moderation: jsonb("moderation").$type<{ status: "ok" | "blocked"; reasons?: string[] }>(),
  savedAt: ts("saved_at"), createdAt: now(), updatedAt: ts("updated_at").defaultNow().notNull(), deletedAt: ts("deleted_at"),
}, (t) => [index("ci_ws_status").on(t.workspaceId, t.status, t.createdAt)]);
export const contentVersions = pgTable("content_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentItemId: uuid("content_item_id").notNull().references(() => contentItems.id, { onDelete: "cascade" }),
  version: integer("version").notNull(), snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(), editedBy: uuid("edited_by"), createdAt: now(),
});
export const swipeEvents = pgTable("swipe_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  workspaceId: uuid("workspace_id").notNull(), userId: uuid("user_id").notNull(), contentItemId: uuid("content_item_id").notNull(),
  action: text("action").$type<"keep" | "skip" | "undo">().notNull(), createdAt: now(),
});

// ---------------- Socials & publishing ----------------
export const socialAccounts = pgTable("social_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  platform: text("platform").$type<Platform>().notNull(),
  externalId: text("external_id").notNull(), handle: text("handle"), displayName: text("display_name"), avatarUrl: text("avatar_url"),
  accountType: text("account_type"),
  accessTokenEnc: text("access_token_enc"), refreshTokenEnc: text("refresh_token_enc"), tokenExpiresAt: ts("token_expires_at"),
  scopes: text("scopes").array().default([]).notNull(),
  status: text("status").$type<"active" | "reconnect_needed" | "disabled">().notNull().default("active"),
  followers: integer("followers"),
  postingSlots: jsonb("posting_slots").$type<{ weekday: number; time: string }[]>().default([]).notNull(),
  createdAt: now(),
}, (t) => [uniqueIndex("sa_ws_platform_ext").on(t.workspaceId, t.platform, t.externalId)]);
export type PostStatus = "draft" | "pending_approval" | "scheduled" | "publishing" | "published" | "failed" | "cancelled" | "held";
export const scheduledPosts = pgTable("scheduled_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  contentItemId: uuid("content_item_id").notNull().references(() => contentItems.id),
  socialAccountId: uuid("social_account_id").notNull().references(() => socialAccounts.id),
  scheduledAt: ts("scheduled_at").notNull(), timezone: text("timezone").notNull(),
  recurrenceId: uuid("recurrence_id"), automationId: uuid("automation_id"),
  platformOptions: jsonb("platform_options").$type<Record<string, unknown>>().default({}).notNull(),
  captionOverride: text("caption_override"),
  status: text("status").$type<PostStatus>().notNull().default("scheduled"),
  attempts: integer("attempts").default(0).notNull(), lastError: text("last_error"),
  externalPostId: text("external_post_id"), permalink: text("permalink"), publishedAt: ts("published_at"),
  idempotencyKey: text("idempotency_key").unique(), trackedLinkId: uuid("tracked_link_id"),
  createdAt: now(), updatedAt: ts("updated_at").defaultNow().notNull(),
}, (t) => [index("sp_status_at").on(t.status, t.scheduledAt)]);
export const recurrences = pgTable("recurrences", {
  id: uuid("id").primaryKey().defaultRandom(), workspaceId: uuid("workspace_id").notNull(),
  rrule: text("rrule").notNull(), startsAt: ts("starts_at").notNull(), endsAt: ts("ends_at"), count: integer("count"), createdAt: now(),
});
export const postMetrics = pgTable("post_metrics", {
  scheduledPostId: uuid("scheduled_post_id").notNull().references(() => scheduledPosts.id, { onDelete: "cascade" }),
  capturedAt: ts("captured_at").notNull(),
  views: bigint("views", { mode: "number" }).default(0), likes: integer("likes").default(0), comments: integer("comments").default(0),
  shares: integer("shares").default(0), saves: integer("saves").default(0), avgWatchMs: integer("avg_watch_ms"), raw: jsonb("raw"),
}, (t) => [primaryKey({ columns: [t.scheduledPostId, t.capturedAt] })]);
export const accountMetrics = pgTable("account_metrics", {
  socialAccountId: uuid("social_account_id").notNull().references(() => socialAccounts.id, { onDelete: "cascade" }),
  capturedAt: date("captured_at").notNull(), followers: integer("followers"), views: bigint("views", { mode: "number" }), raw: jsonb("raw"),
}, (t) => [primaryKey({ columns: [t.socialAccountId, t.capturedAt] })]);

// ---------------- Automations ----------------
export type AutomationConfig = {
  social_account_ids: string[]; posts_per_day: number; horizon_days: number; times: string[]; weekdays: number[];
  format_mix: Partial<Record<ContentFormat, number>>; character_ids?: string[]; language?: string;
  ugc_style_tags?: string[]; ugc_categories?: string[];
  source: "generate" | "library" | "mixed"; min_spacing_minutes: number; max_per_platform_per_day: number;
};
export const automations = pgTable("automations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(), config: jsonb("config").$type<AutomationConfig>().notNull(),
  mode: text("mode").$type<"one_shot" | "continuous">().notNull(),
  approval: text("approval").$type<"auto" | "blitz" | "calendar">().notNull(),
  kind: text("kind").$type<"manual" | "ghost_mode">().notNull().default("manual"),
  status: text("status").notNull().default("active"), lastRunAt: ts("last_run_at"), nextRunAt: ts("next_run_at"), createdAt: now(),
});
export const automationRuns = pgTable("automation_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  automationId: uuid("automation_id").notNull().references(() => automations.id, { onDelete: "cascade" }),
  startedAt: ts("started_at").defaultNow().notNull(), finishedAt: ts("finished_at"),
  generated: integer("generated").default(0).notNull(), scheduled: integer("scheduled").default(0).notNull(), skipped: integer("skipped").default(0).notNull(),
  errors: jsonb("errors").$type<string[]>().default([]).notNull(), status: text("status").notNull().default("running"),
});

// ---------------- Attribution ----------------
export const trackingSites = pgTable("tracking_sites", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  domain: text("domain").notNull(), siteKey: text("site_key").notNull().unique(), verifiedAt: ts("verified_at"), retentionMonths: integer("retention_months").default(13).notNull(),
  createdAt: now(),
});
export const trackingEvents = pgTable("tracking_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  siteId: uuid("site_id").notNull().references(() => trackingSites.id, { onDelete: "cascade" }),
  occurredAt: ts("occurred_at").notNull(), sessionId: text("session_id"), event: text("event").notNull(),
  path: text("path"), referrer: text("referrer"), utm: jsonb("utm").$type<Record<string, string>>(), clickId: text("click_id"), trackedLinkId: uuid("tracked_link_id"),
  device: text("device"), country: text("country"), value: numeric("value"), currency: text("currency"), orderId: text("order_id"), props: jsonb("props"),
}, (t) => [index("te_site_at").on(t.siteId, t.occurredAt)]);
export const trackedLinks = pgTable("tracked_links", {
  id: uuid("id").primaryKey().defaultRandom(), workspaceId: uuid("workspace_id").notNull(),
  slug: text("slug").notNull().unique(), destinationUrl: text("destination_url").notNull(), scheduledPostId: uuid("scheduled_post_id"),
  clicks: integer("clicks").default(0).notNull(), createdAt: now(),
});

// ---------------- Billing & credits ----------------
export const creditLedger = pgTable("credit_ledger", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  delta: integer("delta").notNull(),
  reason: text("reason").$type<"allocation" | "purchase" | "image" | "video" | "refund" | "admin" | "expiry">().notNull(),
  refType: text("ref_type"), refId: text("ref_id"), expiresAt: ts("expires_at"), createdAt: now(),
}, (t) => [index("cl_account").on(t.accountId, t.createdAt)]);
export const usageCounters = pgTable("usage_counters", {
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  metric: text("metric").notNull(), periodStart: date("period_start").notNull(), value: integer("value").default(0).notNull(),
}, (t) => [primaryKey({ columns: [t.accountId, t.metric, t.periodStart] })]);

// ---------------- API, webhooks, audit, notifications, affiliates ----------------
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name"), prefix: text("prefix").notNull(), keyHash: text("key_hash").notNull(),
  workspaceIds: uuid("workspace_ids").array().default([]).notNull(), scopes: text("scopes").array().notNull(),
  lastUsedAt: ts("last_used_at"), revokedAt: ts("revoked_at"), createdAt: now(),
});
export const webhooks = pgTable("webhooks", {
  id: uuid("id").primaryKey().defaultRandom(), accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  url: text("url").notNull(), secret: text("secret").notNull(), events: text("events").array().notNull(), enabled: boolean("enabled").default(true).notNull(), createdAt: now(),
});
export const auditLog = pgTable("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  accountId: uuid("account_id"), workspaceId: uuid("workspace_id"), actorId: uuid("actor_id"), actorType: text("actor_type"),
  action: text("action").notNull(), targetType: text("target_type"), targetId: text("target_id"), meta: jsonb("meta"), createdAt: now(),
});
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), title: text("title"), body: text("body"), link: text("link"), readAt: ts("read_at"), createdAt: now(),
});
export const affiliates = pgTable("affiliates", {
  id: uuid("id").primaryKey().defaultRandom(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(), commissionPct: integer("commission_pct").default(30).notNull(), payoutEmail: text("payout_email"), createdAt: now(),
});
export const affiliateCommissions = pgTable("affiliate_commissions", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  affiliateId: uuid("affiliate_id").notNull().references(() => affiliates.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").notNull(), stripeInvoiceId: text("stripe_invoice_id").notNull().unique(),
  amountCents: integer("amount_cents").notNull(), commissionCents: integer("commission_cents").notNull(),
  status: text("status").$type<"pending" | "approved" | "paid">().notNull().default("pending"), createdAt: now(),
});
export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id"), type: text("type").notNull(),
  status: text("status").$type<"queued" | "running" | "done" | "failed">().notNull().default("queued"),
  progress: jsonb("progress").$type<{ step: string; pct: number }>().default({ step: "queued", pct: 0 }).notNull(),
  result: jsonb("result"), error: text("error"), createdAt: now(), updatedAt: ts("updated_at").defaultNow().notNull(),
});
