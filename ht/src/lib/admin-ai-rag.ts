import { repository } from "@/lib/repository";
import type { Post } from "@/types";

type RagSource = {
  id: string;
  title: string;
  status: string;
  heatScore: number;
  reason: string;
};

const statusText: Record<string, string> = {
  draft: "草稿",
  pending: "待审核",
  published: "已发布",
  rejected: "已退回"
};

function postHeatScore(post: Post, commentCount: number) {
  return post.viewCount + post.favoriteCount * 5 + commentCount * 3;
}

function tokenize(input: string) {
  return Array.from(new Set(input.toLowerCase().match(/[\u4e00-\u9fa5A-Za-z0-9]{2,}/g) ?? [])).slice(0, 12);
}

function compact(input: string, maxLength: number) {
  const text = input.replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function uniquePosts(posts: Post[]) {
  const seen = new Set<string>();
  return posts.filter((post) => {
    if (seen.has(post.id)) return false;
    seen.add(post.id);
    return true;
  });
}

export async function buildAdminAiRagContext(question: string) {
  const [posts, comments, users, categories, summary] = await Promise.all([
    repository.listAdminPosts(),
    repository.listComments(undefined, true),
    repository.listUsers(),
    repository.listCategories(),
    repository.getAdminSummary()
  ]);

  const commentCounts = comments.reduce<Record<string, number>>((map, comment) => {
    map[comment.postId] = (map[comment.postId] ?? 0) + 1;
    return map;
  }, {});

  const withHeat = posts.map((post) => ({
    post,
    commentCount: commentCounts[post.id] ?? 0,
    heatScore: postHeatScore(post, commentCounts[post.id] ?? 0)
  }));
  const published = withHeat.filter((item) => item.post.status === "published");
  const pending = withHeat.filter((item) => item.post.status === "pending");
  const returned = withHeat.filter((item) => item.post.status === "draft" && item.post.moderationReason);
  const hotPosts = [...published].sort((a, b) => b.heatScore - a.heatScore).slice(0, 8);
  const recentPosts = [...withHeat].sort((a, b) => Date.parse(b.post.createdAt) - Date.parse(a.post.createdAt)).slice(0, 8);

  const keywords = tokenize(question);
  const matchedPosts = withHeat
    .map((item) => {
      const target = [
        item.post.title,
        item.post.excerpt,
        item.post.content,
        item.post.categoryName,
        item.post.authorName,
        item.post.tags.join(" "),
        statusText[item.post.status] ?? item.post.status
      ].join(" ").toLowerCase();
      const score = keywords.reduce((sum, word) => sum + (target.includes(word) ? 1 : 0), 0);
      return { ...item, matchScore: score };
    })
    .filter((item) => item.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore || b.heatScore - a.heatScore)
    .slice(0, 8);

  const selected = uniquePosts([
    ...matchedPosts.map((item) => item.post),
    ...hotPosts.map((item) => item.post),
    ...pending.slice(0, 5).map((item) => item.post),
    ...recentPosts.map((item) => item.post)
  ]).slice(0, 14);

  const selectedRows = selected.map((post, index) => {
    const commentCount = commentCounts[post.id] ?? 0;
    const heatScore = postHeatScore(post, commentCount);
    return [
      `${index + 1}. ${post.title}`,
      `ID: ${post.id}`,
      `状态: ${statusText[post.status] ?? post.status}`,
      `作者: ${post.authorName}`,
      `分类: ${post.categoryName}`,
      `数据: ${post.viewCount} 浏览 / ${post.favoriteCount} 收藏 / ${commentCount} 评论 / 热度 ${heatScore}`,
      `摘要: ${compact(post.excerpt || post.content, 160)}`,
      `正文片段: ${compact(post.content, 520)}`
    ].join("\n");
  });

  const sources: RagSource[] = selected.map((post) => {
    const commentCount = commentCounts[post.id] ?? 0;
    return {
      id: post.id,
      title: post.title,
      status: post.status,
      heatScore: postHeatScore(post, commentCount),
      reason: keywords.length ? "关键词/RAG 匹配或热度补充" : "热度/最近内容补充"
    };
  });

  const context = [
    "以下是 Vitex 管理后台为本次问题实时检索到的数据库上下文。只能基于这些最新数据回答，不要把它当成长期记忆。",
    `检索时间: ${new Date().toISOString()}`,
    "热度计算逻辑: 热度 = 浏览量 + 收藏数 * 5 + 评论数 * 3。",
    `总览: 用户 ${summary.totals.users}，文章 ${summary.totals.posts}，已发布 ${summary.totals.published}，待审 ${summary.totals.pending}，评论 ${summary.totals.comments}，总浏览 ${summary.totals.views}。`,
    `分类: ${categories.map((category) => category.name).join("、") || "暂无分类"}`,
    `最热已发布文章: ${hotPosts.map((item, index) => `${index + 1}. ${item.post.title}（热度 ${item.heatScore}，${item.post.viewCount} 浏览/${item.post.favoriteCount} 收藏/${item.commentCount} 评论）`).join("；") || "暂无已发布文章"}`,
    `待审核文章: ${pending.map((item, index) => `${index + 1}. ${item.post.title}（作者 ${item.post.authorName}）`).join("；") || "暂无待审核文章"}`,
    `已退回/下架待整改文章: ${returned.map((item, index) => `${index + 1}. ${item.post.title}（${item.post.moderationNote || "无备注"}）`).join("；") || "暂无"}`,
    `用户: ${users.map((user) => `${user.nickname}(${user.email || user.username}, ${user.role === "admin" ? "管理员" : "用户"}, ${user.status})`).join("；")}`,
    "RAG 文章片段:",
    selectedRows.join("\n\n") || "没有匹配文章。"
  ].join("\n\n");

  return { context, sources };
}
