import { route } from "@/lib/route";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { requireWorkspace } from "@/lib/tenancy";
import { publicUrl, deleteObject } from "@/lib/storage";
export const GET = route(async ({ actor, params }) => { await requireWorkspace(actor, params.id); const rows = await db.select().from(schema.brandAssets).where(eq(schema.brandAssets.workspaceId, params.id)); return { assets: rows.map((a) => ({ ...a, url: publicUrl(a.storageKey) })) }; });
export const DELETE = route(async ({ actor, params, url }) => { await requireWorkspace(actor, params.id, "editor"); const id = url.searchParams.get("assetId")!; const a = await db.query.brandAssets.findFirst({ where: and(eq(schema.brandAssets.id, id), eq(schema.brandAssets.workspaceId, params.id)) }); if (a) { await deleteObject(a.storageKey); await db.delete(schema.brandAssets).where(eq(schema.brandAssets.id, a.id)); } return { ok: true }; });
