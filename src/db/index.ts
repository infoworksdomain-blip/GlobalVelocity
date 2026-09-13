import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Postgres connection.
 * - Managed providers (Neon, Supabase, RDS) require TLS: set `?sslmode=require` in DATABASE_URL, or DATABASE_SSL=1.
 * - Serverless/edge deployments must use a pooled connection string (PgBouncer). Keep PGBOUNCER=1 so prepared
 *   statements stay off and the per-instance pool stays small.
 */
const url = process.env.DATABASE_URL ?? "postgres://velocity:velocity@localhost:5432/velocity";
const wantsSsl = process.env.DATABASE_SSL === "1" || /sslmode=require|supabase|neon|rds\.amazonaws/i.test(url);
const pooled = process.env.PGBOUNCER === "1" || /pgbouncer=true|-pooler\./i.test(url);

const globalForDb = globalThis as unknown as { sql?: ReturnType<typeof postgres> };
export const sql = globalForDb.sql ?? postgres(url, {
  max: Number(process.env.DB_POOL_MAX ?? (pooled ? 5 : 10)),
  idle_timeout: Number(process.env.DB_IDLE_TIMEOUT ?? 30),
  connect_timeout: Number(process.env.DB_CONNECT_TIMEOUT ?? 15),
  prepare: false,
  ssl: wantsSsl ? { rejectUnauthorized: false } : undefined,
  onnotice: () => {},
});
if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;
export const db = drizzle(sql, { schema });
export type Db = typeof db;
export { schema };
