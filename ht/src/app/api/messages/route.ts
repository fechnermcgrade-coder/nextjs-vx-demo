import { z } from "zod";
import { requireUserFromRequest } from "@/lib/current-user";
import { ok, fail, handleRouteError } from "@/lib/http";
import { repository } from "@/lib/repository";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const schema = z.object({
  receiverId: z.string().optional(),
  receiverNickname: z.string().optional(),
  content: z.string().min(1).max(2000)
});

export async function GET(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    const peerId = new URL(request.url).searchParams.get("peerId");
    if (!peerId) return fail("peerId 不能为空");
    if (!uuidPattern.test(peerId)) return fail("会话用户不存在", 404);
    const messages = await repository.listMessages(user.id, peerId);
    await repository.markMessagesRead(user.id, peerId);
    return ok({ messages });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success || (!parsed.data.receiverId && !parsed.data.receiverNickname)) return fail("消息参数不正确");
    if (parsed.data.receiverId && !uuidPattern.test(parsed.data.receiverId)) return fail("收件人不存在", 404);
    return ok({ message: await repository.createMessage({ senderId: user.id, ...parsed.data }) });
  } catch (error) {
    return handleRouteError(error);
  }
}
