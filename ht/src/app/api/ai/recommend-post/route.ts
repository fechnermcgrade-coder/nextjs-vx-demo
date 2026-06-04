import { z } from "zod";
import { ok, fail, handleRouteError } from "@/lib/http";
import { runAiTask } from "@/lib/ai-provider";
import { repository } from "@/lib/repository";

const schema = z.object({
  postId: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fail("postId 不能为空");

    const post = await repository.getPost(parsed.data.postId);
    if (!post || post.status !== "published") return fail("文章不存在或未发布", 404);

    const result = await runAiTask("recommendation", `${post.title}\n${post.excerpt}\n${post.content}`);
    const summary = result.summary.toLowerCase();
    const maliciousRisk = /恶意|诈骗|欺诈|违法|犯罪|仇恨|人身攻击|骚扰|辱骂|诱导|煽动|垃圾内容|高风险|违规内容|不建议推荐|建议不推荐/.test(summary);
    const risk = maliciousRisk || result.score < 40;
    const recommendation = risk ? "not_recommended" : "recommended";

    return ok({ result: { ...result, recommendation } });
  } catch (error) {
    return handleRouteError(error);
  }
}
