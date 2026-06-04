import { fail } from "@/lib/http";
import { readBearerToken, verifyAppToken } from "@/lib/auth";
import { repository } from "@/lib/repository";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function requireUserFromRequest(request: Request) {
  const token = readBearerToken(request);
  if (!token) throw fail("未登录或权限不足", 401);

  const payload = await verifyAppToken(token);
  if (!payload) throw fail("未登录或权限不足", 401);
  if (!uuidPattern.test(payload.sub)) throw fail("登录状态已失效，请重新登录", 401);

  const user = await repository.getUserById(payload.sub);
  if (!user) throw fail("用户不存在或已停用", 401);
  return user;
}

export async function requireAdminFromRequest(request: Request) {
  const user = await requireUserFromRequest(request);
  if (user.role !== "admin") throw fail("管理员权限不足", 403);
  return user;
}
