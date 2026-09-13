import { NextResponse } from "next/server";
import { getActor } from "@/lib/tenancy";
import { toResponse } from "@/lib/errors";
import { db, schema } from "@/db";
import { and, eq, desc } from "drizzle-orm";
import { enqueue } from "@/lib/queue";
import { scheduleItem } from "@/lib/scheduling";
import { requireWorkspace, bumpUsage, limits, assertScheduling } from "@/lib/tenancy";
import { serializeItem } from "@/lib/content";

/**
 * Remote MCP server (Streamable HTTP, JSON-RPC 2.0) — FR-19.4. Connect from Claude/Cursor/etc. with
 * URL `${APP_URL}/api/mcp` and header `Authorization: Bearer sk_...`. Exposes the tool surface from spec §8.
 */
const tools = [
  { name: "list_workspaces", description: "List the workspaces (brands) on this account.", inputSchema: { type: "object", properties: {} } },
  { name: "get_company_profile", description: "Get the company profile for a workspace.", inputSchema: { type: "object", properties: { workspace_id: { type: "string" } }, required: ["workspace_id"] } },
  { name: "generate_content", description: "Generate a batch of short-form content candidates. Returns a batch_id to poll with get_batch.", inputSchema: { type: "object", properties: { workspace_id: { type: "string" }, count: { type: "integer" }, formats: { type: "array", items: { type: "string" } }, language: { type: "string" } }, required: ["workspace_id"] } },
  { name: "get_batch", description: "Get batch progress and generated items.", inputSchema: { type: "object", properties: { batch_id: { type: "string" } }, required: ["batch_id"] } },
  { name: "list_content", description: "List saved content in a workspace.", inputSchema: { type: "object", properties: { workspace_id: { type: "string" }, status: { type: "string" }, limit: { type: "integer" } }, required: ["workspace_id"] } },
  { name: "get_content", description: "Get a content item with media URLs.", inputSchema: { type: "object", properties: { content_item_id: { type: "string" } }, required: ["content_item_id"] } },
  { name: "list_social_accounts", description: "Connected social accounts for a workspace.", inputSchema: { type: "object", properties: { workspace_id: { type: "string" } }, required: ["workspace_id"] } },
  { name: "schedule_post", description: "Schedule a content item to one or more social accounts (omit scheduled_at to use the next free slot).", inputSchema: { type: "object", properties: { content_item_id: { type: "string" }, social_account_ids: { type: "array", items: { type: "string" } }, scheduled_at: { type: "string" } }, required: ["content_item_id", "social_account_ids"] } },
  { name: "publish_now", description: "Publish a content item immediately.", inputSchema: { type: "object", properties: { content_item_id: { type: "string" }, social_account_ids: { type: "array", items: { type: "string" } } }, required: ["content_item_id", "social_account_ids"] } },
  { name: "list_scheduled_posts", description: "Upcoming scheduled posts.", inputSchema: { type: "object", properties: { workspace_id: { type: "string" } }, required: ["workspace_id"] } },
  { name: "get_analytics", description: "Analytics overview for the last N days.", inputSchema: { type: "object", properties: { workspace_id: { type: "string" }, days: { type: "integer" } }, required: ["workspace_id"] } },
  { name: "list_trends", description: "Trending formats ranked by fit for the workspace.", inputSchema: { type: "object", properties: { workspace_id: { type: "string" }, platform: { type: "string" } }, required: ["workspace_id"] } },
  { name: "get_credits", description: "AI Studio credit balance.", inputSchema: { type: "object", properties: {} } },
];

