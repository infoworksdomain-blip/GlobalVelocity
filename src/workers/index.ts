import "dotenv/config";
import { Worker, type Job } from "bullmq";
import { connection, coreQueue, renderQueue, enqueue } from "@/lib/queue";
import { renderMedia, fetchBuf } from "@/lib/render/pipeline";
import { thumbnail, store, probeDuration } from "@/lib/render";
import { sendEmail } from "@/lib/email";
import { emitEvent, deliver } from "@/lib/webhooks";
import { db, schema } from "@/db";
import { and, eq, lte, sql, desc, inArray, gte, isNull } from "drizzle-orm";
import { crawlSite } from "@/lib/crawler";
import { analyzeProfile, profileEmbedding, generateAngles, generateCopy, predictedScore } from "@/lib/generation";
import { moderateText } from "@/lib/llm";
import { publicUrl } from "@/lib/storage";
import { getPublisher } from "@/lib/publishers";
import { decrypt, encrypt } from "@/lib/crypto";
import { canUseCharacterTier, assertCanSave } from "@/lib/tenancy";
import { PLANS, PLAN_ORDER, tierRank } from "@/lib/plans";
import { planAutomation } from "@/lib/automations";
import type { ContentFormat, Plan } from "@/db/schema";

const { jobs, companyProfiles, workspaces, accounts, generationBatches, contentItems, characters, trends, scheduledPosts, socialAccounts, postMetrics, automations, automationRuns, notifications, workspaceMembers, brandAssets, ugcClips, ugcClipBatches, users } = schema;

async function setJob(id: string, patch: Partial<typeof jobs.$inferInsert>) { await db.update(jobs).set({ ...patch, updatedAt: new Date() }).where(eq(jobs.id, id)); }
async function notify(workspaceId: string, type: string, title: string, body: string, link?: string) {
  const members = await db.select({ userId: workspaceMembers.userId }).from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId));
  for (const m of members) if (m.userId) await db.insert(notifications).values({ userId: m.userId, type, title, body, link });
}

// ---------------- profile.analyze ----------------
async function profileAnalyze(job: Job<{ jobId: string; workspaceId: string; url: string }>) {
  const { jobId, workspaceId, url } = job.data;
  await setJob(jobId, { status: "running", progress: { step: "Reading your site", pct: 10 } });
  const crawl = await crawlSite(url);
  await setJob(jobId, { progress: { step: "Understanding your audience", pct: 50 } });
  const data = await analyzeProfile(crawl);
  await setJob(jobId, { progress: { step: "Finding your angles", pct: 80 } });
  await db.update(companyProfiles).set({ isCurrent: false }).where(eq(companyProfiles.workspaceId, workspaceId));
  const [{ v }] = await db.select({ v: sql<number>`coalesce(max(version),0)::int` }).from(companyProfiles).where(eq(companyProfiles.workspaceId, workspaceId));
  const [p] = await db.insert(companyProfiles).values({ workspaceId, version: v + 1, isCurrent: true, websiteUrl: crawl.url, data, embedding: profileEmbedding(data), source: "crawl" }).returning();
  if (data.product_name) await db.update(workspaces).set({ name: data.product_name }).where(eq(workspaces.id, workspaceId));
  await setJob(jobId, { status: "done", progress: { step: "Done", pct: 100 }, result: { profileId: p.id } });
  // Kick off the first Blitz batch immediately (FR-3 flow step 6)
  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) });
  const acc = ws && await db.query.accounts.findFirst({ where: eq(accounts.id, ws.accountId) });
  const count = Math.min(30, PLANS[(acc?.plan ?? "free") as Plan].limits.candidatesPerDay);
  const [b] = await db.insert(generationBatches).values({ workspaceId, profileId: p.id, source: "blitz", requestedCount: count, params: {} }).returning();
  await enqueue("generate.batch", { batchId: b.id });
}

