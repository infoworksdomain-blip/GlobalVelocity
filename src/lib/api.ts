"use client";
/** Browser API client. Maps 402 plan-limit responses to a PlanLimitError the UI turns into an upgrade wall. */
export class ApiError extends Error { constructor(public status: number, public code: string, message: string, public extra: Record<string, unknown> = {}) { super(message); } }
export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const r = await fetch(`/api/v1${path}`, { ...rest, headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...(rest.headers ?? {}) }, body: json !== undefined ? JSON.stringify(json) : rest.body, credentials: "same-origin" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, data.error?.code ?? "ERROR", data.error?.message ?? r.statusText, data.error ?? {});
  return data as T;
}
export const fmtNum = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "k" : String(n));
export const FORMAT_LABEL: Record<string, string> = { ai_ugc: "AI UGC", human_ugc: "Human UGC", human_image: "Human image", slideshow: "Slideshow", hook_demo: "Hook + demo", meme: "Meme", remix: "Trend remix", upload: "Upload", wall_of_text: "Wall of text", green_screen: "Green screen" };
export const PLATFORM_LABEL: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube", linkedin: "LinkedIn" };
