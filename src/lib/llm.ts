import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/** Provider-abstracted LLM helper. PROVIDER_MODE=mock (or no key) returns deterministic fixtures so the whole loop runs offline. */
export const isMock = () => process.env.PROVIDER_MODE !== "live" || !process.env.ANTHROPIC_API_KEY;

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

export async function completeJson<S extends z.ZodTypeAny>(system: string, user: string, schema: S, mock: () => z.input<S>, maxTokens = 4000): Promise<z.output<S>> {
  if (isMock()) return schema.parse(mock());
  const res = await anthropic().messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5", max_tokens: maxTokens,
    system: system + "\nRespond with a single JSON object only. No prose, no markdown fences.",
    messages: [{ role: "user", content: user }],
  });
  const text = res.content.filter((c) => c.type === "text").map((c) => (c as { text: string }).text).join("");
  const clean = text.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{"); const end = clean.lastIndexOf("}");
  return schema.parse(JSON.parse(clean.slice(start, end + 1)));
}

/** Cheap deterministic embedding used when no embedding provider is configured (hash-based bag of words → 1536 dims). */
export function embed(text: string): number[] {
  const v = new Array(1536).fill(0);
  for (const w of text.toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length > 2)) {
    let h = 2166136261; for (const ch of w) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    v[h % 1536] += 1;
  }
  const n = Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

/** Basic text policy classifier: blocks prohibited categories before rendering (FR-4.8). Extend with a moderation API in live mode. */
const BLOCKED = /\b(child\s*porn|cp\b|underage|nude|escort|cocaine|meth|fentanyl|ghost\s*gun|bomb\s*making|kill\s+(all|every)|nazi|white\s+power)\b/i;
export function moderateText(...parts: (string | null | undefined)[]) {
  const joined = parts.filter(Boolean).join("\n");
  return BLOCKED.test(joined) ? { status: "blocked" as const, reasons: ["prohibited_content"] } : { status: "ok" as const };
}
