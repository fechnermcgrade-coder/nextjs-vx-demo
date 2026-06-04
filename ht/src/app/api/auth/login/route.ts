import { z } from "zod";
import { signAppToken } from "@/lib/auth";
import { ok, fail, handleRouteError } from "@/lib/http";
import { verifyPassword } from "@/lib/password";
import { repository } from "@/lib/repository";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fail("请输入正确的邮箱和密码");

    const user = await repository.findUserByEmail(parsed.data.email);
    if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
      return fail("邮箱或密码错误", 401);
    }

    const token = await signAppToken({ sub: user.id, role: user.role });
    return ok({ token, user: repository.publicUser(user) }, "登录成功");
  } catch (error) {
    return handleRouteError(error);
  }
}
