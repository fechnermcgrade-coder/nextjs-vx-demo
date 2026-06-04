import { z } from "zod";
import { requireUserFromRequest } from "@/lib/current-user";
import { ok, fail, handleRouteError } from "@/lib/http";
import { repository } from "@/lib/repository";

type Context = {
  params: Promise<{ id: string }>;
};

const schema = z.object({
  action: z.enum(["submit", "unpublish"])
});

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireUserFromRequest(request);
    const { id } = await context.params;
    const post = await repository.getPost(id);
    if (!post) return fail("文章不存在", 404);
    if (post.authorId !== user.id && user.role !== "admin") return fail("没有权限操作文章", 403);

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fail("状态操作参数不正确");

    if (parsed.data.action === "submit") {
      if (post.status !== "draft" && post.status !== "rejected") return fail("只有草稿箱内文章可以提交审核", 409);
      const updated = await repository.updatePost(id, { status: "pending", moderationReason: "", moderationNote: "" });
      return ok({ post: updated }, "文章已提交审核");
    }

    if (post.status !== "published") return fail("只有已发布文章可以下架", 409);
    const updated = await repository.updatePost(id, {
      status: "draft",
      moderationReason: "takedown",
      moderationNote: "用户主动下架，已回到草稿箱。"
    });
    return ok({ post: updated }, "文章已下架到草稿箱");
  } catch (error) {
    return handleRouteError(error);
  }
}
