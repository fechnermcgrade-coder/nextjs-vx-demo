import { ok, handleRouteError } from "@/lib/http";
import { requireUserFromRequest } from "@/lib/current-user";
import { repository } from "@/lib/repository";

export async function GET(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    return ok({ user: repository.publicUser(user) });
  } catch (error) {
    return handleRouteError(error);
  }
}
