// Applies drizzle migrations, plus extensions that drizzle-kit does not manage.
import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

async function main() {
  const url = process.env.DATABASE_URL!;
  const ssl = process.env.DATABASE_SSL === "1" || /sslmode=require|supabase|neon|rds\.amazonaws/i.test(url);
  const conn = postgres(url, { max: 1, prepare: false, ssl: ssl ? { rejectUnauthorized: false } : undefined });
  await conn`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`;
  await conn`CREATE EXTENSION IF NOT EXISTS vector`;
  await migrate(drizzle(conn), { migrationsFolder: "./drizzle" });
  await conn`CREATE INDEX IF NOT EXISTS trends_embedding_idx ON trends USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50)`;
  console.log("migrations applied");
  await conn.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
