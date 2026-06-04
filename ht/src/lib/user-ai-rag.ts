import { repository } from "@/lib/repository";
import type { Post, User } from "@/types";

const statusText: Record<string, string> = {
  draft: "草稿",
  pending: "审核中",
  published: "已发布",
  rejected: "已退回"
};

function tokenize(input: string) {
  return Array.from(new Set(input.toLowerCase().match(/[\u4e00-\u9fa5A-Za-z0-9]{2,}/g) ?? [])).slice(0, 10);
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

function matchPosts(posts: Post[], question: string) {
  const keywords = tokenize(question);
  if (!keywords.length) return [];
  return posts
    .map((post) => {
      const target = [
        post.title,
        post.excerpt,
        post.content,
        post.categoryName,
        post.authorName,
        post.tags.join(" "),
        statusText[post.status] ?? post.status
      ].join(" ").toLowerCase();
      const score = keywords.reduce((sum, word) => sum + (target.includes(word) ? 1 : 0), 0);
      return { post, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || (b.post.viewCount + b.post.favoriteCount * 5) - (a.post.viewCount + a.post.favoriteCount * 5))
    .map((item) => item.post)
    .slice(0, 8);
}

function describePost(post: Post, label: string) {
  return [
    `${label}: ${post.title}`,
    `ID: ${post.id}`,
    `状态: ${statusText[post.status] ?? post.status}`,
    `作者: ${post.authorName}`,
    `分类: ${post.categoryName}`,
    `数据: ${post.viewCount} 浏览 / ${post.favoriteCount} 收藏`,
    `摘要: ${compact(post.excerpt || post.content, 140)}`,
    `正文片段: ${compact(post.content, 420)}`,
    post.moderationNote ? `处理备注: ${post.moderationNote}` : ""
  ].filter(Boolean).join("\n");
}

export async function buildUserAiRagContext(user: User, question: string, profile?: { username?: string; bio?: string }) {
  const [publishedPosts, ownPosts, favoritePosts, historyPosts, categories] = await Promise.all([
    repository.listPublishedPosts(),
    repository.listUserPosts(user.id),
    repository.listFavoritePosts(user.id),
    repository.listViewHistoryPosts(user.id),
    repository.listCategories()
  ]);

  const hotPublished = [...publishedPosts]
    .sort((a, b) => (b.viewCount + b.favoriteCount * 5) - (a.viewCount + a.favoriteCount * 5))
    .slice(0, 8);
  const matched = matchPosts([...publishedPosts, ...ownPosts, ...favoritePosts, ...historyPosts], question);
  const selected = uniquePosts([
    ...matched,
    ...historyPosts.slice(0, 5),
    ...favoritePosts.slice(0, 5),
    ...ownPosts.slice(0, 6),
    ...hotPublished
  ]).slice(0, 14);

  const context = [
    "以下是 Vitex 小程序普通用户 AI 助手为本次问题实时检索到的只读上下文。你正在和普通用户聊天，不是管理员。",
    `检索时间: ${new Date().toISOString()}`,
    "权限边界: 只能基于公开已发布文章、当前用户自己的文章、当前用户自己的收藏和浏览历史回答。不能声称能查看后台、审核队列、其他用户草稿或执行管理操作。",
    `当前用户: ${user.nickname}（@${user.username}，${user.email || "无邮箱"}）。`,
    `当前资料编辑上下文: 用户名 ${profile?.username || user.username || "未填写"}，简介 ${profile?.bio || user.bio || "未填写"}。`,
    `社区分类: ${categories.map((category) => category.name).join("、") || "暂无分类"}`,
    `公开最热文章: ${hotPublished.map((post, index) => `${index + 1}. ${post.title}（${post.viewCount} 浏览/${post.favoriteCount} 收藏）`).join("；") || "暂无公开文章"}`,
    `我的收藏: ${favoritePosts.slice(0, 8).map((post, index) => `${index + 1}. ${post.title}`).join("；") || "暂无收藏"}`,
    `我的浏览历史: ${historyPosts.slice(0, 8).map((post, index) => `${index + 1}. ${post.title}`).join("；") || "暂无浏览历史"}`,
    `我的文章: ${ownPosts.slice(0, 8).map((post, index) => `${index + 1}. ${post.title}（${statusText[post.status] ?? post.status}）`).join("；") || "暂无文章"}`,
    "RAG 文章片段:",
    selected.map((post, index) => describePost(post, `${index + 1}`)).join("\n\n") || "没有匹配文章。"
  ].join("\n\n");

  return {
    context,
    sources: selected.map((post) => ({ id: post.id, title: post.title, status: post.status }))
  };
}
