import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/current-user";
import { ok, fail, handleRouteError } from "@/lib/http";
import { repository } from "@/lib/repository";

const schema = z.object({
  id: z.string().min(1),
  status: z.enum(["active", "disabled"])
});

export async function GET(request: Request) {
  try {
    await requireAdminFromRequest(request);
    return ok({ users: await repository.listUsers() });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdminFromRequest(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fail("用户参数不正确");
    return ok({ user: await repository.updateUserStatus(parsed.data.id, parsed.data.status) });
  } catch (error) {
    return handleRouteError(error);
  }
}
