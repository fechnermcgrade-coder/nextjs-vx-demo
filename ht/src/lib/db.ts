import { Pool } from "pg";
import type { QueryResultRow } from "pg";
import { getEnv, isDatabaseEnabled } from "@/lib/env";

const globalForDb = globalThis as typeof globalThis & {
  __vitexPgPool?: Pool;
  __vitexPgConnectionString?: string;
};

export function hasDatabase() {
  return isDatabaseEnabled();
}

function getPool() {
  const env = getEnv();
  if (!env.databaseUrl) throw new Error("DATABASE_URL is not configured");

  if (!globalForDb.__vitexPgPool || globalForDb.__vitexPgConnectionString !== env.databaseUrl) {
    globalForDb.__vitexPgPool?.end().catch(() => undefined);
    globalForDb.__vitexPgPool = new Pool({
      connectionString: env.databaseUrl,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
      ssl: env.databaseUrl.includes("sslmode=disable") ? false : { rejectUnauthorized: false }
    });
    globalForDb.__vitexPgConnectionString = env.databaseUrl;
  }

  return globalForDb.__vitexPgPool;
}

export async function query<T extends QueryResultRow>(sql: string, values: unknown[] = []) {
  const result = await getPool().query<T>(sql, values);
  return result.rows;
}
