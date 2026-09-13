import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { eq, or, isNull } from "drizzle-orm";
import { requireWorkspace } from "@/lib/tenancy";
import { z } from "zod";
export const GET = route(async ({ actor, url }) => {
  const wsId = url.searchParams.get("workspace_id"); if (wsId) await requireWorkspace(actor, wsId);
  return { templates: await db.select().from(schema.templates).where(wsId ? or(isNull(schema.templates.workspaceId), eq(schema.templates.workspaceId, wsId)) : isNull(schema.templates.workspaceId)) };
});
export const POST = route(async ({ actor, body }) => {
  const b = parse(z.object({ workspace_id: z.string().uuid(), name: z.string().max(80), format: z.string(), spec: z.record(z.any()) }), body);
  await requireWorkspace(actor, b.workspace_id, "editor");
  const [t] = await db.insert(schema.templates).values({ workspaceId: b.workspace_id, name: b.name, format: b.format, spec: b.spec }).returning(); return { template: t };
});