// ---------------- generate.batch ----------------
const DEFAULT_MIX: Record<ContentFormat, number> = { ai_ugc: 0.35, slideshow: 0.3, hook_demo: 0.15, meme: 0.1, remix: 0.1, human_ugc: 0, upload: 0 };
async function generateBatch(job: Job<{ batchId: string }>) {
  const batch = await db.query.generationBatches.findFirst({ where: eq(generationBatches.id, job.data.batchId) });
  if (!batch) return;
  const profile = batch.profileId ? await db.query.companyProfiles.findFirst({ where: eq(companyProfiles.id, batch.profileId) }) : await db.query.companyProfiles.findFirst({ where: and(eq(companyProfiles.workspaceId, batch.workspaceId), eq(companyProfiles.isCurrent, true)) });
  if (!profile) { await db.update(generationBatches).set({ status: "failed" }).where(eq(generationBatches.id, batch.id)); return; }
  const ws = (await db.query.workspaces.findFirst({ where: eq(workspaces.id, batch.workspaceId) }))!;
  const acc = (await db.query.accounts.findFirst({ where: eq(accounts.id, ws.accountId) }))!;
  const params = batch.params as { formats?: ContentFormat[]; character_ids?: string[]; trend_ids?: string[]; language?: string; similar_to?: string; angle_hints?: string[]; ugc_categories?: string[]; ugc_style_tags?: string[] };
  await db.update(generationBatches).set({ status: "running" }).where(eq(generationBatches.id, batch.id));

  const recent = await db.select({ angle: contentItems.angle }).from(contentItems).where(eq(contentItems.workspaceId, batch.workspaceId)).orderBy(desc(contentItems.createdAt)).limit(60);
  const angles = await generateAngles(profile.data, batch.requestedCount, recent.map((r) => r.angle ?? "").filter(Boolean));
  const mix = params.formats?.length ? Object.fromEntries(params.formats.map((f) => [f, 1 / params.formats!.length])) as Record<string, number> : DEFAULT_MIX;
  const formats = Object.entries(mix).filter(([, w]) => w > 0);
  const pool = await db.select().from(characters).where(and(eq(characters.status, "published"), params.character_ids?.length ? inArray(characters.id, params.character_ids) : sql`(${characters.ownerAccountId} is null or ${characters.ownerAccountId} = ${acc.id})`));
  const usable = pool.filter((c) => c.ownerAccountId === acc.id || canUseCharacterTier(acc.plan, c.tier));
  const trendRows = params.trend_ids?.length ? await db.select().from(trends).where(inArray(trends.id, params.trend_ids)) : await db.select().from(trends).where(eq(trends.status, "active")).orderBy(desc(trends.velocityScore)).limit(20);
  const ugcQuota = PLANS[acc.plan].limits.ugcClipsMonthly; let ugcUsed = 0;
  // Only touch ugc_clips (can be a 25k-row table) when human_ugc is actually part of this batch's mix.
  const allowedTiers = PLAN_ORDER.filter((t) => tierRank(PLANS[acc.plan].limits.characterTier) >= tierRank(t));
  const clips = mix.human_ugc > 0 && allowedTiers.length
    ? await db.select().from(ugcClips).where(and(
        eq(ugcClips.status, "published"), inArray(ugcClips.tier, allowedTiers),
        sql`(${ugcClips.licenceExpiresAt} is null or ${ugcClips.licenceExpiresAt} > now())`,
        params.ugc_categories?.length ? inArray(ugcClips.category, params.ugc_categories) : undefined,
        params.ugc_style_tags?.length ? sql`${ugcClips.styleTags} && array[${sql.join(params.ugc_style_tags.map((t) => sql`${t}`), sql.raw(","))}]::text[]` : undefined,
      )).orderBy(sql`random()`).limit(batch.requestedCount * 3)
    : [];

  let acc_w = 0; const cumulative = formats.map(([f, w]) => [f, (acc_w += w)] as [string, number]);
  const pick = (i: number): ContentFormat => { const r = ((i * 0.618033) % 1) * acc_w; return (cumulative.find(([, c]) => r <= c)?.[0] ?? "slideshow") as ContentFormat; };
  for (let i = 0; i < angles.length; i++) {
    let format = pick(i);
    const clip = format === "human_ugc" && clips.length && ugcUsed < ugcQuota ? clips[i % clips.length] : null;
    if (format === "human_ugc" && !clip) format = "ai_ugc"; // graceful fallback when no licensed clips / quota
    if (clip) ugcUsed++;
    const character = format === "ai_ugc" && usable.length ? usable[i % usable.length] : null;
    const trend = format === "remix" && trendRows.length ? trendRows[i % trendRows.length] : null;
    const [item] = await db.insert(contentItems).values({ workspaceId: batch.workspaceId, batchId: batch.id, format, status: "generating", angle: angles[i].angle, characterId: character?.id, trendId: trend?.id, ugcClipId: clip?.id, language: params.language ?? profile.data.language, provenance: { angle_type: angles[i].type, profile_version: profile.version, similar_to: params.similar_to } }).returning();
    await enqueue("generate.item", { itemId: item.id, angle: angles[i] }, { attempts: 3, priority: batch.source === "automation" ? 5 : 10 });
  }
}

