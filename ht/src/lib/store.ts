import type {
  AiReviewResult,
  Category,
  Comment,
  Message,
  Notification,
  Post,
  User
} from "@/types";

type Store = {
  users: User[];
  posts: Post[];
  categories: Category[];
  comments: Comment[];
  messages: Message[];
  notifications: Notification[];
  aiReviews: AiReviewResult[];
  favorites: Array<{ userId: string; postId: string; createdAt: string }>;
  viewHistory: Array<{ userId: string; postId: string; viewedAt: string }>;
};

const now = new Date().toISOString();

const seedCategories: Category[] = [
  { id: "cat-life", name: "生活随笔", color: "#24777b", createdAt: now },
  { id: "cat-tech", name: "技术杂谈", color: "#3c6e71", createdAt: now },
  { id: "cat-ai", name: "AI 灵感", color: "#8a5a44", createdAt: now }
];

const seedUsers: User[] = [
  {
    id: "admin-user",
    email: "admin@test.com",
    username: "admin",
    passwordHash: "",
    nickname: "admin",
    avatarUrl: "",
    bio: "负责内容审核与站点运营。",
    role: "admin",
    status: "active",
    createdAt: now,
    lastLoginAt: now
  },
  {
    id: "demo-user",
    email: "user@test.com",
    username: "user",
    passwordHash: "",
    nickname: "user",
    avatarUrl: "",
    bio: "普通用户账号。",
    role: "user",
    status: "active",
    createdAt: now,
    lastLoginAt: now
  }
];

const seedPosts: Post[] = [
  {
    id: "post-1",
    title: "第一篇社区文章",
    excerpt: "这是用于本地联调的小程序首页文章。",
    content: "欢迎来到 Vitex 社区。这里的内容由微信小程序展示，Next.js 负责 API、业务逻辑、数据库和管理员面板。",
    coverUrl: "",
    categoryId: "cat-life",
    categoryName: "生活随笔",
    tags: ["公告", "起步"],
    status: "published",
    moderationReason: "",
    moderationNote: "",
    authorId: "admin-user",
    authorName: "admin",
    viewCount: 128,
    favoriteCount: 8,
    createdAt: now,
    updatedAt: now
  },
  {
    id: "post-2",
    title: "AI 辅助审核的边界",
    excerpt: "AI 只产出建议和评分，最终发布、拒绝或下架仍由管理员确认。",
    content: "内容审核适合让 AI 做初筛，但 AI 不应该直接拥有无限数据库权限。本项目通过受控 API 写入审核结果，再由管理员确认。",
    coverUrl: "",
    categoryId: "cat-ai",
    categoryName: "AI 灵感",
    tags: ["AI", "审核"],
    status: "published",
    moderationReason: "",
    moderationNote: "",
    authorId: "demo-user",
    authorName: "user",
    viewCount: 82,
    favoriteCount: 5,
    createdAt: now,
    updatedAt: now
  },
  {
    id: "post-3",
    title: "待审核：小程序端文章排版建议",
    excerpt: "这条文章保持 pending 状态，用来验证管理员审核。",
    content: "我希望小程序文章详情页更像阅读器，标题、作者、正文和评论区域能有更清晰的层次。",
    coverUrl: "",
    categoryId: "cat-tech",
    categoryName: "技术杂谈",
    tags: ["小程序", "体验"],
    status: "pending",
    moderationReason: "",
    moderationNote: "",
    authorId: "demo-user",
    authorName: "user",
    viewCount: 29,
    favoriteCount: 1,
    createdAt: now,
    updatedAt: now
  }
];

const seedComments: Comment[] = [
  { id: "comment-1", postId: "post-1", postTitle: "第一篇社区文章", authorId: "demo-user", authorName: "user", content: "首页文章流已经可以看到了。", status: "published", createdAt: now },
  { id: "comment-2", postId: "post-2", postTitle: "AI 辅助审核的边界", authorId: "demo-user", authorName: "user", content: "AI 只做建议这个边界很稳妥。", status: "published", createdAt: now },
  { id: "comment-3", postId: "post-3", postTitle: "待审核：小程序端文章排版建议", authorId: "demo-user", authorName: "user", content: "这条评论用于后台列表检查。", status: "published", createdAt: now }
];

const seedMessages: Message[] = [
  { id: "message-1", senderId: "admin-user", senderName: "admin", receiverId: "demo-user", receiverName: "user", content: "欢迎来到 Vitex 社区，发文后会进入后台审核。", createdAt: now }
];

const seedNotifications: Notification[] = [
  { id: "notice-1", userId: "demo-user", type: "system", title: "欢迎使用 Vitex", content: "小程序展示端和后台 API 已经连接。", createdAt: now }
];

const seedAiReviews: AiReviewResult[] = [
  { id: "ai-1", targetType: "post", targetId: "post-3", action: "review", score: 82, summary: "演示 AI 审核结果：内容风险低，建议人工确认后发布。", status: "pending", createdAt: now }
];

export const store: Store = {
  users: [...seedUsers],
  posts: [...seedPosts],
  categories: [...seedCategories],
  comments: [...seedComments],
  messages: [...seedMessages],
  notifications: [...seedNotifications],
  aiReviews: [...seedAiReviews],
  favorites: [],
  viewHistory: []
};

export function sortDescByCreatedAt<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getCategoryName(id: string) {
  return store.categories.find((item) => item.id === id)?.name ?? "默认分类";
}
