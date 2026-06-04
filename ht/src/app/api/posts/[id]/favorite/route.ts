import { requireUserFromRequest } from "@/lib/current-user";
import { ok, handleRouteError } from "@/lib/http";
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
    const post = await repository.unfavoritePost(user.id, id);
    return ok({ post: { ...post, isFavorited: false } }, "已取消收藏");
  } catch (error) {
    return handleRouteError(error);
  }
}
