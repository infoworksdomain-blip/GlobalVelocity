import type { Platform } from "@/db/schema";

export type PublishInput = {
  platform: Platform; accessToken: string; externalId: string; accountType?: string | null;
  mediaUrl: string; mediaType: "video" | "images"; imageUrls?: string[]; thumbnailUrl?: string | null;
  caption: string; title?: string; hashtags: string[]; options: Record<string, unknown>; isAiGenerated: boolean;
};
export type PublishResult = { externalPostId: string; permalink?: string | null };
export type Metrics = { views: number; likes: number; comments: number; shares?: number; saves?: number; avgWatchMs?: number; raw?: unknown };
export type TokenSet = { accessToken: string; refreshToken?: string; expiresAt?: Date; scopes: string[]; externalId: string; handle?: string; displayName?: string; avatarUrl?: string; accountType?: string };

export interface Publisher {
  authUrl(state: string, redirectUri: string): string;
  exchange(code: string, redirectUri: string): Promise<TokenSet>;
  refresh?(refreshToken: string): Promise<TokenSet>;
  validate(input: PublishInput): string[]; // pre-flight validation at schedule time (FR-12.4)
  publish(input: PublishInput): Promise<PublishResult>;
  metrics(accessToken: string, externalPostId: string): Promise<Metrics>;
}
const isMock = () => process.env.PROVIDER_MODE !== "live";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const withTags = (caption: string, tags: string[]) => `${caption}\n\n${tags.map((t) => `#${t.replace(/^#/, "")}`).join(" ")}`.trim();

// ---------------- Mock (runs the full loop with no platform keys) ----------------
const mock = (platform: Platform): Publisher => ({
  authUrl: (state, redirectUri) => `${redirectUri}?state=${encodeURIComponent(state)}&code=mock_${platform}_${Date.now()}`,
  async exchange(code) { return { accessToken: "mock_" + code, scopes: ["mock"], externalId: "mock_" + platform + "_" + code.slice(-6), handle: `demo_${platform}`, displayName: `Demo ${platform} account`, accountType: "mock" }; },
  validate: () => [],
  async publish(input) { await sleep(300); const id = `mock_${Date.now()}`; return { externalPostId: id, permalink: `https://example.com/${platform}/${id}?caption=${encodeURIComponent(input.caption.slice(0, 40))}` }; },
  async metrics(_t, id) { const t = parseInt(id.replace(/\D/g, "")) || Date.now(); const hours = Math.max(1, (Date.now() - t) / 3.6e6); const views = Math.floor(120 * Math.pow(hours, 0.7) * (1 + (t % 7))); return { views, likes: Math.floor(views * 0.06), comments: Math.floor(views * 0.004), shares: Math.floor(views * 0.01), saves: Math.floor(views * 0.008) }; },
});

