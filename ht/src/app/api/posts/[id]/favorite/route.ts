import { requireUserFromRequest } from "@/lib/current-user";
import { ok, fail, handleRouteError } from "@/lib/http";
import { repository } from "@/lib/repository";

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireUserFromRequest(request);
    const { id } = await context.params;
    const post = await repository.favoritePost(user.id, id);
    return ok({ post: { ...post, isFavorited: true } }, "已收藏");
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const user = await requireUserFromRequest(request);
    const { id } = await context.params;
    const isFavorited = await repository.isPostFavorited(user.id, id);
    if (!isFavorited) return fail("当前用户未收藏这篇文章", 409);
    const post = await repository.unfavoritePost(user.id, id);
    return ok({ post: { ...post, isFavorited: false } }, "已取消收藏");
  } catch (error) {
    return handleRouteError(error);
  }
}
