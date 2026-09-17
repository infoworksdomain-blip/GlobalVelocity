import type { Plan } from "@/db/schema";

// Single source of truth for pricing and entitlements. Marketing pricing, paywalls and the
// entitlement service all read from here (FR-18.2). Values marked † are design decisions.
export const CREDIT_TARIFF = { image: 4, videoPerSecond: 10, imageBgRemove: 2, imageInpaint: 3, imageUpscale: 2, videoAutoCaption: 3, videoVoiceSwap: 4 } as const;
export const YEARLY_DISCOUNT = 0.2;

export type PlanDef = {
  id: Plan; name: string; tagline: string; priceMonth: number; features: string[]; badge?: string;
  limits: {
    workspaces: number; saves: number | null; candidatesPerDay: number; creditsMonthly: number; creditsRecurring: boolean;
    socialsPerPlatform: number | null; platforms: ("tiktok" | "instagram" | "youtube" | "linkedin")[];
    characterTier: Plan | "preview"; ugcClipsMonthly: number; ugcImagesMonthly: number; scheduling: boolean; trendRemix: boolean;
    multiLanguage: boolean; apiRpm: number; teamInvites: boolean; earlyAccess: boolean; watermarkFreeDownloads: boolean;
  };
};
const ALL: PlanDef["limits"]["platforms"] = ["tiktok", "instagram", "youtube", "linkedin"];

export const PLANS: Record<Plan, PlanDef> = {
  free: {
    id: "free", name: "Free", tagline: "Test the waters", priceMonth: 0,
    features: ["No credit card", "Access to Velocity mode (swipe mode)", "10 AI Studio credits", "Limited content", "Browse features"],
    limits: { workspaces: 1, saves: 3, candidatesPerDay: 20, creditsMonthly: 10, creditsRecurring: false, socialsPerPlatform: 0, platforms: [],
      characterTier: "preview", ugcClipsMonthly: 0, ugcImagesMonthly: 0, scheduling: false, trendRemix: false, multiLanguage: false, apiRpm: 0, teamInvites: false, earlyAccess: false, watermarkFreeDownloads: false },
  },
  starter: {
    id: "starter", name: "Starter", tagline: "If you're just starting out", priceMonth: 29,
    features: ["20 content saves", "250 AI Studio credits", "TikTok, Instagram, YouTube + LinkedIn", "1 workspace", "25 AI UGC characters", "Velocity mode"],
    limits: { workspaces: 1, saves: 20, candidatesPerDay: 150, creditsMonthly: 250, creditsRecurring: true, socialsPerPlatform: 1, platforms: ALL,
      characterTier: "starter", ugcClipsMonthly: 0, ugcImagesMonthly: 0, scheduling: true, trendRemix: true, multiLanguage: false, apiRpm: 60, teamInvites: true, earlyAccess: false, watermarkFreeDownloads: true },
  },
  growth: {
    id: "growth", name: "Growth", tagline: "If you're looking to grow fast", priceMonth: 49, badge: "Most popular",
    features: ["100 content saves", "500 AI Studio credits", "Unlimited socials", "3 workspaces", "500+ AI UGC characters", "100 human UGC videos", "Velocity mode"],
    limits: { workspaces: 3, saves: 100, candidatesPerDay: 400, creditsMonthly: 500, creditsRecurring: true, socialsPerPlatform: null, platforms: ALL,
      characterTier: "growth", ugcClipsMonthly: 100, ugcImagesMonthly: 100, scheduling: true, trendRemix: true, multiLanguage: false, apiRpm: 300, teamInvites: true, earlyAccess: false, watermarkFreeDownloads: true },
  },
  pro: {
    id: "pro", name: "Pro", tagline: "If you want to 10x your marketing", priceMonth: 149,
    features: ["Unlimited content saves", "2000 AI Studio credits", "Unlimited scheduling", "10 workspaces", "2000+ human UGC videos", "Early access to new features", "Multi-language content"],
    limits: { workspaces: 10, saves: null, candidatesPerDay: 1000, creditsMonthly: 2000, creditsRecurring: true, socialsPerPlatform: null, platforms: ALL,
      characterTier: "pro", ugcClipsMonthly: 2000, ugcImagesMonthly: 2000, scheduling: true, trendRemix: true, multiLanguage: true, apiRpm: 1000, teamInvites: true, earlyAccess: true, watermarkFreeDownloads: true },
  },
};
export const PLAN_ORDER: Plan[] = ["free", "starter", "growth", "pro"];
export const yearlyPricePerMonth = (p: PlanDef) => Math.round(p.priceMonth * (1 - YEARLY_DISCOUNT) * 100) / 100;
export const tierRank = (t: Plan | "preview") => (t === "preview" ? -1 : PLAN_ORDER.indexOf(t));
export const CREDIT_PACKS = [{ id: "pack_100", credits: 100, usd: 10 }, { id: "pack_500", credits: 500, usd: 40 }, { id: "pack_2000", credits: 2000, usd: 140 }];
