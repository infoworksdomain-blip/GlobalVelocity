import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { z } from "zod";

/** Provider-abstracted LLM helper. PROVIDER_MODE=mock (or no key for the selected provider) returns deterministic fixtures so the whole loop runs offline. */
const llmProvider = () => (process.env.LLM_PROVIDER === "openai" ? "openai" : "anthropic");
export const isMock = () =>
  process.env.PROVIDER_MODE !== "live" ||
  (llmProvider() === "anthropic" ? !process.env.ANTHROPIC_API_KEY : !process.env.OPENAI_API_KEY);

let anthropicClient: Anthropic | null = null;
const anthropic = () => (anthropicClient ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));
let openaiClient: OpenAI | null = null;
const openai = () => (openaiClient ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

const JSON_ONLY_SUFFIX = "\nRespond with a single JSON object only. No prose, no markdown fences.";

async function completeAnthropicText(system: string, user: string, maxTokens: number): Promise<string> {
  const res = await anthropic().messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5", max_tokens: maxTokens,
    system: system + JSON_ONLY_SUFFIX,
    messages: [{ role: "user", content: user }],
  });
  return res.content.filter((c) => c.type === "text").map((c) => (c as { text: string }).text).join("");
}

async function completeOpenAIText(system: string, user: string, maxTokens: number): Promise<string> {
  const res = await openai().responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5", max_output_tokens: maxTokens,
    instructions: system + JSON_ONLY_SUFFIX,
    input: user,
    text: { format: { type: "json_object" } },
  });
  return res.output_text;
}

/** Model label for provenance stamping -- "mock" unless actually running live. */
export const currentModelLabel = () => (isMock() ? "mock" : llmProvider() === "openai" ? process.env.OPENAI_MODEL || "gpt-5" : process.env.ANTHROPIC_MODEL || "claude-sonnet-5");

export async function completeJson<S extends z.ZodTypeAny>(system: string, user: string, schema: S, mock: () => z.input<S>, maxTokens = 4000): Promise<z.output<S>> {
  if (isMock()) return schema.parse(mock());
  const text = llmProvider() === "openai" ? await completeOpenAIText(system, user, maxTokens) : await completeAnthropicText(system, user, maxTokens);
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
