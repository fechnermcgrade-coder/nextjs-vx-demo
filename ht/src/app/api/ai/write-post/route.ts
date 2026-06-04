import { z } from "zod";
import { requireUserFromRequest } from "@/lib/current-user";
import { ok, fail, handleRouteError } from "@/lib/http";
import { runAiPostWriter } from "@/lib/ai-provider";

const schema = z.object({ title: z.string().min(2).max(80), content: z.string().max(10000).optional() });

export async function POST(request: Request) {
  try {
    await requireUserFromRequest(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fail("请输入标题后再使用 AI 生文");
    const result = await runAiPostWriter(parsed.data);
    return ok({ result, content: result.content }, result.configured ? "AI 正文已生成" : "AI 未配置，已生成演示正文");
  } catch (error) {
    return handleRouteError(error);
  }
}
