import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/current-user";
import { ok, fail, handleRouteError } from "@/lib/http";
import { runAiTask } from "@/lib/ai-provider";
import { repository } from "@/lib/repository";

const schema = z.object({ postId: z.string().optional(), content: z.string().optional() });

export async function POST(request: Request) {
  try {
    await requireAdminFromRequest(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fail("参数不正确");
    const post = parsed.data.postId ? await repository.getPost(parsed.data.postId) : null;
    const result = await runAiTask("summary", parsed.data.content || post?.content || "");
    return ok({ result, summary: result.summary });
  } catch (error) {
    return handleRouteError(error);
  }
}
