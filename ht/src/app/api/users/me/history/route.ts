import { requireUserFromRequest } from "@/lib/current-user";
import { ok, handleRouteError } from "@/lib/http";
import { repository } from "@/lib/repository";

export async function GET(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    const posts = await repository.listViewHistoryPosts(user.id);
    return ok({ posts });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    await repository.clearViewHistory(user.id);
    return ok({ cleared: true }, "浏览历史已清空");
  } catch (error) {
    return handleRouteError(error);
  }
}
