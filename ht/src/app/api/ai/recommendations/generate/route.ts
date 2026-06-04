import { requireAdminFromRequest } from "@/lib/current-user";
import { ok, handleRouteError } from "@/lib/http";
import { runAiTask } from "@/lib/ai-provider";
import { repository } from "@/lib/repository";

export async function POST(request: Request) {
  try {
    await requireAdminFromRequest(request);
    const recommendations = await repository.listRecommendations();
    const result = await runAiTask("recommendation", JSON.stringify(recommendations));
    return ok({ result, recommendations });
  } catch (error) {
    return handleRouteError(error);
  }
}
