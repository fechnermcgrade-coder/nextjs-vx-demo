export type AppEnv = {
  appUrl: string;
  dataMode: "demo" | "supabase";
  jwtSecret?: string;
  adminUsername: string;
  adminPassword: string;
  wechatAppId?: string;
  wechatAppSecret?: string;
  databaseUrl?: string;
  deepseekApiKey?: string;
  deepseekBaseUrl: string;
  deepseekModel: string;
  openaiApiKey?: string;
  openaiModel: string;
};

function clean(value: string | undefined) {
  if (!value) return undefined;
  if (value.startsWith("your-") || value.startsWith("replace-with-")) return undefined;
  return value;
}

export function getEnv(): AppEnv {
  const databaseUrl = clean(process.env.DATABASE_URL);
  const requestedMode = process.env.DATA_MODE === "supabase" ? "supabase" : "demo";

  return {
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001",
    dataMode: requestedMode === "supabase" && databaseUrl ? "supabase" : "demo",
    jwtSecret: clean(process.env.JWT_SECRET),
    adminUsername: process.env.ADMIN_USERNAME || "admin",
    adminPassword: process.env.ADMIN_PASSWORD || "123123",
    wechatAppId: clean(process.env.WECHAT_APP_ID),
    wechatAppSecret: clean(process.env.WECHAT_APP_SECRET),
    databaseUrl,
    deepseekApiKey: clean(process.env.DEEPSEEK_API_KEY),
    deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    deepseekModel: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    openaiApiKey: clean(process.env.OPENAI_API_KEY),
    openaiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini"
  };
}

export function isDatabaseEnabled() {
  const env = getEnv();
  return env.dataMode === "supabase" && Boolean(env.databaseUrl);
}
