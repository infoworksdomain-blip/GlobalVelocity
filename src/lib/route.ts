import { NextResponse } from "next/server";
import { z } from "zod";
import { toResponse, err } from "@/lib/errors";
import { getActor, type Actor } from "@/lib/tenancy";

type Ctx = { params: Promise<Record<string, string>> };
export type Handler = (args: { req: Request; actor: Actor; params: Record<string, string>; body: unknown; url: URL }) => Promise<unknown>;

/** Wraps a route handler with auth, JSON body parsing, error mapping. */
export function route(h: Handler, opts: { auth?: boolean } = { auth: true }) {
  return async (req: Request, ctx: Ctx) => {
    try {
      const params = await ctx.params;
      const url = new URL(req.url);
      const body = req.method !== "GET" && req.headers.get("content-type")?.includes("application/json") ? await req.json().catch(() => ({})) : undefined;
      const actor = opts.auth === false ? (null as unknown as Actor) : await getActor(req);
      const out = await h({ req, actor, params, body, url });
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e) { return toResponse(e); }
  };
}
export function parse<S extends z.ZodTypeAny>(schema: S, body: unknown): z.output<S> {
  const r = schema.safeParse(body);
  if (!r.success) throw err(400, "VALIDATION", r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  return r.data;
}
export const page = (url: URL) => ({ limit: Math.min(100, Number(url.searchParams.get("limit") ?? 24)), cursor: url.searchParams.get("cursor") });
