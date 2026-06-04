import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/current-user";
import { ok, fail, handleRouteError } from "@/lib/http";
import { runAiTask } from "@/lib/ai-provider";
import { repository } from "@/lib/repository";

const schema = z.object({ commentId: z.string().min(1), content: z.string().optional() });

export async function POST(request: Request) {
  try {
    await requireAdminFromRequest(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fail("评论参数不正确");
    const result = await runAiTask("review", parsed.data.content || parsed.data.commentId);
    const review = await repository.createAiReview({
      targetType: "comment",
      targetId: parsed.data.commentId,
      action: "review",
      score: result.score,
      summary: result.summary
    });
    return ok({ result, review });
  } catch (error) {
    return handleRouteError(error);
  }
}