// ---------------- TikTok (Content Posting API v2) ----------------
const tiktok: Publisher = {
  authUrl: (state, redirectUri) => `https://www.tiktok.com/v2/auth/authorize/?client_key=${process.env.TIKTOK_CLIENT_KEY}&response_type=code&scope=user.info.basic,video.publish,video.upload,video.list&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`,
  async exchange(code, redirectUri) {
    const r = await fetch("https://open.tiktokapis.com/v2/oauth/token/", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_key: process.env.TIKTOK_CLIENT_KEY!, client_secret: process.env.TIKTOK_CLIENT_SECRET!, code, grant_type: "authorization_code", redirect_uri: redirectUri }) });
    const j = await r.json() as { access_token: string; refresh_token: string; expires_in: number; open_id: string; scope: string; error?: string };
    if (!r.ok || j.error) throw new Error(`TikTok token error: ${JSON.stringify(j)}`);
    const u = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,username", { headers: { authorization: `Bearer ${j.access_token}` } }).then((x) => x.json()) as { data?: { user?: { display_name?: string; avatar_url?: string; username?: string } } };
    return { accessToken: j.access_token, refreshToken: j.refresh_token, expiresAt: new Date(Date.now() + j.expires_in * 1000), scopes: j.scope.split(","), externalId: j.open_id, handle: u.data?.user?.username, displayName: u.data?.user?.display_name, avatarUrl: u.data?.user?.avatar_url };
  },
  async refresh(refreshToken) {
    const r = await fetch("https://open.tiktokapis.com/v2/oauth/token/", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_key: process.env.TIKTOK_CLIENT_KEY!, client_secret: process.env.TIKTOK_CLIENT_SECRET!, grant_type: "refresh_token", refresh_token: refreshToken }) });
    const j = await r.json() as { access_token: string; refresh_token: string; expires_in: number; open_id: string; scope: string };
    if (!r.ok) throw new Error("TikTok refresh failed");
    return { accessToken: j.access_token, refreshToken: j.refresh_token, expiresAt: new Date(Date.now() + j.expires_in * 1000), scopes: j.scope.split(","), externalId: j.open_id };
  },
  validate(i) { const e: string[] = []; if (i.caption.length > 2200) e.push("TikTok caption must be ≤ 2200 characters"); return e; },
  async publish(i) {
    const privacy = (i.options.privacy as string) || "PUBLIC_TO_EVERYONE";
    const post_info = { title: withTags(i.caption, i.hashtags).slice(0, 2200), privacy_level: privacy, disable_comment: i.options.allow_comment === false, disable_duet: i.options.allow_duet === false, disable_stitch: i.options.allow_stitch === false, is_aigc: i.isAiGenerated };
    const body = i.mediaType === "video"
      ? { post_info, source_info: { source: "PULL_FROM_URL", video_url: i.mediaUrl } }
      : { post_info: { ...post_info, description: post_info.title }, source_info: { source: "PULL_FROM_URL", photo_images: i.imageUrls, photo_cover_index: 0 }, post_mode: "DIRECT_POST", media_type: "PHOTO" };
    const url = i.mediaType === "video" ? "https://open.tiktokapis.com/v2/post/publish/video/init/" : "https://open.tiktokapis.com/v2/post/publish/content/init/";
    const r = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${i.accessToken}`, "content-type": "application/json; charset=UTF-8" }, body: JSON.stringify(body) });
    const j = await r.json() as { data?: { publish_id: string }; error?: { code: string; message: string } };
    if (!r.ok || j.error?.code !== "ok") throw new Error(`TikTok publish init failed: ${j.error?.message ?? r.status}`);
    const publishId = j.data!.publish_id;
    for (let n = 0; n < 40; n++) { // poll status (up to ~10 min)
      await sleep(15_000);
      const s = await fetch("https://open.tiktokapis.com/v2/post/publish/status/fetch/", { method: "POST", headers: { authorization: `Bearer ${i.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ publish_id: publishId }) }).then((x) => x.json()) as { data?: { status: string; publicaly_available_post_id?: string[]; fail_reason?: string } };
      if (s.data?.status === "PUBLISH_COMPLETE") { const pid = s.data.publicaly_available_post_id?.[0] ?? publishId; return { externalPostId: pid, permalink: `https://www.tiktok.com/@${i.externalId}/video/${pid}` }; }
      if (s.data?.status === "FAILED") throw new Error(`TikTok publish failed: ${s.data.fail_reason}`);
    }
    return { externalPostId: publishId, permalink: null };
  },
  async metrics(token, id) {
    const r = await fetch("https://open.tiktokapis.com/v2/video/query/?fields=id,view_count,like_count,comment_count,share_count", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ filters: { video_ids: [id] } }) });
    const j = await r.json() as { data?: { videos?: { view_count: number; like_count: number; comment_count: number; share_count: number }[] } };
    const v = j.data?.videos?.[0]; return { views: v?.view_count ?? 0, likes: v?.like_count ?? 0, comments: v?.comment_count ?? 0, shares: v?.share_count ?? 0, raw: j };
  },
};

