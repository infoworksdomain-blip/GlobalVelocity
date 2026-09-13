import { route, parse } from "@/lib/route";
import { db, schema } from "@/db";
import { and, eq, desc } from "drizzle-orm";
import { requireWorkspace } from "@/lib/tenancy";
import { enqueue } from "@/lib/queue";
import { profileEmbedding } from "@/lib/generation";
import { moderateText } from "@/lib/llm";
import { err } from "@/lib/errors";
import { z } from "zod";

export const GET = route(async ({ actor, params, url }) => {
  await requireWorkspace(actor, params.id);
  if (url.searchParams.get("versions")) return { versions: await db.select({ id: schema.companyProfiles.id, version: schema.companyProfiles.version, isCurrent: schema.companyProfiles.isCurrent, source: schema.companyProfiles.source, createdAt: schema.companyProfiles.createdAt }).from(schema.companyProfiles).where(eq(schema.companyProfiles.workspaceId, params.id)).orderBy(desc(schema.companyProfiles.version)) };
  const p = await db.query.companyProfiles.findFirst({ where: and(eq(schema.companyProfiles.workspaceId, params.id), eq(schema.companyProfiles.isCurrent, true)) });
  return { profile: p ? { id: p.id, version: p.version, websiteUrl: p.websiteUrl, source: p.source, data: p.data } : null };
});
/** POST = start crawl+analysis job (FR-3.1); returns job id to poll at /v1/jobs/:id */
export const POST = route(async ({ actor, params, body }) => {
  await requireWorkspace(actor, params.id, "editor");
  const b = parse(z.object({ url: z.string().min(4) }), body);
  if (moderateText(b.url).status === "blocked") throw err(422, "URL_BLOCKED", "This website cannot be used");
  const [job] = await db.insert(schema.jobs).values({ workspaceId: params.id, type: "profile.analyze" }).returning();
  await enqueue("profile.analyze", { jobId: job.id, workspaceId: params.id, url: b.url });
  return { job_id: job.id };
});
/** PUT = replace profile (creates a new version, FR-3.2) */
export const PUT = route(async ({ actor, params, body }) => {
  await requireWorkspace(actor, params.id, "editor");
  const b = parse(z.object({ data: z.record(z.any()) }), body);
  const data = b.data as schema.CompanyProfileData;
  await db.update(schema.companyProfiles).set({ isCurrent: false }).where(eq(schema.companyProfiles.workspaceId, params.id));
  const prev = await db.query.companyProfiles.findFirst({ where: eq(schema.companyProfiles.workspaceId, params.id), orderBy: desc(schema.companyProfiles.version) });
  const [p] = await db.insert(schema.companyProfiles).values({ workspaceId: params.id, version: (prev?.version ?? 0) + 1, isCurrent: true, websiteUrl: data.website_url ?? prev?.websiteUrl ?? "", data, embedding: profileEmbedding(data), source: "edit" }).returning();
  if (data.product_name) await db.update(schema.workspaces).set({ name: data.product_name }).where(eq(schema.workspaces.id, params.id));
  return { profile: { id: p.id, version: p.version, data: p.data } };
});