// ---------------- generate.item / render.item ----------------
async function buildRenderCtx(item: typeof contentItems.$inferSelect) {
  const ws = (await db.query.workspaces.findFirst({ where: eq(workspaces.id, item.workspaceId) }))!;
  const acc = (await db.query.accounts.findFirst({ where: eq(accounts.id, ws.accountId) }))!;
  const profile = (await db.query.companyProfiles.findFirst({ where: and(eq(companyProfiles.workspaceId, item.workspaceId), eq(companyProfiles.isCurrent, true)) }))!;
  const trend = item.trendId ? await db.query.trends.findFirst({ where: eq(trends.id, item.trendId) }) : null;
  const character = item.characterId ? await db.query.characters.findFirst({ where: eq(characters.id, item.characterId) }) : null;
  const clip = item.ugcClipId ? await db.query.ugcClips.findFirst({ where: eq(ugcClips.id, item.ugcClipId) }) : null;
  const assets = await db.select().from(brandAssets).where(eq(brandAssets.workspaceId, item.workspaceId));
  const shot = assets.find((a) => a.kind === "screenshot" || a.kind === "image");
  const demo = assets.find((a) => a.kind === "demo_video");
  const screenshot = shot ? await fetchBuf(publicUrl(shot.storageKey)) : await fetchBuf(profile.data.brand.screenshots[0]);
  const demoVideo = demo ? await fetchBuf(publicUrl(demo.storageKey)) : null;
  return { acc, profile, trend, ctx: { prepaid: (item.provenance as { studio?: string }).studio === "video", requestedSeconds: (item.provenance as { requested_seconds?: number }).requested_seconds, itemId: item.id, workspaceId: item.workspaceId, accountId: acc.id, format: item.format, profile: profile.data, screenshot, demoVideo, character: character ? { id: character.id, name: character.name, referenceImages: character.referenceImages.map((k) => (k.startsWith("data:") || k.startsWith("http") ? k : publicUrl(k)!)), voiceId: character.voiceId } : null, clip: clip ? { storageKey: clip.storageKey, licenceType: clip.licenceType, durationMs: clip.durationMs } : null, trend: trend?.recipe ?? null, overlayStyle: item.overlayStyle ?? null } };
}
async function generateItem(job: Job<{ itemId: string; angle: { type: string; angle: string } }>) {
  const item = await db.query.contentItems.findFirst({ where: eq(contentItems.id, job.data.itemId) });
  if (!item || item.status !== "generating") return;
  const fail = async (e: unknown) => {
    await db.update(contentItems).set({ status: "failed", provenance: { ...item.provenance, error: String(e) }, updatedAt: new Date() }).where(eq(contentItems.id, item.id));
    if (item.batchId) await db.update(generationBatches).set({ failedCount: sql`${generationBatches.failedCount} + 1` }).where(eq(generationBatches.id, item.batchId));
    throw e;
  };
  try {
    const { profile, trend, ctx } = await buildRenderCtx(item);
    const copy = await generateCopy(profile.data, job.data.angle, item.format, { language: item.language, trend: trend?.recipe });
    const mod = moderateText(copy.hook, copy.script, copy.caption, copy.meme_top, copy.meme_bottom);
    if (mod.status === "blocked") { await db.update(contentItems).set({ status: "archived", moderation: mod, hook: copy.hook }).where(eq(contentItems.id, item.id)); return; }
    const { media, creditsUsed } = await renderMedia(ctx, copy);
    await db.update(contentItems).set({
      status: "candidate", hook: copy.hook, script: copy.script, onScreenText: copy.on_screen_text, caption: copy.caption, hashtags: copy.hashtags, media, moderation: mod,
      predictedScore: String(predictedScore(item.format, trend ? Number(trend.velocityScore ?? 0) : null, 0.5)),
      provenance: { ...item.provenance, prompt_template: "v1", llm: process.env.PROVIDER_MODE === "live" ? process.env.ANTHROPIC_MODEL : "mock", credits_consumed: creditsUsed, trend_id: item.trendId, character_id: item.characterId, slides: copy.slides, meme: copy.meme_top ? { top: copy.meme_top, bottom: copy.meme_bottom } : undefined }, updatedAt: new Date(),
    }).where(eq(contentItems.id, item.id));
    if (item.batchId) {
      const [b] = await db.update(generationBatches).set({ completedCount: sql`${generationBatches.completedCount} + 1` }).where(eq(generationBatches.id, item.batchId)).returning();
      if (b.completedCount + b.failedCount >= b.requestedCount) { await db.update(generationBatches).set({ status: "done", completedAt: new Date() }).where(eq(generationBatches.id, b.id)); const w = await db.query.workspaces.findFirst({ where: eq(workspaces.id, b.workspaceId) }); if (w) await emitEvent(w.accountId, "batch.completed", { batch_id: b.id, workspace_id: b.workspaceId, completed: b.completedCount, failed: b.failedCount }); }
    }
  } catch (e) { await fail(e); }
}
/** Re-render an existing item's media from its (possibly edited) copy — Studio "Re-render" (FR-10.1). */
async function renderItem(job: Job<{ itemId: string; jobId?: string; finalStatus?: "saved" | "candidate" }>) {
  const item = await db.query.contentItems.findFirst({ where: eq(contentItems.id, job.data.itemId) }); if (!item) return;
  const setJ = (patch: Partial<typeof jobs.$inferInsert>) => (job.data.jobId ? setJob(job.data.jobId, patch) : Promise.resolve());
  try {
    await setJ({ status: "running", progress: { step: "Rendering", pct: 20 } });
    const { ctx } = await buildRenderCtx(item);
    const prov = item.provenance as { slides?: { title: string; body: string }[]; meme?: { top: string; bottom: string } };
    const copy = { hook: item.hook ?? "", script: item.script ?? "", on_screen_text: item.onScreenText, caption: item.caption ?? "", hashtags: item.hashtags, slides: prov.slides, meme_top: prov.meme?.top, meme_bottom: prov.meme?.bottom };
    const { media, creditsUsed } = await renderMedia(ctx, copy);
    await db.update(contentItems).set({ media, status: job.data.finalStatus ?? item.status, savedAt: job.data.finalStatus === "saved" ? new Date() : item.savedAt, provenance: { ...item.provenance, rerendered_at: new Date().toISOString(), credits_consumed: Number((item.provenance as { credits_consumed?: number }).credits_consumed ?? 0) + creditsUsed }, updatedAt: new Date() }).where(eq(contentItems.id, item.id));
    await setJ({ status: "done", progress: { step: "Done", pct: 100 }, result: { itemId: item.id } });
  } catch (e) {
    await setJ({ status: "failed", error: String(e).slice(0, 500) });
    if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1) && (item.provenance as { studio?: string }).studio === "video") { // final failure of a Studio video: refund up-front credits
      const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, item.workspaceId) }); const paid = Number((item.provenance as { credits_consumed?: number }).credits_consumed ?? 0);
      if (ws && paid) await db.insert(schema.creditLedger).values({ accountId: ws.accountId, delta: paid, reason: "refund", refType: "studio", refId: item.id });
      await db.update(contentItems).set({ status: "failed" }).where(eq(contentItems.id, item.id));
    }
    throw e;
  }
}

