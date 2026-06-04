import { z } from "zod";
import { requireUserFromRequest } from "@/lib/current-user";
import { ok, fail, handleRouteError } from "@/lib/http";
import { repository } from "@/lib/repository";

type Context = {
  params: Promise<{ id: string }>;
};

const schema = z.object({
  content: z.string().min(1).max(1000)
});

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  return ok({ comments: await repository.listComments(id) });
}

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireUserFromRequest(request);
    const { id } = await context.params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fail("评论内容不能为空");
    return ok({ comment: await repository.createComment({ postId: id, authorId: user.id, content: parsed.data.content }) });
  } catch (error) {
    return handleRouteError(error);
  }
}
