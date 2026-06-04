import { requireUserFromRequest } from "@/lib/current-user";
import { ok, fail } from "@/lib/http";
import { repository } from "@/lib/repository";

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  const user = await requireUserFromRequest(request).catch(() => null);
  const post = await repository.recordPostView(user?.id, id);
  if (!post) return fail("文章不存在", 404);
  return ok({ post });
}
