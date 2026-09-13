/** Marketing content — programmatic SEO pages, FAQ, testimonials. Replace placeholder copy/brand freely; nothing here is copied from a third party. */
export const APP = {
  name: "Velocity", tagline: "AI marketing on autopilot", discord: process.env.NEXT_PUBLIC_DISCORD_URL ?? "https://discord.gg/your-invite",
  twitter: "@velocityhq",
  /** Registered office — shown on the contact page with a map and directions. Replace with your real address. */
  address: { line1: "Unit 4, Barrow Court", line2: "Aylesham Business Park", city: "Aylesham", region: "Kent", postcode: "CT3 3EF", country: "United Kingdom", lat: 51.2273, lng: 1.2049, phone: "+44 20 3900 0000", email: "hello@example.com", hours: "Mon–Fri, 9:00–17:30 GMT" },
};
export const FAQ_CATEGORIES = ["Getting started", "Content & quality", "Publishing", "Plans & billing", "Privacy & data"] as const;
export const FAQ: { q: string; a: string; cat: (typeof FAQ_CATEGORIES)[number] }[] = [
  { cat: "Getting started", q: "How does it work?", a: "Paste your website URL. Velocity reads your site, builds a Company Profile, and generates a stack of short-form videos, slideshows and memes. You swipe right to keep, left to skip, then schedule to TikTok, Instagram Reels, YouTube Shorts and LinkedIn." },
  { cat: "Content & quality", q: "Do I need to appear on camera?", a: "No. AI UGC characters deliver your scripts as talking-head videos, or pick from licensed human creator clips with your voiceover." },
  { cat: "Content & quality", q: "Can I edit the content?", a: "Yes — every hook, script and caption is editable in the Content Studio, and every edit is versioned." },
  { cat: "Publishing", q: "Which platforms do you publish to?", a: "TikTok, Instagram Reels, YouTube Shorts and LinkedIn, natively via each platform's official API." },
  { cat: "Plans & billing", q: "What are AI Studio credits?", a: "Credits pay for image and video generation in AI Studio: 4 credits per image, 10 credits per second of video. Every paid plan includes a monthly allowance; buy packs any time." },
  { cat: "Plans & billing", q: "Can I cancel any time?", a: "Yes. Downgrade or cancel from Billing; your content stays in your library. Downgrading locks workspaces beyond your new plan's limit rather than deleting anything." },
  { cat: "Getting started", q: "How long does the first batch take?", a: "Analysis of your site takes under a minute, and the first candidates start appearing in Velocity mode while the rest render in the background." },
  { cat: "Getting started", q: "What if I don't have a website yet?", a: "You can fill in the Company Profile manually under Settings → Profile and generate from that." },
  { cat: "Content & quality", q: "Is the content unique to my brand?", a: "Every angle, hook and caption is generated from your Company Profile, and recently used angles are excluded so batches don't repeat themselves." },
  { cat: "Content & quality", q: "Do you disclose AI-generated content?", a: "Yes. Videos are flagged as AI-generated when the platform supports it, which is a requirement on TikTok and YouTube." },
  { cat: "Publishing", q: "Do you post on my behalf automatically?", a: "Only if you choose auto-publish in an automation. By default you approve every post in Velocity mode or the calendar first." },
  { cat: "Publishing", q: "What happens if a post fails?", a: "It retries with backoff, and if it still fails you get a notification with the platform's error and a one-click retry in the calendar." },
  { cat: "Publishing", q: "Can I connect more than one account per platform?", a: "Growth and Pro allow unlimited social accounts per workspace; Starter allows one per platform." },
  { cat: "Privacy & data", q: "What do you do with my website content?", a: "We read your public pages to build your Company Profile. We store the profile and the content you generate, never your credentials." },
  { cat: "Privacy & data", q: "Can I delete my data?", a: "Yes. Deleting your account marks it for purge after 30 days; content is removed from storage at that point." },
  { cat: "Privacy & data", q: "Where is data stored?", a: "In the region you deploy to. Social tokens are encrypted at rest with AES-256-GCM and API keys are stored hashed." },
];
export const TESTIMONIALS = [
  { name: "Ana R.", role: "Founder, indie SaaS", text: "I went from posting nothing to 5 videos a week in an afternoon. The swipe flow is weirdly addictive." },
  { name: "Tom K.", role: "Solo app developer", text: "The Company Profile nailed my positioning better than I did. Scheduling to Shorts and TikTok from one place is the killer feature." },
  { name: "Priya S.", role: "E-commerce owner", text: "Trend remixes got my first 100k-view video. Attribution finally shows which posts drive checkouts." },
];
export const TOOLS = [
  { slug: "ai-ugc-video-generator", title: "AI UGC Video Generator", intro: "Turn a script into a talking-head UGC-style video with a realistic AI character — no camera, no editing.", bullets: ["1,000+ AI characters", "Auto captions and hooks", "Publish to TikTok, Reels, Shorts"] },
  { slug: "tiktok-slideshow-maker", title: "TikTok Slideshow Maker", intro: "Generate photo-carousel TikToks with on-brand slides from your website in seconds.", bullets: ["Brand colours pulled from your site", "5–7 slide storytelling structure", "Native TikTok photo posts"] },
  { slug: "ai-meme-generator", title: "AI Meme Generator", intro: "Memes that reframe your audience's pain points, generated from your Company Profile.", bullets: ["On-brand humour", "Instant 9:16 export", "Schedule with everything else"] },
  { slug: "social-media-scheduler", title: "Social Media Scheduler", intro: "Drag-and-drop calendar with posting-time queues for TikTok, Instagram, YouTube and LinkedIn.", bullets: ["Native publishing", "Best-time queues", "Retries and reconnect alerts"] },
  { slug: "trend-remix", title: "Trend Remix", intro: "Browse trending short-form formats and remix them for your product.", bullets: ["25k+ trend recipes", "Ranked by fit for your brand", "One-click remix"] },
  { slug: "ai-hook-generator", title: "AI Hook Generator", intro: "Scroll-stopping first lines generated from your Company Profile, ranked by predicted performance.", bullets: ["8 angle types", "Under 12 words", "Feeds straight into videos"] },
  { slug: "instagram-reels-caption-generator", title: "Instagram Reels Caption Generator", intro: "On-brand captions with the right hashtag count and a CTA, validated against Instagram limits.", bullets: ["≤2200 chars, ≤30 hashtags", "First-comment support", "Scheduled natively"] },
  { slug: "youtube-shorts-generator", title: "YouTube Shorts Generator", intro: "Vertical Shorts with burned-in captions, titles under 100 characters and the AI-content flag set correctly.", bullets: ["9:16 H.264", "Auto #Shorts tag", "Resumable uploads"] },
  { slug: "linkedin-video-post-generator", title: "LinkedIn Video Post Generator", intro: "Professional short-form video and commentary for founders building an audience on LinkedIn.", bullets: ["Hot-take and story formats", "≤3000-char commentary", "Native video upload"] },
  { slug: "ai-influencer-generator", title: "AI Influencer Generator", intro: "Create a consistent synthetic spokesperson for your brand and reuse them across every video.", bullets: ["Consistency pack", "Own voice ID", "4 credits per image"] },
  { slug: "content-calendar-generator", title: "Content Calendar Generator", intro: "Fill a month of posting slots automatically with a format mix you control.", bullets: ["Per-platform daily caps", "Approval modes", "Preview before commit"] },
  { slug: "website-to-video", title: "Website to Video", intro: "Paste a URL and get short-form videos that explain your product in its own words.", bullets: ["Reads pricing, features, FAQ", "Brand colours detected", "First 30 posts free"] },
];
export const COMPARE = [
  { slug: "velocity-vs-buffer", title: "Velocity vs Buffer", them: "Buffer", summary: "Buffer schedules content you already have. Velocity generates the content, then schedules it." },
  { slug: "velocity-vs-later", title: "Velocity vs Later", them: "Later", summary: "Later focuses on Instagram planning. Velocity generates short-form video for four platforms and publishes natively." },
  { slug: "velocity-vs-hiring-an-agency", title: "Velocity vs hiring an agency", them: "an agency", summary: "An agency costs thousands a month and takes weeks. Velocity gives you a month of content in an afternoon for $29." },
  { slug: "velocity-vs-hootsuite", title: "Velocity vs Hootsuite", them: "Hootsuite", summary: "Hootsuite is built for enterprise social teams managing existing content. Velocity is built for founders who have none yet." },
  { slug: "velocity-vs-opus-clip", title: "Velocity vs Opus Clip", them: "Opus Clip", summary: "Opus Clip repurposes long videos you already recorded. Velocity creates short-form content from your website with no recording." },
  { slug: "velocity-vs-freelance-editor", title: "Velocity vs a freelance editor", them: "a freelance editor", summary: "A freelancer delivers a handful of edits a week. Velocity generates, you approve, and it publishes daily." },
];
export const ALTERNATIVES = [
  { slug: "canva-alternative", title: "Canva alternative for short-form video", them: "Canva" },
  { slug: "capcut-alternative", title: "CapCut alternative for founders", them: "CapCut" },
  { slug: "hootsuite-alternative", title: "Hootsuite alternative with AI content", them: "Hootsuite" },
  { slug: "buffer-alternative", title: "Buffer alternative that makes the content too", them: "Buffer" },
  { slug: "later-alternative", title: "Later alternative for short-form video", them: "Later" },
  { slug: "invideo-alternative", title: "InVideo alternative with scheduling built in", them: "InVideo" },
];
export const INDUSTRIES = [
  { slug: "saas", title: "SaaS", pitch: "Explain features as founder stories and demos that convert trial signups." },
  { slug: "mobile-apps", title: "Mobile apps", pitch: "Hook + demo videos and App Store links that drive installs." },
  { slug: "ecommerce", title: "E-commerce", pitch: "UGC-style product videos and memes that drive checkouts, with attribution." },
  { slug: "agencies", title: "Agencies", pitch: "Run every client brand from its own workspace with team roles." },
  { slug: "coaches-and-creators", title: "Coaches & creators", pitch: "Daily talking-head content without filming." },
  { slug: "local-services", title: "Local services", pitch: "Before/after and customer-story formats that fill your booking calendar." },
  { slug: "fintech", title: "Fintech", pitch: "Explainer and objection-handling formats with compliance-friendly copy guardrails." },
  { slug: "b2b-startups", title: "B2B startups", pitch: "Founder-led LinkedIn and Shorts content that books demos." },
];
export const BLOG = [
  { slug: "how-to-post-daily-without-burning-out", title: "How to post daily on TikTok without burning out", date: "2026-08-20", excerpt: "A batching system that gets founders 30 posts a month in one sitting.", body: ["Consistency beats virality. The founders who grow on short-form are the ones who post daily for months, not the ones who chase a single hit.", "The trick is separating generation from approval. Generate a large batch of angles at once, then approve in a single fast session, then let scheduling handle the rest.", "Velocity's Velocity mode is built around exactly this loop: swipe through candidates, keep the good ones, and your calendar fills itself."] },
  { slug: "ugc-ads-explained", title: "UGC-style content, explained for founders", date: "2026-08-05", excerpt: "Why unpolished, first-person videos outperform polished ads — and how to make them without a creator.", body: ["UGC (user-generated content) style videos look like a real person talking about a product. They perform because they don't pattern-match to ads.", "You don't need creators to make them any more. AI characters and licensed human clips let you produce UGC-style videos from a script in minutes."] },
  { slug: "attribution-for-social-video", title: "Attribution for social video: what actually works", date: "2026-07-15", excerpt: "Platform links strip UTMs. Here's how to see which posts drive signups anyway.", body: ["Most social platforms don't pass referrer data cleanly, so a tracked link per post plus a lightweight site snippet is the most reliable approach.", "Velocity creates a tracked link for every scheduled post and reports visits, signups and purchases by platform and by post."] },
];