// ---------------- publish.dispatch / publish.post ----------------
async function publishDispatch() {
  // Recover posts left in "publishing" by a worker crash/restart (BullMQ stalled jobs are re-queued, but be defensive)
  await db.update(scheduledPosts).set({ status: "scheduled", updatedAt: new Date() }).where(and(eq(scheduledPosts.status, "publishing"), lte(scheduledPosts.updatedAt, new Date(Date.now() - 15 * 60_000))));
  const due = await db.select({ id: scheduledPosts.id }).from(scheduledPosts).where(and(eq(scheduledPosts.status, "scheduled"), lte(scheduledPosts.scheduledAt, new Date(Date.now() + 60_000)))).limit(200);
  for (const p of due) {
    await db.update(scheduledPosts).set({ status: "publishing", updatedAt: new Date() }).where(and(eq(scheduledPosts.id, p.id), eq(scheduledPosts.status, "scheduled")));
    await enqueue("publish.post", { postId: p.id }, { jobId: `publish-${p.id}-${Date.now()}`, attempts: 3, backoff: { type: "exponential", delay: 120_000 } });
  }
}
async function publishPost(job: Job<{ postId: string }>) {
  const post = await db.query.scheduledPosts.findFirst({ where: eq(scheduledPosts.id, job.data.postId) });
  if (!post || !["publishing", "scheduled"].includes(post.status)) return;
  const [item, social] = await Promise.all([db.query.contentItems.findFirst({ where: eq(contentItems.id, post.contentItemId) }), db.query.socialAccounts.findFirst({ where: eq(socialAccounts.id, post.socialAccountId) })]);
  if (!item || !social) { await db.update(scheduledPosts).set({ status: "failed", lastError: "content or account missing" }).where(eq(scheduledPosts.id, post.id)); return; }
  if (social.status !== "active") { await db.update(scheduledPosts).set({ status: "held", lastError: "Account needs reconnecting" }).where(eq(scheduledPosts.id, post.id)); return; }
  const pub = getPublisher(social.platform);
  const caption = post.captionOverride ?? item.caption ?? item.hook ?? "";
  const input = {
    platform: social.platform, accessToken: social.accessTokenEnc ? decrypt(social.accessTokenEnc) : "", externalId: social.externalId, accountType: social.accountType,
    mediaUrl: publicUrl(item.media.video_key ?? item.media.image_keys?.[0]) ?? "", mediaType: (item.media.video_key ? "video" : "images") as "video" | "images",
    imageUrls: item.media.image_keys?.map((k) => publicUrl(k)!) ?? [], thumbnailUrl: publicUrl(item.media.thumbnail_key), caption, title: item.hook ?? undefined, hashtags: item.hashtags, options: post.platformOptions, isAiGenerated: item.isAiGenerated,
  };
  try {
    const res = await pub.publish(input);
    await db.update(scheduledPosts).set({ status: "published", externalPostId: res.externalPostId, permalink: res.permalink ?? null, publishedAt: new Date(), attempts: post.attempts + 1, updatedAt: new Date() }).where(eq(scheduledPosts.id, post.id));
    await db.update(contentItems).set({ status: "published", updatedAt: new Date() }).where(eq(contentItems.id, item.id));
    await notify(post.workspaceId, "post.published", "Post published", `${item.hook ?? "Your post"} is live on ${social.platform}`, res.permalink ?? "/app/calendar");
    { const w = await db.query.workspaces.findFirst({ where: eq(workspaces.id, post.workspaceId) }); if (w) await emitEvent(w.accountId, "post.published", { post_id: post.id, content_item_id: item.id, platform: social.platform, permalink: res.permalink, external_post_id: res.externalPostId }); }
    await enqueue("metrics.pull", { postId: post.id }, { delay: Number(process.env.METRICS_FIRST_PULL_DELAY_MS ?? 3_600_000) });
  } catch (e) {
    const attempts = post.attempts + 1; const final = attempts >= 3;
    await db.update(scheduledPosts).set({ status: final ? "failed" : "scheduled", attempts, lastError: String(e).slice(0, 500), scheduledAt: final ? post.scheduledAt : new Date(Date.now() + 5 * 60_000), updatedAt: new Date() }).where(eq(scheduledPosts.id, post.id));
    if (final) { await notify(post.workspaceId, "post.failed", "Post failed", `${social.platform}: ${String(e).slice(0, 140)}`, "/app/calendar"); const w = await db.query.workspaces.findFirst({ where: eq(workspaces.id, post.workspaceId) }); if (w) await emitEvent(w.accountId, "post.failed", { post_id: post.id, platform: social.platform, error: String(e).slice(0, 300) }); }
    else throw e;
  }
}

