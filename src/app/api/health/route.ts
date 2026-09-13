import { NextResponse } from "next/server";
import { sql } from "@/db";
import { connection } from "@/lib/queue";
/** Liveness/readiness for load balancers and uptime monitors. */
export async function GET() {
  const checks: Record<string, "ok" | "fail"> = {};
  try { await sql`select 1`; checks.postgres = "ok"; } catch { checks.postgres = "fail"; }
  try { checks.redis = (await connection.ping()) === "PONG" ? "ok" : "fail"; } catch { checks.redis = "fail"; }
  const ok = Object.values(checks).every((v) => v === "ok");
  return NextResponse.json({ status: ok ? "ok" : "degraded", checks, mode: process.env.PROVIDER_MODE ?? "mock", version: process.env.APP_VERSION ?? "dev" }, { status: ok ? 200 : 503 });
}
export const dynamic = "force-dynamic";
