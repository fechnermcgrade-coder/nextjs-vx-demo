import { requireUserFromRequest } from "@/lib/current-user";
import { ok, handleRouteError } from "@/lib/http";
import { repository } from "@/lib/repository";

export async function GET(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    const posts = await repository.listFavoritePosts(user.id);
    return ok({ posts });
  } catch (error) {
    return handleRouteError(error);
  }
}
