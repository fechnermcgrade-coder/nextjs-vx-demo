import { z } from "zod";
import { requireUserFromRequest } from "@/lib/current-user";
import { ok, fail, handleRouteError } from "@/lib/http";
import { runAiChat } from "@/lib/ai-provider";
import { buildUserAiRagContext } from "@/lib/user-ai-rag";

const schema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(2000)
  })).min(1).max(20),
  profile: z.object({
    username: z.string().optional(),
    bio: z.string().optional()
  }).optional()
});

export async function POST(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fail("AI 对话参数不正确");

    const profile = parsed.data.profile;
    const question = parsed.data.messages.at(-1)?.content ?? "";
    const rag = await buildUserAiRagContext(user, question, profile);
    const context = profile
      ? `当前资料：用户名 ${profile.username || "未填写"}，简介 ${profile.bio || "未填写"}。如果用户在编辑资料，请围绕头像、用户名、简介和个人表达给出建议。`
      : "请结合用户可见的社区内容、自己的文章、收藏和浏览历史给出帮助。";
    const messages = [
      { role: "user" as const, content: context },
      ...parsed.data.messages
    ];
    const reply = await runAiChat(messages.slice(-16), rag.context, "user");
    return ok({ reply, sources: rag.sources });
  } catch (error) {
    return handleRouteError(error);
  }
}
