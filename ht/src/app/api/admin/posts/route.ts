import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/current-user";
import { ok, fail, handleRouteError } from "@/lib/http";
import { repository } from "@/lib/repository";

const schema = z.object({
  id: z.string().min(1),
  status: z.enum(["draft", "pending", "published"]),
  moderationReason: z.enum(["", "rejected", "takedown"]).optional(),
  moderationNote: z.string().max(500).optional()
});

export async function GET(request: Request) {
  try {
    await requireAdminFromRequest(request);
    const posts = (await repository.listAdminPosts()).filter((post) => post.status !== "draft");
    return ok({ posts });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdminFromRequest(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fail("文章状态参数不正确");

    const before = await repository.getPost(parsed.data.id);
    const post = await repository.updatePost(parsed.data.id, {
      status: parsed.data.status,
      moderationReason: parsed.data.moderationReason ?? "",
      moderationNote: parsed.data.moderationNote ?? ""
    });
    if (!post) return fail("文章不存在", 404);
    if (before) {
      const title = parsed.data.status === "published"
        ? "文章审核通过"
        : parsed.data.moderationReason === "takedown"
          ? "文章已下架待整改"
          : "文章审核未通过";
      const content = parsed.data.status === "published"
        ? `《${post.title}》已通过审核并发布。`
        : parsed.data.moderationNote || `《${post.title}》需要修改后重新提交。`;
      await repository.createNotification({ userId: before.authorId, type: "post", title, content });
    }
    return ok({ post });
  } catch (error) {
    return handleRouteError(error);
  }
}
