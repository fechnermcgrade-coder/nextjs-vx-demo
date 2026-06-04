import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/current-user";
import { ok, fail, handleRouteError } from "@/lib/http";
import { runAiChat } from "@/lib/ai-provider";
import { buildAdminAiRagContext } from "@/lib/admin-ai-rag";

const schema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(4000)
  })).min(1).max(20)
});

export async function POST(request: Request) {
  try {
    await requireAdminFromRequest(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fail("AI 对话参数不正确");

    const question = parsed.data.messages.at(-1)?.content ?? "";
    const rag = await buildAdminAiRagContext(question);
    return ok({ reply: await runAiChat(parsed.data.messages, rag.context), sources: rag.sources });
  } catch (error) {
    return handleRouteError(error);
  }
}
