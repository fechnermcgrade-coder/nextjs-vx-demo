import { z } from "zod";
import { requireUserFromRequest } from "@/lib/current-user";
import { ok, fail, handleRouteError } from "@/lib/http";
import { repository } from "@/lib/repository";

const schema = z.object({
  username: z.string().min(1).max(32).regex(/^[\p{L}\p{N}_-]+$/u).optional(),
  avatarUrl: z.string().max(3_000_000).optional(),
  bio: z.string().max(160).optional()
});

export async function PUT(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fail("资料格式不正确");

    const username = parsed.data.username?.trim();
    if (username && username.toLowerCase() !== user.username.toLowerCase()) {
      const existing = await repository.findUserByUsername(username);
      if (existing) return fail("用户名已被占用", 409);
    }

    const updated = await repository.updateUserProfile(user.id, {
      username,
      avatarUrl: parsed.data.avatarUrl,
      bio: parsed.data.bio
    });

    return ok({ user: updated ? repository.publicUser(updated) : repository.publicUser(user) }, "资料已保存");
  } catch (error) {
    return handleRouteError(error);
  }
}
