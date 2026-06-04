import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/current-user";
import { ok, fail, handleRouteError } from "@/lib/http";
import { runAiTitle } from "@/lib/ai-provider";

const schema = z.object({
  question: z.string().min(1).max(1000)
});

export async function POST(request: Request) {
  try {
    await requireAdminFromRequest(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fail("标题生成参数不正确");

    return ok({ title: await runAiTitle(parsed.data.question) });
  } catch (error) {
    return handleRouteError(error);
  }
}