// ---------------- Instagram (Graph API content publishing) ----------------
const instagram: Publisher = {
  authUrl: (state, redirectUri) => `https://www.facebook.com/v21.0/dialog/oauth?client_id=${process.env.META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=instagram_basic,instagram_content_publish,instagram_manage_insights,pages_show_list,business_management`,
  async exchange(code, redirectUri) {
    const t = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`).then((x) => x.json()) as { access_token: string };
    const ll = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&fb_exchange_token=${t.access_token}`).then((x) => x.json()) as { access_token: string; expires_in?: number };
    const pages = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=instagram_business_account{id,username,name,profile_picture_url}&access_token=${ll.access_token}`).then((x) => x.json()) as { data: { instagram_business_account?: { id: string; username: string; name?: string; profile_picture_url?: string } }[] };
    const ig = pages.data.find((p) => p.instagram_business_account)?.instagram_business_account;
    if (!ig) throw new Error("No Instagram Business/Creator account linked to a Facebook Page");
    return { accessToken: ll.access_token, expiresAt: new Date(Date.now() + (ll.expires_in ?? 5_184_000) * 1000), scopes: ["instagram_content_publish"], externalId: ig.id, handle: ig.username, displayName: ig.name, avatarUrl: ig.profile_picture_url, accountType: "business" };
  },
  validate(i) { const e: string[] = []; if (i.caption.length > 2200) e.push("Instagram caption must be ≤ 2200 characters"); if (i.hashtags.length > 30) e.push("Instagram allows ≤ 30 hashtags"); return e; },
  async publish(i) {
    const base = `https://graph.facebook.com/v21.0/${i.externalId}`;
    const caption = withTags(i.caption, i.hashtags);
    let creationId: string;
    if (i.mediaType === "video") {
      const c = await fetch(`${base}/media`, { method: "POST", body: new URLSearchParams({ media_type: "REELS", video_url: i.mediaUrl, caption, share_to_feed: String(i.options.share_to_feed !== false), access_token: i.accessToken, ...(i.thumbnailUrl ? { cover_url: i.thumbnailUrl } : {}) }) }).then((x) => x.json()) as { id: string; error?: { message: string } };
      if (c.error) throw new Error(`IG container error: ${c.error.message}`); creationId = c.id;
      for (let n = 0; n < 40; n++) { await sleep(10_000); const s = await fetch(`https://graph.facebook.com/v21.0/${creationId}?fields=status_code&access_token=${i.accessToken}`).then((x) => x.json()) as { status_code: string }; if (s.status_code === "FINISHED") break; if (s.status_code === "ERROR") throw new Error("IG media processing failed"); }
    } else {
      const children: string[] = [];
      for (const u of i.imageUrls ?? []) { const c = await fetch(`${base}/media`, { method: "POST", body: new URLSearchParams({ image_url: u, is_carousel_item: "true", access_token: i.accessToken }) }).then((x) => x.json()) as { id: string }; children.push(c.id); }
      const c = await fetch(`${base}/media`, { method: "POST", body: new URLSearchParams({ media_type: "CAROUSEL", children: children.join(","), caption, access_token: i.accessToken }) }).then((x) => x.json()) as { id: string }; creationId = c.id;
    }
    const p = await fetch(`${base}/media_publish`, { method: "POST", body: new URLSearchParams({ creation_id: creationId, access_token: i.accessToken }) }).then((x) => x.json()) as { id: string; error?: { message: string } };
    if (p.error) throw new Error(`IG publish error: ${p.error.message}`);
    const perm = await fetch(`https://graph.facebook.com/v21.0/${p.id}?fields=permalink&access_token=${i.accessToken}`).then((x) => x.json()) as { permalink?: string };
    if (i.options.first_comment) await fetch(`https://graph.facebook.com/v21.0/${p.id}/comments`, { method: "POST", body: new URLSearchParams({ message: String(i.options.first_comment), access_token: i.accessToken }) }).catch(() => {});
    return { externalPostId: p.id, permalink: perm.permalink ?? null };
  },
  async metrics(token, id) {
    const j = await fetch(`https://graph.facebook.com/v21.0/${id}/insights?metric=plays,likes,comments,shares,saved&access_token=${token}`).then((x) => x.json()) as { data?: { name: string; values: { value: number }[] }[] };
    const g = (n: string) => j.data?.find((d) => d.name === n)?.values?.[0]?.value ?? 0;
    return { views: g("plays"), likes: g("likes"), comments: g("comments"), shares: g("shares"), saves: g("saved"), raw: j };
  },
};