// ---------------- metrics.pull ----------------
async function metricsPull(job: Job<{ postId: string }>) {
  const post = await db.query.scheduledPosts.findFirst({ where: eq(scheduledPosts.id, job.data.postId) });
  if (!post?.externalPostId || post.status !== "published") return;
  const social = (await db.query.socialAccounts.findFirst({ where: eq(socialAccounts.id, post.socialAccountId) }))!;
  const m = await getPublisher(social.platform).metrics(social.accessTokenEnc ? decrypt(social.accessTokenEnc) : "", post.externalPostId);
  await db.insert(postMetrics).values({ scheduledPostId: post.id, capturedAt: new Date(), views: m.views, likes: m.likes, comments: m.comments, shares: m.shares ?? 0, saves: m.saves ?? 0, avgWatchMs: m.avgWatchMs, raw: m.raw as never }).onConflictDoNothing();
  const age = Date.now() - (post.publishedAt?.getTime() ?? Date.now());
  const next = age < 48 * 3.6e6 ? 3.6e6 : age < 30 * 86.4e6 ? 86.4e6 : age < 180 * 86.4e6 ? 7 * 86.4e6 : null; // hourly → daily → weekly (FR-15.1)
  if (next) await enqueue("metrics.pull", { postId: post.id }, { delay: next });
}

// ---------------- tokens.refresh ----------------
async function tokensRefresh() {
  const soon = await db.select().from(socialAccounts).where(and(eq(socialAccounts.status, "active"), lte(socialAccounts.tokenExpiresAt, new Date(Date.now() + 24 * 3.6e6))));
  for (const s of soon) {
    const pub = getPublisher(s.platform);
    if (!pub.refresh || !s.refreshTokenEnc) { await db.update(socialAccounts).set({ status: "reconnect_needed" }).where(eq(socialAccounts.id, s.id)); await notify(s.workspaceId, "reconnect", "Reconnect needed", `Please reconnect your ${s.platform} account`, "/app/settings/socials"); continue; }
    try { const t = await pub.refresh(decrypt(s.refreshTokenEnc)); await db.update(socialAccounts).set({ accessTokenEnc: encrypt(t.accessToken), refreshTokenEnc: t.refreshToken ? encrypt(t.refreshToken) : s.refreshTokenEnc, tokenExpiresAt: t.expiresAt }).where(eq(socialAccounts.id, s.id)); }
    catch { await db.update(socialAccounts).set({ status: "reconnect_needed" }).where(eq(socialAccounts.id, s.id)); await db.update(scheduledPosts).set({ status: "held" }).where(and(eq(scheduledPosts.socialAccountId, s.id), eq(scheduledPosts.status, "scheduled"))); await notify(s.workspaceId, "reconnect", "Reconnect needed", `Your ${s.platform} connection expired; scheduled posts are on hold`, "/app/settings/socials"); }
  }
}