async function call(name: string, a: Record<string, never>, req: Request) {
  const actor = await getActor(req);
  const text = (v: unknown) => ({ content: [{ type: "text", text: JSON.stringify(v, null, 2) }] });
  switch (name) {
    case "list_workspaces": return text(await db.select({ id: schema.workspaces.id, name: schema.workspaces.name }).from(schema.workspaces).where(eq(schema.workspaces.accountId, actor.accountId)));
    case "get_company_profile": { await requireWorkspace(actor, a.workspace_id); const p = await db.query.companyProfiles.findFirst({ where: and(eq(schema.companyProfiles.workspaceId, a.workspace_id), eq(schema.companyProfiles.isCurrent, true)) }); return text(p?.data ?? null); }
    case "generate_content": { const { ws, plan } = await requireWorkspace(actor, a.workspace_id, "editor"); const n = Number(a.count ?? 10); await bumpUsage(ws.accountId, "candidates_generated", n, "day", limits(plan).candidatesPerDay); const prof = await db.query.companyProfiles.findFirst({ where: and(eq(schema.companyProfiles.workspaceId, ws.id), eq(schema.companyProfiles.isCurrent, true)) }); const [b] = await db.insert(schema.generationBatches).values({ workspaceId: ws.id, profileId: prof?.id, source: "api", requestedCount: n, params: { formats: a.formats, language: a.language } }).returning(); await enqueue("generate.batch", { batchId: b.id }); return text({ batch_id: b.id }); }
    case "get_batch": { const b = await db.query.generationBatches.findFirst({ where: eq(schema.generationBatches.id, a.batch_id) }); if (!b) return text({ error: "not found" }); await requireWorkspace(actor, b.workspaceId); const items = await db.select().from(schema.contentItems).where(eq(schema.contentItems.batchId, b.id)); return text({ batch: b, items: items.map((i) => serializeItem(i)) }); }
    case "list_content": { await requireWorkspace(actor, a.workspace_id); const items = await db.select().from(schema.contentItems).where(and(eq(schema.contentItems.workspaceId, a.workspace_id), eq(schema.contentItems.status, (a.status ?? "saved") as schema.ContentStatus))).orderBy(desc(schema.contentItems.createdAt)).limit(Number(a.limit ?? 20)); return text(items.map((i) => serializeItem(i))); }
    case "get_content": { const i = await db.query.contentItems.findFirst({ where: eq(schema.contentItems.id, a.content_item_id) }); if (!i) return text({ error: "not found" }); await requireWorkspace(actor, i.workspaceId); return text(serializeItem(i)); }
    case "list_social_accounts": { await requireWorkspace(actor, a.workspace_id); return text(await db.select({ id: schema.socialAccounts.id, platform: schema.socialAccounts.platform, handle: schema.socialAccounts.handle, status: schema.socialAccounts.status }).from(schema.socialAccounts).where(eq(schema.socialAccounts.workspaceId, a.workspace_id))); }
    case "schedule_post": case "publish_now": { const i = await db.query.contentItems.findFirst({ where: eq(schema.contentItems.id, a.content_item_id) }); if (!i) return text({ error: "not found" }); const { ws, plan } = await requireWorkspace(actor, i.workspaceId, "editor"); assertScheduling(plan); return text(await scheduleItem({ workspace: ws, item: i, socialAccountIds: a.social_account_ids as unknown as string[], scheduledAt: a.scheduled_at ? new Date(a.scheduled_at) : null, queue: false, platformOptions: {}, publishNow: name === "publish_now" })); }
    case "list_scheduled_posts": { await requireWorkspace(actor, a.workspace_id); return text(await db.select({ id: schema.scheduledPosts.id, status: schema.scheduledPosts.status, scheduledAt: schema.scheduledPosts.scheduledAt, permalink: schema.scheduledPosts.permalink, platform: schema.socialAccounts.platform }).from(schema.scheduledPosts).innerJoin(schema.socialAccounts, eq(schema.socialAccounts.id, schema.scheduledPosts.socialAccountId)).where(eq(schema.scheduledPosts.workspaceId, a.workspace_id)).orderBy(desc(schema.scheduledPosts.scheduledAt)).limit(50)); }
    case "get_analytics": { const r = await fetch(`${process.env.APP_URL}/api/v1/workspaces/${a.workspace_id}/analytics?from=${new Date(Date.now() - Number(a.days ?? 30) * 86.4e6).toISOString()}`, { headers: { authorization: req.headers.get("authorization") ?? "" } }); return text(await r.json()); }
    case "list_trends": { const r = await fetch(`${process.env.APP_URL}/api/v1/trends?for_workspace=${a.workspace_id}${a.platform ? `&platform=${a.platform}` : ""}`, { headers: { authorization: req.headers.get("authorization") ?? "" } }); return text(await r.json()); }
    case "get_credits": { const r = await fetch(`${process.env.APP_URL}/api/v1/credits`, { headers: { authorization: req.headers.get("authorization") ?? "" } }); return text(await r.json()); }
    default: return { content: [{ type: "text", text: `Unknown tool ${name}` }], isError: true };
  }
}
export async function POST(req: Request) {
  const msg = await req.json().catch(() => null) as { id?: number | string; method: string; params?: Record<string, unknown> } | null;
  if (!msg?.method) return NextResponse.json({ jsonrpc: "2.0", error: { code: -32600, message: "Invalid request" } }, { status: 400 });
  const reply = (result: unknown) => NextResponse.json({ jsonrpc: "2.0", id: msg.id, result });
  try {
    switch (msg.method) {
      case "initialize": return reply({ protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: process.env.APP_NAME ?? "Velocity", version: "1.0.0" } });
      case "notifications/initialized": case "ping": return reply({});
      case "tools/list": return reply({ tools });
      case "tools/call": { const p = msg.params as { name: string; arguments?: Record<string, never> }; return reply(await call(p.name, p.arguments ?? {}, req)); }
      default: return NextResponse.json({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "Method not found" } });
    }
  } catch (e) { const r = toResponse(e); const j = await r.json(); return NextResponse.json({ jsonrpc: "2.0", id: msg.id, error: { code: -32000, message: j.error?.message ?? "error", data: j.error } }); }
}
export function GET() { return NextResponse.json({ name: process.env.APP_NAME ?? "Velocity", transport: "streamable-http", endpoint: "/api/mcp", auth: "Authorization: Bearer sk_...", tools: tools.map((t) => t.name) }); }