// ---------------- YouTube (Data API v3) ----------------
const youtube: Publisher = {
  authUrl: (state, redirectUri) => `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_YT_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&access_type=offline&prompt=consent&state=${state}&scope=${encodeURIComponent("https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly")}`,
  async exchange(code, redirectUri) {
    const j = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ code, client_id: process.env.GOOGLE_YT_CLIENT_ID!, client_secret: process.env.GOOGLE_YT_CLIENT_SECRET!, redirect_uri: redirectUri, grant_type: "authorization_code" }) }).then((x) => x.json()) as { access_token: string; refresh_token?: string; expires_in: number; scope: string };
    const ch = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { authorization: `Bearer ${j.access_token}` } }).then((x) => x.json()) as { items?: { id: string; snippet: { title: string; customUrl?: string; thumbnails?: { default?: { url: string } } } }[] };
    const c = ch.items?.[0]; if (!c) throw new Error("No YouTube channel on this Google account");
    return { accessToken: j.access_token, refreshToken: j.refresh_token, expiresAt: new Date(Date.now() + j.expires_in * 1000), scopes: j.scope.split(" "), externalId: c.id, handle: c.snippet.customUrl, displayName: c.snippet.title, avatarUrl: c.snippet.thumbnails?.default?.url };
  },
  async refresh(refreshToken) {
    const j = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ refresh_token: refreshToken, client_id: process.env.GOOGLE_YT_CLIENT_ID!, client_secret: process.env.GOOGLE_YT_CLIENT_SECRET!, grant_type: "refresh_token" }) }).then((x) => x.json()) as { access_token: string; expires_in: number; scope: string };
    return { accessToken: j.access_token, refreshToken, expiresAt: new Date(Date.now() + j.expires_in * 1000), scopes: j.scope.split(" "), externalId: "" };
  },
  validate(i) { const e: string[] = []; if (i.mediaType !== "video") e.push("YouTube Shorts requires a video"); if ((i.title ?? i.caption).length > 100) e.push("YouTube title must be ≤ 100 characters"); return e; },
  async publish(i) {
    const media = await fetch(i.mediaUrl); const buf = Buffer.from(await media.arrayBuffer());
    const meta = { snippet: { title: (i.title ?? i.caption.split("\n")[0]).slice(0, 100), description: withTags(i.caption, i.hashtags).slice(0, 5000) + "\n#Shorts", tags: i.hashtags, categoryId: "22" }, status: { privacyStatus: (i.options.privacy as string) || "public", selfDeclaredMadeForKids: false, containsSyntheticMedia: i.isAiGenerated } };
    const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", { method: "POST", headers: { authorization: `Bearer ${i.accessToken}`, "content-type": "application/json", "x-upload-content-type": "video/mp4", "x-upload-content-length": String(buf.length) }, body: JSON.stringify(meta) });
    const loc = init.headers.get("location"); if (!loc) throw new Error(`YouTube upload init failed ${init.status}`);
    const up = await fetch(loc, { method: "PUT", headers: { "content-type": "video/mp4", "content-length": String(buf.length) }, body: buf });
    const j = await up.json() as { id: string; error?: { message: string } }; if (j.error) throw new Error(`YouTube error: ${j.error.message}`);
    return { externalPostId: j.id, permalink: `https://youtube.com/shorts/${j.id}` };
  },
  async metrics(token, id) {
    const j = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${id}`, { headers: { authorization: `Bearer ${token}` } }).then((x) => x.json()) as { items?: { statistics: { viewCount: string; likeCount: string; commentCount: string } }[] };
    const s = j.items?.[0]?.statistics; return { views: Number(s?.viewCount ?? 0), likes: Number(s?.likeCount ?? 0), comments: Number(s?.commentCount ?? 0), raw: j };
  },
};

// ---------------- LinkedIn (Posts API + Videos API) ----------------
const linkedin: Publisher = {
  authUrl: (state, redirectUri) => `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${process.env.LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent("openid profile w_member_social")}`,
  async exchange(code, redirectUri) {
    const j = await fetch("https://www.linkedin.com/oauth/v2/accessToken", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: process.env.LINKEDIN_CLIENT_ID!, client_secret: process.env.LINKEDIN_CLIENT_SECRET! }) }).then((x) => x.json()) as { access_token: string; expires_in: number; scope: string };
    const me = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { authorization: `Bearer ${j.access_token}` } }).then((x) => x.json()) as { sub: string; name?: string; picture?: string };
    return { accessToken: j.access_token, expiresAt: new Date(Date.now() + j.expires_in * 1000), scopes: j.scope.split(" "), externalId: me.sub, displayName: me.name, avatarUrl: me.picture, accountType: "member" };
  },
  validate(i) { const e: string[] = []; if (i.caption.length > 3000) e.push("LinkedIn commentary must be ≤ 3000 characters"); return e; },
  async publish(i) {
    const owner = (i.options.organization_urn as string) || `urn:li:person:${i.externalId}`;
    const h = { authorization: `Bearer ${i.accessToken}`, "content-type": "application/json", "LinkedIn-Version": "202409", "X-Restli-Protocol-Version": "2.0.0" };
    const media = await fetch(i.mediaUrl); const buf = Buffer.from(await media.arrayBuffer());
    const init = await fetch("https://api.linkedin.com/rest/videos?action=initializeUpload", { method: "POST", headers: h, body: JSON.stringify({ initializeUploadRequest: { owner, fileSizeBytes: buf.length, uploadCaptions: false, uploadThumbnail: false } }) }).then((x) => x.json()) as { value: { video: string; uploadInstructions: { uploadUrl: string; firstByte: number; lastByte: number }[] } };
    const etags: string[] = [];
    for (const part of init.value.uploadInstructions) { const r = await fetch(part.uploadUrl, { method: "PUT", headers: { "content-type": "application/octet-stream" }, body: buf.subarray(part.firstByte, part.lastByte + 1) }); etags.push(r.headers.get("etag") ?? ""); }
    await fetch("https://api.linkedin.com/rest/videos?action=finalizeUpload", { method: "POST", headers: h, body: JSON.stringify({ finalizeUploadRequest: { video: init.value.video, uploadToken: "", uploadedPartIds: etags } }) });
    const post = await fetch("https://api.linkedin.com/rest/posts", { method: "POST", headers: h, body: JSON.stringify({ author: owner, commentary: withTags(i.caption, i.hashtags).slice(0, 3000), visibility: "PUBLIC", distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] }, content: { media: { id: init.value.video, title: (i.title ?? "").slice(0, 200) } }, lifecycleState: "PUBLISHED", isReshareDisabledByAuthor: false }) });
    if (!post.ok) throw new Error(`LinkedIn post failed ${post.status}: ${await post.text()}`);
    const id = post.headers.get("x-restli-id") ?? ""; return { externalPostId: id, permalink: id ? `https://www.linkedin.com/feed/update/${id}` : null };
  },
  async metrics() { return { views: 0, likes: 0, comments: 0 }; }, // LinkedIn member post analytics require additional partner permissions
};

export function getPublisher(platform: Platform): Publisher {
  if (isMock()) return mock(platform);
  return { tiktok, instagram, youtube, linkedin }[platform];
}
export const PLATFORMS: { id: Platform; name: string; color: string }[] = [
  { id: "tiktok", name: "TikTok", color: "#111" }, { id: "instagram", name: "Instagram Reels", color: "#d6249f" },
  { id: "youtube", name: "YouTube Shorts", color: "#ff0000" }, { id: "linkedin", name: "LinkedIn", color: "#0a66c2" },
];