// ---------------- automation.run ----------------
async function automationRun(job: Job<{ automationId: string; runId?: string }>) {
  const a = await db.query.automations.findFirst({ where: eq(automations.id, job.data.automationId) });
  if (!a || a.status !== "active") return;
  const [run] = job.data.runId ? [await db.query.automationRuns.findFirst({ where: eq(automationRuns.id, job.data.runId) })] : await db.insert(automationRuns).values({ automationId: a.id }).returning();
  if (!run) return;
  try {
    const ws = (await db.query.workspaces.findFirst({ where: eq(workspaces.id, a.workspaceId) }))!;
    const acc = (await db.query.accounts.findFirst({ where: eq(accounts.id, ws.accountId) }))!;
    const plan = await planAutomation(a, ws.timezone);
    let generated = 0, scheduled = 0, skipped = 0; const errors: string[] = [];
    const pool = a.config.source !== "generate" ? await db.select().from(contentItems).where(and(eq(contentItems.workspaceId, a.workspaceId), eq(contentItems.status, "saved"), isNull(contentItems.deletedAt))).orderBy(desc(contentItems.predictedScore)) : [];
    let generatedItems: typeof pool = [];
    if (a.config.source !== "library") {
      const need = plan.slots.length - pool.length;
      if (need > 0) {
        const [b] = await db.insert(generationBatches).values({ workspaceId: a.workspaceId, source: "automation", requestedCount: need, params: { formats: Object.entries(a.config.format_mix).filter(([, w]) => (w ?? 0) > 0).map(([f]) => f), character_ids: a.config.character_ids, language: a.config.language, ugc_categories: a.config.ugc_categories, ugc_style_tags: a.config.ugc_style_tags } }).returning();
        await generateBatch({ data: { batchId: b.id } } as Job<{ batchId: string }>);
        // process items inline so the run completes deterministically
        const its = await db.select().from(contentItems).where(eq(contentItems.batchId, b.id));
        for (const it of its) { try { await generateItem({ data: { itemId: it.id, angle: { type: String(it.provenance.angle_type ?? "benefit"), angle: it.angle ?? "" } } } as Job<never>); generated++; } catch (e) { errors.push(String(e).slice(0, 120)); } }
        generatedItems = await db.select().from(contentItems).where(and(eq(contentItems.batchId, b.id), eq(contentItems.status, "candidate")));
      }
    }
    const candidates = [...pool, ...generatedItems];
    for (const slot of plan.slots) {
      const item = candidates.shift(); if (!item) { skipped++; continue; }
      try {
        if (item.status === "candidate") { await assertCanSave(acc.id, acc.plan); await db.update(contentItems).set({ status: a.approval === "blitz" ? "candidate" : "saved", savedAt: new Date() }).where(eq(contentItems.id, item.id)); }
        await db.insert(scheduledPosts).values({ workspaceId: a.workspaceId, contentItemId: item.id, socialAccountId: slot.socialAccountId, scheduledAt: slot.at, timezone: ws.timezone, automationId: a.id, status: a.approval === "auto" ? "scheduled" : "pending_approval", idempotencyKey: `auto-${a.id}-${slot.socialAccountId}-${slot.at.toISOString()}` }).onConflictDoNothing();
        if (a.approval === "auto") await db.update(contentItems).set({ status: "scheduled" }).where(eq(contentItems.id, item.id));
        scheduled++;
      } catch (e) { errors.push(String(e).slice(0, 120)); skipped++; if (String(e).includes("PLAN_LIMIT")) break; }
    }
    await db.update(automationRuns).set({ finishedAt: new Date(), generated, scheduled, skipped, errors, status: errors.length && !scheduled ? "failed" : "done" }).where(eq(automationRuns.id, run.id));
    await db.update(automations).set({ lastRunAt: new Date(), nextRunAt: a.mode === "continuous" ? new Date(Date.now() + 86.4e6) : null, status: a.mode === "one_shot" ? "completed" : "active" }).where(eq(automations.id, a.id));
    await notify(a.workspaceId, "automation.run", `Automation "${a.name}" ran`, `${scheduled} scheduled, ${generated} generated, ${skipped} skipped`, "/app/automations");
    await emitEvent(acc.id, "automation.ran", { automation_id: a.id, run_id: run.id, generated, scheduled, skipped });
  } catch (e) { await db.update(automationRuns).set({ finishedAt: new Date(), status: "failed", errors: [String(e)] }).where(eq(automationRuns.id, run.id)); throw e; }
}
async function automationsTick() {
  const due = await db.select().from(automations).where(and(eq(automations.status, "active"), eq(automations.mode, "continuous"), lte(automations.nextRunAt, new Date())));
  for (const a of due) await enqueue("automation.run", { automationId: a.id });
}

// ---------------- credits.allocate (monthly, idempotent on invoice) ----------------
async function creditsAllocate(job: Job<{ accountId: string; invoiceId: string }>) {
  const acc = await db.query.accounts.findFirst({ where: eq(accounts.id, job.data.accountId) }); if (!acc) return;
  const exists = await db.query.creditLedger.findFirst({ where: and(eq(schema.creditLedger.accountId, acc.id), eq(schema.creditLedger.refId, job.data.invoiceId)) }); if (exists) return;
  const l = PLANS[acc.plan].limits; if (!l.creditsRecurring) return;
  // expire previous monthly allocation (no rollover †) then allocate
  const [{ bal }] = await db.select({ bal: sql<number>`coalesce(sum(delta),0)::int` }).from(schema.creditLedger).where(and(eq(schema.creditLedger.accountId, acc.id), sql`reason in ('allocation','image','video','refund','expiry')`));
  if (bal > 0) await db.insert(schema.creditLedger).values({ accountId: acc.id, delta: -bal, reason: "expiry", refType: "invoice", refId: job.data.invoiceId });
  await db.insert(schema.creditLedger).values({ accountId: acc.id, delta: l.creditsMonthly, reason: "allocation", refType: "invoice", refId: job.data.invoiceId });
}

// ---------------- cleanup ----------------
async function cleanup() {
  await db.update(contentItems).set({ status: "archived" }).where(and(eq(contentItems.status, "skipped"), lte(contentItems.updatedAt, new Date(Date.now() - 30 * 86.4e6))));
  await db.delete(accounts).where(and(sql`${accounts.deletedAt} is not null`, lte(accounts.deletedAt, new Date(Date.now() - 30 * 86.4e6))));
}

