import { requireAdminFromRequest } from "@/lib/current-user";
import { ok, handleRouteError } from "@/lib/http";
import { repository } from "@/lib/repository";

export async function GET(request: Request) {
  try {
    await requireAdminFromRequest(request);
    return ok({ recommendations: await repository.listRecommendations() });
  } catch (error) {
    return handleRouteError(error);
  }
}
