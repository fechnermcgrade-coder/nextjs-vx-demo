import { requireUserFromRequest } from "@/lib/current-user";
import { ok, handleRouteError } from "@/lib/http";
import { repository } from "@/lib/repository";

export async function GET(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    return ok({ threads: await repository.listMessageThreads(user.id) });
  } catch (error) {
    return handleRouteError(error);
  }
}
