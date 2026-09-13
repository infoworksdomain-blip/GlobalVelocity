import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { eq, and, isNull } from "drizzle-orm";
import { limits, audit } from "@/lib/tenancy";
import { planLimit, err } from "@/lib/errors";
import { sha256, randomToken } from "@/lib/crypto";
import { z } from "zod";
const SCOPES = ["content:read", "content:write", "publish", "analytics:read", "trends:read"] as const;
export const GET = route(async ({ actor }) => ({ keys: await db.select({ id: schema.apiKeys.id, name: schema.apiKeys.name, prefix: schema.apiKeys.prefix, scopes: schema.apiKeys.scopes, workspaceIds: schema.apiKeys.workspaceIds, lastUsedAt: schema.apiKeys.lastUsedAt, createdAt: schema.apiKeys.createdAt }).from(schema.apiKeys).where(and(eq(schema.apiKeys.accountId, actor.accountId), isNull(schema.apiKeys.revokedAt))), rate_limit_rpm: limits(actor.plan).apiRpm }));
export const POST = route(async ({ actor, body }) => {
  if (actor.apiKey) throw err(403, "FORBIDDEN", "Keys cannot create keys");
  if (limits(actor.plan).apiRpm === 0) throw planLimit("PLAN_API_ACCESS", "API keys require a paid plan");
  const b = parse(z.object({ name: z.string().max(60).default("Default"), scopes: z.array(z.enum(SCOPES)).min(1), workspace_ids: z.array(z.string().uuid()).default([]) }), body);
  const raw = `sk_${process.env.NODE_ENV === "production" ? "live" : "test"}_${randomToken(24)}`;
  const [k] = await db.insert(schema.apiKeys).values({ accountId: actor.accountId, name: b.name, prefix: raw.slice(0, 12), keyHash: sha256(raw), scopes: b.scopes, workspaceIds: b.workspace_ids }).returning();
  await audit({ accountId: actor.accountId, actorId: actor.userId, action: "apikey.create", targetId: k.id });
  return { key: raw, id: k.id, note: "Store this key now; it will not be shown again." };
});