// ---------------- content.recover ----------------
/** Items stuck in "generating" (worker crashed/restarted mid-job and BullMQ's own stall recovery didn't pick
 *  it back up) permanently block the Velocity-mode swipe queue's `remaining + generating < 10` refill check
 *  (src/app/api/v1/workspaces/[id]/blitz/route.ts) -- nothing else ever un-stuck them. Same recovery pattern
 *  publishDispatch() already uses for posts stuck in "publishing". */
async function recoverStuckContent() {
  const cutoff = new Date(Date.now() - 20 * 60_000);
  const stuck = await db.update(contentItems).set({ status: "failed", provenance: sql`${contentItems.provenance} || '{"error":"stuck in generating for over 20 minutes, recovered by cleanup sweep"}'::jsonb`, updatedAt: new Date() }).where(and(eq(contentItems.status, "generating"), lte(contentItems.updatedAt, cutoff))).returning({ id: contentItems.id, batchId: contentItems.batchId });
  for (const item of stuck) if (item.batchId) await db.update(generationBatches).set({ failedCount: sql`${generationBatches.failedCount} + 1` }).where(eq(generationBatches.id, item.batchId));
}

// ---------------- digest.weekly (FR-15.6) ----------------
async function digestWeekly() {
  const wss = await db.select().from(workspaces).where(isNull(workspaces.deletedAt));
  for (const ws of wss) {
    const since = new Date(Date.now() - 7 * 86.4e6);
    const posts = await db.select({ id: scheduledPosts.id, hook: contentItems.hook, platform: socialAccounts.platform }).from(scheduledPosts).innerJoin(contentItems, eq(contentItems.id, scheduledPosts.contentItemId)).innerJoin(socialAccounts, eq(socialAccounts.id, scheduledPosts.socialAccountId)).where(and(eq(scheduledPosts.workspaceId, ws.id), eq(scheduledPosts.status, "published"), gte(scheduledPosts.publishedAt, since)));
    if (!posts.length) continue;
    const m = await db.select({ postId: postMetrics.scheduledPostId, views: sql<number>`max(views)::int`, likes: sql<number>`max(likes)::int` }).from(postMetrics).where(inArray(postMetrics.scheduledPostId, posts.map((p) => p.id))).groupBy(postMetrics.scheduledPostId);
    const views = m.reduce((a, x) => a + x.views, 0); const top = [...m].sort((a, b) => b.views - a.views)[0]; const topPost = posts.find((p) => p.id === top?.postId);
    const members = await db.select({ email: users.email, prefs: users.notificationPrefs }).from(workspaceMembers).innerJoin(users, eq(users.id, workspaceMembers.userId)).where(eq(workspaceMembers.workspaceId, ws.id));
    for (const mem of members) {
      if (mem.prefs?.weekly_digest === false) continue;
      await sendEmail(mem.email, `${ws.name}: ${posts.length} posts, ${views.toLocaleString()} views this week`, `<p>This week for <b>${ws.name}</b>: ${posts.length} posts published, ${views.toLocaleString()} views, ${m.reduce((a, x) => a + x.likes, 0).toLocaleString()} likes.</p>${topPost ? `<p>Top post: "${topPost.hook}" on ${topPost.platform} (${top!.views.toLocaleString()} views).</p>` : ""}<p><a href="${process.env.APP_URL}/app/analytics">Open analytics</a></p>`);
    }
  }
}
// ---------------- trends.refresh: recompute velocity from metrics age (curator imports feed the table) ----------------
async function trendsRefresh() {
  await db.execute(sql`update trends set velocity_score = least(1, ((metrics->>'views')::numeric / greatest(1, extract(epoch from (now() - first_seen_at)) / 86400)) / 500000), metrics_updated_at = now() where status = 'active'`);
  await db.update(trends).set({ status: "stale" }).where(and(eq(trends.status, "active"), lte(trends.firstSeenAt, new Date(Date.now() - 90 * 86.4e6))));
}

// ---------------- webhook.deliver / affiliates.settle ----------------
async function webhookDeliver(job: Job<{ webhookId: string; event: string; payload: Record<string, unknown>; id: string }>) { await deliver(job.data.webhookId, job.data.event, job.data.payload, job.data.id); }
/** Commissions become approved 30 days after the invoice (refund window), then are paid in monthly batches by an admin (M20). */
async function affiliatesSettle() {
  await db.update(schema.affiliateCommissions).set({ status: "approved" }).where(and(eq(schema.affiliateCommissions.status, "pending"), lte(schema.affiliateCommissions.createdAt, new Date(Date.now() - 30 * 86.4e6))));
}

// ---------------- ugc.thumbnail (bulk clip ingest) ----------------
/** Probe real duration + extract a thumbnail for a bulk-uploaded UGC clip, then publish it. Split into its own
 *  lightweight queue (see src/lib/queue.ts) so thumbnailing thousands of clips can't starve rendering or publishing. */
