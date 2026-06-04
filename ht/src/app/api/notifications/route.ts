import { z } from "zod";
import { requireUserFromRequest } from "@/lib/current-user";
import { ok, handleRouteError } from "@/lib/http";
import { repository } from "@/lib/repository";

const schema = z.object({
  ids: z.array(z.string()).optional()
});

export async function GET(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    return ok({ notifications: await repository.listNotifications(user.id) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    await repository.markNotificationsRead(user.id, parsed.success ? parsed.data.ids : undefined);
    return ok({ read: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
