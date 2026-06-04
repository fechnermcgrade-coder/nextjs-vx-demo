import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/current-user";
import { ok, fail, handleRouteError } from "@/lib/http";
import { repository } from "@/lib/repository";

const schema = z.object({
  id: z.string().min(1),
  status: z.enum(["pending", "confirmed", "dismissed"])
});

export async function GET(request: Request) {
  try {
    await requireAdminFromRequest(request);
    return ok({ reviews: await repository.listAiReviews() });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdminFromRequest(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fail("AI 结果参数不正确");
    return ok({ review: await repository.updateAiReviewStatus(parsed.data.id, parsed.data.status) });
  } catch (error) {
    return handleRouteError(error);
  }
}
