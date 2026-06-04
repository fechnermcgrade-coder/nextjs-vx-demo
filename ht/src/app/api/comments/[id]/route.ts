import { requireUserFromRequest } from "@/lib/current-user";
import { ok, fail, handleRouteError } from "@/lib/http";
import { repository } from "@/lib/repository";

type Context = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: Request, context: Context) {
  try {
    const user = await requireUserFromRequest(request);
    if (user.role !== "admin") return fail("管理员权限不足", 403);
    const { id } = await context.params;
    await repository.deleteComment(id);
    return ok({ id });
  } catch (error) {
    return handleRouteError(error);
  }
}
