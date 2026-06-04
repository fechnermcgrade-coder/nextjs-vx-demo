import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { hasDatabase, query } from "@/lib/db";

export const dynamic = "force-dynamic";

const requiredTables = [
  "users",
  "categories",
  "posts",
  "comments",
  "messages",
  "notifications",
  "ai_review_results"
];

export async function GET() {
  const env = getEnv();
  const result = {
    ok: true,
    app: "vitex-admin-api",
    appUrl: env.appUrl,
    dataMode: env.dataMode,
    env: {
      databaseUrl: Boolean(env.databaseUrl),
      jwtSecret: Boolean(env.jwtSecret),
      wechatAppId: Boolean(env.wechatAppId),
      wechatAppSecret: Boolean(env.wechatAppSecret),
      deepseekApiKey: Boolean(env.deepseekApiKey),
      openaiApiKey: Boolean(env.openaiApiKey)
    },
    aiProvider: env.deepseekApiKey ? "deepseek" : env.openaiApiKey ? "openai" : "demo",
    database: {
      enabled: hasDatabase(),
      connected: false,
      tables: Object.fromEntries(requiredTables.map((table) => [table, false])) as Record<string, boolean>,
      error: ""
    }
  };

  if (!hasDatabase()) {
    return NextResponse.json(result);
  }

  try {
    await query("select 1");
    const rows = await query<{ table_name: string }>(
      `select table_name
       from information_schema.tables
       where table_schema = 'public' and table_name = any($1::text[])`,
      [requiredTables]
    );
    const existing = new Set(rows.map((row) => row.table_name));
    result.database.connected = true;
    result.database.tables = Object.fromEntries(requiredTables.map((table) => [table, existing.has(table)]));
    result.ok = requiredTables.every((table) => result.database.tables[table]);
  } catch (error) {
    result.ok = false;
    result.database.error = error instanceof Error ? error.message : "Database health check failed";
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
