import { z } from "zod";
import { signAppToken } from "@/lib/auth";
import { ok, fail, handleRouteError } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { repository } from "@/lib/repository";

const schema = z.object({
  email: z.string().email().max(160),
  username: z.string().min(1).max(32).regex(/^[\p{L}\p{N}_-]+$/u),
  password: z.string().min(6).max(80)
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fail("邮箱、用户名或密码格式不正确");

    const email = parsed.data.email.trim().toLowerCase();
    const username = parsed.data.username.trim();
    if (await repository.findUserByEmail(email)) return fail("该邮箱已注册", 409);
    if (await repository.findUserByUsername(username)) return fail("用户名已被占用", 409);

    const user = await repository.createEmailUser({
      email,
      username,
      passwordHash: hashPassword(parsed.data.password)
    });
    const token = await signAppToken({ sub: user.id, role: user.role });
    return ok({ token, user: repository.publicUser(user) }, "注册成功");
  } catch (error) {
    return handleRouteError(error);
  }
}
