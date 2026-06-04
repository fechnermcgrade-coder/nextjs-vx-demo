import { z } from "zod";
import { requireUserFromRequest } from "@/lib/current-user";
import { ok, fail, handleRouteError } from "@/lib/http";
import { repository } from "@/lib/repository";
import type { Post, PostStatus } from "@/types";

const schema = z.object({
  title: z.string().min(2).max(80),
  content: z.string().min(5).max(10000),
  coverUrl: z.string().max(3_000_000).optional(),
  categoryId: z.string().optional(),
  submit: z.boolean().default(true)
});

const statusSchema = z.enum(["draft", "pending", "published", "rejected"]);

async function addCommentCounts(posts: Post[]) {
  const comments = await repository.listComments(undefined, true);
  const counts = comments.reduce<Record<string, number>>((map, comment) => {
    map[comment.postId] = (map[comment.postId] ?? 0) + 1;
    return map;
  }, {});
  return posts.map((post) => ({ ...post, commentCount: counts[post.id] ?? 0 }));
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const mine = url.searchParams.get("mine") === "1";
    if (!mine) return ok({ posts: await addCommentCounts(await repository.listPublishedPosts()) });

    const user = await requireUserFromRequest(request);
    const rawStatus = url.searchParams.get("status");
    const status = rawStatus && statusSchema.safeParse(rawStatus).success ? rawStatus as PostStatus : undefined;
    return ok({ posts: await addCommentCounts(await repository.listUserPosts(user.id, status)) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fail("文章标题或内容不符合要求");

    const post = await repository.createPost({
      title: parsed.data.title,
      content: parsed.data.content,
      coverUrl: parsed.data.coverUrl,
      categoryId: parsed.data.categoryId,
      authorId: user.id,
      submit: parsed.data.submit
    });

    return ok({ post }, parsed.data.submit ? "文章已提交审核" : "草稿已保存");
  } catch (error) {
    return handleRouteError(error);
  }
}
