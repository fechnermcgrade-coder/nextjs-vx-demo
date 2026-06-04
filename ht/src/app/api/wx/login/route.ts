import { z } from "zod";
import { ok, fail, handleRouteError } from "@/lib/http";
import { getEnv } from "@/lib/env";
import { repository } from "@/lib/repository";
import { signAppToken } from "@/lib/auth";

const schema = z.object({
  code: z.string().min(1)
});

async function resolveOpenid(code: string) {
  const env = getEnv();
  const appid = env.wechatAppId;
  const secret = env.wechatAppSecret;

  if (!appid || !secret || secret === "your-mini-program-app-secret") {
    return `dev-openid-${code.slice(0, 20)}`;
  }

  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.searchParams.set("appid", appid);
  url.searchParams.set("secret", secret);
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", "authorization_code");

  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json() as { openid?: string; errcode?: number; errmsg?: string };
  if (!response.ok || !data.openid) {
    throw new Error(data.errmsg || "微信登录凭证校验失败");
  }
  return data.openid;
}

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fail("登录 code 不能为空");

    const openid = await resolveOpenid(parsed.data.code);
    const user = await repository.findOrCreateWxUser(openid);
    const token = await signAppToken({ sub: user.id, role: user.role });

    return ok({
      token,
      user: repository.publicUser(user)
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