async function ugcThumbnail(job: Job<{ clipId: string }>) {
  const clip = await db.query.ugcClips.findFirst({ where: eq(ugcClips.id, job.data.clipId) });
  if (!clip) return;
  try {
    const buf = await fetchBuf(publicUrl(clip.storageKey));
    if (!buf) throw new Error("uploaded clip not readable from storage");
    const [durationMs, thumbKey] = await Promise.all([probeDuration(buf), (async () => store(clip.storageKey.replace(/\.[^.]+$/, "") + "-thumb.jpg", await thumbnail(buf), "image/jpeg"))()]);
    await db.update(ugcClips).set({ status: "published", durationMs, thumbnailKey: thumbKey }).where(eq(ugcClips.id, clip.id));
    if (clip.ingestBatchId) await db.update(ugcClipBatches).set({ completedCount: sql`${ugcClipBatches.completedCount} + 1` }).where(eq(ugcClipBatches.id, clip.ingestBatchId));
  } catch (e) {
    const terminal = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    if (terminal) {
      await db.update(ugcClips).set({ status: "failed" }).where(eq(ugcClips.id, clip.id));
      if (clip.ingestBatchId) await db.update(ugcClipBatches).set({ failedCount: sql`${ugcClipBatches.failedCount} + 1` }).where(eq(ugcClipBatches.id, clip.ingestBatchId));
    }
    throw e;
  } finally {
    if (clip.ingestBatchId) {
      const [b] = await db.select().from(ugcClipBatches).where(eq(ugcClipBatches.id, clip.ingestBatchId)).limit(1);
      if (b && b.completedCount + b.failedCount >= b.requestedCount && b.status !== "done") await db.update(ugcClipBatches).set({ status: "done", completedAt: new Date() }).where(eq(ugcClipBatches.id, b.id));
    }
  }
}

// ---------------- boot ----------------
const handlers: Record<string, (job: Job) => Promise<void>> = {
  "profile.analyze": profileAnalyze, "generate.batch": generateBatch, "generate.item": generateItem, "publish.dispatch": publishDispatch, "publish.post": publishPost,
  "metrics.pull": metricsPull, "tokens.refresh": tokensRefresh, "automation.run": automationRun, "automations.tick": automationsTick, "credits.allocate": creditsAllocate, "cleanup": cleanup, "content.recover": recoverStuckContent,
  "render.item": renderItem, "digest.weekly": digestWeekly, "trends.refresh": trendsRefresh, "webhook.deliver": webhookDeliver, "affiliates.settle": affiliatesSettle,
  "ugc.thumbnail": ugcThumbnail,
};
async function main() {
  await coreQueue.upsertJobScheduler("publish-dispatch", { every: 60_000 }, { name: "publish.dispatch" });
  await coreQueue.upsertJobScheduler("tokens-refresh", { every: 3_600_000 }, { name: "tokens.refresh" });
  await coreQueue.upsertJobScheduler("automations-tick", { every: 600_000 }, { name: "automations.tick" });
  await coreQueue.upsertJobScheduler("cleanup", { every: 86_400_000 }, { name: "cleanup" });
  await coreQueue.upsertJobScheduler("content-recover", { every: 600_000 }, { name: "content.recover" });
  await coreQueue.upsertJobScheduler("trends-refresh", { every: 6 * 3_600_000 }, { name: "trends.refresh" });
  await coreQueue.upsertJobScheduler("digest-weekly", { pattern: "0 8 * * 1" }, { name: "digest.weekly" });
  await coreQueue.upsertJobScheduler("affiliates-settle", { every: 86_400_000 }, { name: "affiliates.settle" });
  const run = async (job: Job) => { const h = handlers[job.name]; if (!h) throw new Error(`No handler for ${job.name}`); await h(job); };
  const wire = (w: Worker, tag: string) => { w.on("failed", (job, e) => console.error(`[${tag}] ${job?.name} ${job?.id} failed:`, e.message)); w.on("completed", (job) => { if (job.name !== "publish.dispatch" && job.name !== "automations.tick") console.log(`[${tag}] ${job.name} ${job.id} done`); }); };
  const core = new Worker("velocity-core", run, { connection, concurrency: Number(process.env.CORE_CONCURRENCY ?? 8) }); wire(core, "core");
  const render = new Worker("velocity-render", run, { connection, concurrency: Number(process.env.WORKER_CONCURRENCY ?? 3), lockDuration: 180_000 }); wire(render, "render");
  const ingest = new Worker("velocity-ingest", run, { connection, concurrency: Number(process.env.INGEST_CONCURRENCY ?? 4) }); wire(ingest, "ingest");
  const shutdown = async (sig: string) => { console.log(`[worker] ${sig} — finishing in-flight jobs`); await Promise.all([core.close(), render.close(), ingest.close()]); process.exit(0); };
  process.on("SIGTERM", () => shutdown("SIGTERM")); process.on("SIGINT", () => shutdown("SIGINT"));
  void renderQueue;
  console.log("worker started (mode:", process.env.PROVIDER_MODE ?? "mock", ")");
}
main().catch((e) => { console.error(e); process.exit(1); });
export { generateBatch, generateItem };
