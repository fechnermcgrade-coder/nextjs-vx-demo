import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/current-user";
import { ok, fail, handleRouteError } from "@/lib/http";
import { runAiTask } from "@/lib/ai-provider";
import { repository } from "@/lib/repository";

const schema = z.object({
  postId: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    await requireAdminFromRequest(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fail("postId 不能为空");

    const post = await repository.getPost(parsed.data.postId);
    if (!post) return fail("文章不存在", 404);
    if (post.status !== "pending") return fail("只有待审核文章可以执行 AI 审核", 400);

    const result = await runAiTask("review", `${post.title}\n${post.content}`);
    const summary = result.summary.toLowerCase();
    const maliciousRisk = /恶意|诈骗|欺诈|违法|犯罪|仇恨|人身攻击|骚扰|辱骂|诱导|煽动|垃圾内容|高风险|违规内容|建议不通过/.test(summary);
    const suggestion = maliciousRisk || result.score < 40 ? "reject" : "pass";
    const review = await repository.createAiReview({
      targetType: "post",
      targetId: post.id,
      action: "review",
      score: result.score,
      summary: result.summary
    });

    return ok({ result: { ...result, suggestion }, review });
  } catch (error) {
    return handleRouteError(error);
  }
}
