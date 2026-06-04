import { requireAdminFromRequest } from "@/lib/current-user";
import { ok, handleRouteError } from "@/lib/http";
import { repository } from "@/lib/repository";

export async function GET(request: Request) {
  try {
    await requireAdminFromRequest(request);

    return ok(await repository.getAdminSummary());
  } catch (error) {
    return handleRouteError(error);
  }
}
