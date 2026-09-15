import { z } from "zod";
export const configSchema = z.object({
  social_account_ids: z.array(z.string().uuid()).min(1), posts_per_day: z.number().int().min(1).max(10).default(1), horizon_days: z.number().int().min(1).max(60).default(30),
  times: z.array(z.string().regex(/^\d{2}:\d{2}$/)).default(["09:00", "13:00", "19:00"]), weekdays: z.array(z.number().int().min(0).max(6)).default([]),
  format_mix: z.record(z.number().min(0).max(1)).default({ ai_ugc: 0.4, slideshow: 0.3, hook_demo: 0.2, meme: 0.1 }), character_ids: z.array(z.string().uuid()).optional(), language: z.string().optional(),
  ugc_categories: z.array(z.string().max(60)).optional(), ugc_style_tags: z.array(z.string().max(40)).optional(),
  source: z.enum(["generate", "library", "mixed"]).default("mixed"), min_spacing_minutes: z.number().int().min(15).default(120), max_per_platform_per_day: z.number().int().min(1).max(25).default(5),
});
