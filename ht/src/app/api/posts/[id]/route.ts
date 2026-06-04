import { z } from "zod";
import { requireUserFromRequest } from "@/lib/current-user";
import { ok, fail, handleRouteError } from "@/lib/http";
import { repository } from "@/lib/repository";

type Context = {
  params: Promise<{ id: string }>;
};

const updateSchema = z.object({
  title: z.string().min(2).max(80).optional(),
  content: z.string().min(5).max(10000).optional(),
  coverUrl: z.string().max(3_000_000).optional(),
  categoryId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  submit: z.boolean().optional()
});

export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const tokenUser = await requireUserFromRequest(request).catch(() => null);
    const post = await repository.getPost(id);
    if (!post) return fail("文章不存在", 404);
    if (post.status !== "published" && post.authorId !== tokenUser?.id && tokenUser?.role !== "admin") {
      return fail("没有权限查看文章", 403);
    }

    const nextPost = post.status === "published" ? await repository.recordPostView(tokenUser?.id, id) : post;
    const isFavorited = await repository.isPostFavorited(tokenUser?.id, id);
    return ok({ post: { ...nextPost, isFavorited } });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    const user = await requireUserFromRequest(request);
    const { id } = await context.params;
    const post = await repository.getPost(id);
    if (!post) return fail("文章不存在", 404);
    if (post.authorId !== user.id && user.role !== "admin") return fail("没有权限修改文章", 403);
    if (user.role !== "admin" && post.status === "pending") return fail("审核中文章不可编辑", 409);
    if (user.role !== "admin" && post.status === "published") return fail("已发布文章请先下架到草稿箱后再修改", 409);

    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return fail("文章参数不正确");

    const nextStatus: typeof post.status = parsed.data.submit ? "pending" : post.status === "rejected" ? "draft" : post.status;
    const updated = await repository.updatePost(id, {
      title: parsed.data.title,
      content: parsed.data.content,
      coverUrl: parsed.data.coverUrl,
      categoryId: parsed.data.categoryId,
      tags: parsed.data.tags,
      status: nextStatus,
      moderationReason: parsed.data.submit ? "" : post.moderationReason,
      moderationNote: parsed.data.submit ? "" : post.moderationNote
    });
    return ok({ post: updated }, parsed.data.submit ? "文章已提交审核" : "文章已保存");
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const user = await requireUserFromRequest(request);
    const { id } = await context.params;
    const post = await repository.getPost(id);
    if (!post) return fail("文章不存在", 404);
    if (post.authorId !== user.id && user.role !== "admin") return fail("没有权限删除文章", 403);
    if (user.role !== "admin" && post.status !== "draft" && post.status !== "rejected") return fail("只能删除草稿箱内文章", 409);

    await repository.deletePost(id);
    return ok({ id }, "文章已删除");
  } catch (error) {
    return handleRouteError(error);
  }
}
