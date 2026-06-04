import { hasDatabase, query } from "@/lib/db";
import { store, sortDescByCreatedAt, getCategoryName } from "@/lib/store";
import type {
  AdminSummary,
  AiReviewResult,
  Category,
  Comment,
  CommentStatus,
  Message,
  MessageThread,
  Notification,
  Post,
  PostStatus,
  PublicUser,
  User,
  UserStatus
} from "@/types";

type DbUser = {
  id: string;
  openid: string | null;
  email: string | null;
  username: string | null;
  password_hash: string | null;
  nickname: string;
  avatar_url: string | null;
  bio: string | null;
  role: "user" | "admin";
  status: UserStatus;
  created_at: string;
  last_login_at: string | null;
};

type DbCategory = {
  id: string;
  name: string;
  color: string;
  created_at: string;
};

type DbPost = {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  cover_url: string | null;
  category_id: string;
  category_name: string | null;
  tags: string[] | null;
  status: PostStatus;
  moderation_reason: "rejected" | "takedown" | "" | null;
  moderation_note: string | null;
  author_id: string;
  author_name: string | null;
  view_count: number;
  favorite_count: number;
  created_at: string;
  updated_at: string;
};

type DbComment = {
  id: string;
  post_id: string;
  post_title: string | null;
  author_id: string;
  author_name: string | null;
  content: string;
  status: CommentStatus;
  created_at: string;
};

type DbMessage = {
  id: string;
  sender_id: string;
  sender_name: string | null;
  receiver_id: string;
  receiver_name: string | null;
  content: string;
  read_at: string | null;
  created_at: string;
};

type DbNotification = {
  id: string;
  user_id: string;
  type: Notification["type"];
  title: string;
  content: string;
  read_at: string | null;
  created_at: string;
};

type DbAiReview = {
  id: string;
  target_type: AiReviewResult["targetType"];
  target_id: string;
  action: string;
  score: number;
  summary: string;
  status: AiReviewResult["status"];
  created_at: string;
};

type DbPostJoin = DbPost & {
  relation_created_at?: string;
  relation_viewed_at?: string;
};

async function ensureViewHistoryTable() {
  if (!hasDatabase()) return;
  await query(`
    create table if not exists view_history (
      user_id uuid not null references users(id) on delete cascade,
      post_id uuid not null references posts(id) on delete cascade,
      viewed_at timestamptz not null default now(),
      primary key (user_id, post_id)
    )
  `);
  await query("alter table view_history enable row level security");
  await query("create index if not exists view_history_user_viewed_at_idx on view_history (user_id, viewed_at desc)");
}

let notificationsTableReady = false;
async function ensureNotificationsTable() {
  if (!hasDatabase() || notificationsTableReady) return;
  try {
    await query("create extension if not exists pgcrypto");
  } catch {
    // Some hosted database roles cannot create extensions; existing UUID defaults can still work.
  }
  await query(`
    create table if not exists notifications (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references users(id) on delete cascade,
      type text not null default 'system',
      title text not null,
      content text not null,
      read_at timestamptz,
      created_at timestamptz not null default now()
    )
  `);
  await query("alter table notifications enable row level security");
  await query("create index if not exists notifications_user_created_at_idx on notifications (user_id, created_at desc)");
  notificationsTableReady = true;
}

function toUser(row: DbUser): User {
  return {
    id: row.id,
    openid: row.openid ?? undefined,
    email: row.email ?? undefined,
    username: row.username ?? row.nickname,
    passwordHash: row.password_hash ?? "",
    nickname: row.nickname,
    avatarUrl: row.avatar_url ?? "",
    bio: row.bio ?? "",
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at ?? undefined
  };
}

function toCategory(row: DbCategory): Category {
  return { id: row.id, name: row.name, color: row.color, createdAt: row.created_at };
}

function toPost(row: DbPost): Post {
  return {
    id: row.id,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    coverUrl: row.cover_url ?? "",
    categoryId: row.category_id,
    categoryName: row.category_name ?? "未分类",
    tags: row.tags ?? [],
    status: row.status,
    authorId: row.author_id,
    authorName: row.author_name ?? "未知用户",
    viewCount: row.view_count,
    favoriteCount: row.favorite_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toComment(row: DbComment): Comment {
  return {
    id: row.id,
    postId: row.post_id,
    postTitle: row.post_title ?? "未知文章",
    authorId: row.author_id,
    authorName: row.author_name ?? "未知用户",
    content: row.content,
    status: row.status,
    createdAt: row.created_at
  };
}

function toMessage(row: DbMessage): Message {
  return {
    id: row.id,
    senderId: row.sender_id,
    senderName: row.sender_name ?? "未知用户",
    receiverId: row.receiver_id,
    receiverName: row.receiver_name ?? "未知用户",
    content: row.content,
    readAt: row.read_at ?? undefined,
    createdAt: row.created_at
  };
}

function toNotification(row: DbNotification): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    content: row.content,
    readAt: row.read_at ?? undefined,
    createdAt: row.created_at
  };
}

function toAiReview(row: DbAiReview): AiReviewResult {
  return {
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    action: row.action,
    score: row.score,
    summary: row.summary,
    status: row.status,
    createdAt: row.created_at
  };
}

export function publicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    role: user.role
  };
}

function makeExcerpt(content: string) {
  return content.trim().slice(0, 100);
}

async function countTable(table: string) {
  const rows = await query<{ count: string }>(`select count(*)::text as count from ${table}`);
  return Number(rows[0]?.count ?? 0);
}

let messagesTableReady = false;

async function ensureMessagesTable() {
  if (!hasDatabase() || messagesTableReady) return;
  try {
    await query("create extension if not exists pgcrypto");
  } catch {
    // Supabase projects usually have pgcrypto ready; limited roles may not be allowed to create extensions.
  }
  await query(`
    create table if not exists messages (
      id uuid primary key default gen_random_uuid(),
      sender_id uuid not null references users(id) on delete cascade,
      sender_name text not null default '未知用户',
      receiver_id uuid not null references users(id) on delete cascade,
      receiver_name text not null default '未知用户',
      content text not null,
      read_at timestamptz,
      created_at timestamptz not null default now()
    )
  `);
  await query("alter table messages add column if not exists sender_name text not null default '未知用户'");
  await query("alter table messages add column if not exists receiver_name text not null default '未知用户'");
  await query("alter table messages add column if not exists read_at timestamptz");
  await query("alter table messages add column if not exists created_at timestamptz not null default now()");
  await query("create index if not exists messages_participants_created_at_idx on messages (sender_id, receiver_id, created_at desc)");
  messagesTableReady = true;
}

export const repository = {
  publicUser,

  async getUserById(id: string) {
    if (hasDatabase()) {
      const rows = await query<DbUser>("select * from users where id = $1 and status = 'active' limit 1", [id]);
      return rows[0] ? toUser(rows[0]) : null;
    }
    return store.users.find((user) => user.id === id && user.status === "active") ?? null;
  },

  async findUserByEmail(email: string) {
    if (hasDatabase()) {
      const rows = await query<DbUser>("select * from users where lower(email) = lower($1) and status = 'active' limit 1", [email]);
      return rows[0] ? toUser(rows[0]) : null;
    }
    return store.users.find((user) => user.email?.toLowerCase() === email.toLowerCase() && user.status === "active") ?? null;
  },

  async findUserByUsername(username: string) {
    if (hasDatabase()) {
      const rows = await query<DbUser>("select * from users where lower(username) = lower($1) and status = 'active' limit 1", [username]);
      return rows[0] ? toUser(rows[0]) : null;
    }
    return store.users.find((user) => user.username.toLowerCase() === username.toLowerCase() && user.status === "active") ?? null;
  },

  async findUserByNickname(nickname: string) {
    return this.findUserByUsername(nickname);
  },

  async createEmailUser(input: { email: string; username: string; passwordHash: string }) {
    const timestamp = new Date().toISOString();
    if (hasDatabase()) {
      const rows = await query<DbUser>(
        `insert into users (email, username, password_hash, nickname, avatar_url, bio, role, status, created_at, last_login_at)
         values ($1, $2, $3, $2, '', '', 'user', 'active', now(), now())
         returning *`,
        [input.email, input.username, input.passwordHash]
      );
      return toUser(rows[0]);
    }

    const user: User = {
      id: `user-${crypto.randomUUID()}`,
      email: input.email,
      username: input.username,
      passwordHash: input.passwordHash,
      nickname: input.username,
      avatarUrl: "",
      bio: "",
      role: "user",
      status: "active",
      createdAt: timestamp,
      lastLoginAt: timestamp
    };
    store.users.push(user);
    return user;
  },

  async findOrCreateWxUser(openid: string) {
    const timestamp = new Date().toISOString();
    if (hasDatabase()) {
      const existing = await query<DbUser>("select * from users where openid = $1 limit 1", [openid]);
      if (existing[0]) {
        const updated = await query<DbUser>("update users set last_login_at = now() where id = $1 returning *", [existing[0].id]);
        return toUser(updated[0] ?? existing[0]);
      }
      const inserted = await query<DbUser>(
        `insert into users (openid, email, username, password_hash, nickname, avatar_url, bio, role, status, last_login_at)
         values ($1, null, $2, '', $2, '', '', 'user', 'active', now())
         returning *`,
        [openid, `wx-${openid.slice(0, 12)}`]
      );
      return toUser(inserted[0]);
    }

    const existing = store.users.find((user) => user.openid === openid);
    if (existing) {
      existing.lastLoginAt = timestamp;
      return existing;
    }

    const user: User = {
      id: `user-${crypto.randomUUID()}`,
      openid,
      email: undefined,
      username: `wx-${openid.slice(0, 12)}`,
      passwordHash: "",
      nickname: `wx-${openid.slice(0, 12)}`,
      avatarUrl: "",
      bio: "",
      role: "user",
      status: "active",
      createdAt: timestamp,
      lastLoginAt: timestamp
    };
    store.users.push(user);
    return user;
  },

  async getAdminUser() {
    if (hasDatabase()) {
      const existing = await query<DbUser>("select * from users where role = 'admin' and status = 'active' order by created_at asc limit 1");
      if (existing[0]) return toUser(existing[0]);
      const inserted = await query<DbUser>(
        `insert into users (email, username, password_hash, nickname, avatar_url, bio, role, status)
         values ('admin@test.com', 'admin', '', 'admin', '', '负责内容审核与站点运营', 'admin', 'active')
         returning *`
      );
      return toUser(inserted[0]);
    }
    return store.users.find((user) => user.role === "admin" && user.status === "active") ?? store.users[0];
  },

  async updateUserProfile(id: string, input: { avatarUrl?: string; bio?: string; username?: string }) {
    if (hasDatabase()) {
      const rows = await query<DbUser>(
        `update users
         set username = coalesce($2, username),
             nickname = coalesce($2, nickname),
             avatar_url = coalesce($3, avatar_url),
             bio = coalesce($4, bio)
         where id = $1
         returning *`,
        [id, input.username ?? null, input.avatarUrl ?? null, input.bio ?? null]
      );
      return rows[0] ? toUser(rows[0]) : null;
    }
    const user = store.users.find((item) => item.id === id);
    if (!user) return null;
    if (input.username !== undefined) {
      user.username = input.username;
      user.nickname = input.username;
    }
    if (input.avatarUrl !== undefined) user.avatarUrl = input.avatarUrl;
    if (input.bio !== undefined) user.bio = input.bio;
    return user;
  },

  async listUsers() {
    if (hasDatabase()) {
      const rows = await query<DbUser>("select * from users order by created_at desc");
      return rows.map(toUser);
    }
    return sortDescByCreatedAt(store.users);
  },

  async updateUserStatus(id: string, status: UserStatus) {
    if (hasDatabase()) {
      const rows = await query<DbUser>("update users set status = $2 where id = $1 returning *", [id, status]);
      return rows[0] ? toUser(rows[0]) : null;
    }
    const user = store.users.find((item) => item.id === id);
    if (!user) return null;
    user.status = status;
    return user;
  },

  async listPublishedPosts() {
    if (hasDatabase()) {
      const rows = await query<DbPost>("select * from posts where status = 'published' order by created_at desc");
      return rows.map(toPost);
    }
    return sortDescByCreatedAt(store.posts.filter((post) => post.status === "published"));
  },

  async listAdminPosts() {
    if (hasDatabase()) {
      const rows = await query<DbPost>("select * from posts order by created_at desc");
      return rows.map(toPost);
    }
    return sortDescByCreatedAt(store.posts);
  },

  async listUserPosts(userId: string, status?: PostStatus) {
    if (hasDatabase()) {
      const rows = await query<DbPost>(
        `select * from posts
         where author_id = $1 and ($2::text is null or status = $2)
         order by created_at desc`,
        [userId, status ?? null]
      );
      return rows.map(toPost);
    }
    return sortDescByCreatedAt(store.posts.filter((post) => post.authorId === userId && (!status || post.status === status)));
  },

  async getPost(id: string) {
    if (hasDatabase()) {
      const rows = await query<DbPost>("select * from posts where id = $1 limit 1", [id]);
      return rows[0] ? toPost(rows[0]) : null;
    }
    return store.posts.find((post) => post.id === id) ?? null;
  },

  async createPost(input: { title: string; content: string; categoryId?: string; authorId: string; coverUrl?: string; tags?: string[]; submit?: boolean }) {
    const author = await this.getUserById(input.authorId);
    if (!author) throw new Error("用户不存在");
    const categories = await this.listCategories();
    const category = categories.find((item) => item.id === input.categoryId) ?? categories[0] ?? (await this.upsertCategory({ name: "默认分类", color: "#24777b" }));
    const content = input.content.trim();
    if (hasDatabase()) {
      const rows = await query<DbPost>(
        `insert into posts (title, excerpt, content, cover_url, category_id, category_name, tags, status, moderation_reason, moderation_note, author_id, author_name)
         values ($1, $2, $3, $4, $5, $6, $7, $8, '', '', $9, $10)
         returning *`,
        [input.title.trim(), makeExcerpt(content), content, input.coverUrl ?? "", category.id, category.name, input.tags ?? [], input.submit ? "pending" : "draft", author.id, author.nickname]
      );
      return toPost(rows[0]);
    }

    const timestamp = new Date().toISOString();
    const post: Post = {
      id: `post-${crypto.randomUUID()}`,
      title: input.title.trim(),
      excerpt: makeExcerpt(content),
      content,
      coverUrl: input.coverUrl ?? "",
      categoryId: category.id,
      categoryName: category.name,
      tags: input.tags ?? [],
      status: input.submit ? "pending" : "draft",
      moderationReason: "",
      moderationNote: "",
      authorId: author.id,
      authorName: author.nickname,
      viewCount: 0,
      favoriteCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    store.posts.unshift(post);
    return post;
  },

  async updatePost(id: string, input: Partial<Pick<Post, "title" | "content" | "coverUrl" | "categoryId" | "tags" | "status" | "moderationReason" | "moderationNote">>) {
    const category = input.categoryId ? (await this.listCategories()).find((item) => item.id === input.categoryId) : undefined;
    if (hasDatabase()) {
      const rows = await query<DbPost>(
        `update posts
         set title = coalesce($2, title),
             content = coalesce($3, content),
             excerpt = coalesce($4, excerpt),
             cover_url = coalesce($5, cover_url),
             category_id = coalesce($6, category_id),
             category_name = coalesce($7, category_name),
             tags = coalesce($8, tags),
             status = coalesce($9, status),
             moderation_reason = coalesce($10, moderation_reason),
             moderation_note = coalesce($11, moderation_note),
             updated_at = now()
         where id = $1
         returning *`,
        [
          id,
          input.title ?? null,
          input.content ?? null,
          input.content ? makeExcerpt(input.content) : null,
          input.coverUrl ?? null,
          input.categoryId ?? null,
          category?.name ?? null,
          input.tags ?? null,
          input.status ?? null,
          input.moderationReason ?? null,
          input.moderationNote ?? null
        ]
      );
      return rows[0] ? toPost(rows[0]) : null;
    }

    const post = store.posts.find((item) => item.id === id);
    if (!post) return null;
    if (input.title !== undefined) post.title = input.title;
    if (input.content !== undefined) {
      post.content = input.content;
      post.excerpt = makeExcerpt(input.content);
    }
    if (input.coverUrl !== undefined) post.coverUrl = input.coverUrl;
    if (input.categoryId !== undefined) {
      post.categoryId = input.categoryId;
      post.categoryName = category?.name ?? getCategoryName(input.categoryId);
    }
    if (input.tags !== undefined) post.tags = input.tags;
    if (input.status !== undefined) post.status = input.status;
    if (input.moderationReason !== undefined) post.moderationReason = input.moderationReason;
    if (input.moderationNote !== undefined) post.moderationNote = input.moderationNote;
    post.updatedAt = new Date().toISOString();
    return post;
  },

  async deletePost(id: string) {
    if (hasDatabase()) {
      await query("delete from posts where id = $1", [id]);
      return true;
    }
    const index = store.posts.findIndex((post) => post.id === id);
    if (index < 0) return false;
    store.posts.splice(index, 1);
    return true;
  },

  async incrementPostView(id: string) {
    if (hasDatabase()) {
      const rows = await query<DbPost>("update posts set view_count = view_count + 1 where id = $1 returning *", [id]);
      return rows[0] ? toPost(rows[0]) : null;
    }
    const post = store.posts.find((item) => item.id === id);
    if (!post) return null;
    post.viewCount += 1;
    return post;
  },

  async recordPostView(userId: string | undefined, postId: string) {
    const post = await this.incrementPostView(postId);
    if (!post || post.status !== "published" || !userId) return post;
    if (hasDatabase()) {
      try {
        await ensureViewHistoryTable();
        await query(
          `insert into view_history (user_id, post_id, viewed_at)
           values ($1, $2, now())
           on conflict (user_id, post_id) do update set viewed_at = excluded.viewed_at`,
          [userId, postId]
        );
      } catch {
        return post;
      }
      return post;
    }
    const existing = store.viewHistory.find((item) => item.userId === userId && item.postId === postId);
    if (existing) existing.viewedAt = new Date().toISOString();
    else store.viewHistory.push({ userId, postId, viewedAt: new Date().toISOString() });
    return post;
  },

  async favoritePost(userId: string, postId: string) {
    const post = await this.getPost(postId);
    if (!post) throw new Error("文章不存在");
    if (post.status !== "published") throw new Error("只能收藏已发布文章");
    if (hasDatabase()) {
      await query("insert into favorites (user_id, post_id) values ($1, $2) on conflict do nothing", [userId, postId]);
      const rows = await query<DbPost>("update posts set favorite_count = (select count(*) from favorites where post_id = $1) where id = $1 returning *", [postId]);
      return rows[0] ? toPost(rows[0]) : post;
    }
    const exists = store.favorites.some((item) => item.userId === userId && item.postId === postId);
    if (!exists) {
      store.favorites.push({ userId, postId, createdAt: new Date().toISOString() });
      post.favoriteCount += 1;
    }
    return post;
  },

  async unfavoritePost(userId: string, postId: string) {
    const post = await this.getPost(postId);
    if (!post) throw new Error("文章不存在");
    if (hasDatabase()) {
      await query("delete from favorites where user_id = $1 and post_id = $2", [userId, postId]);
      const rows = await query<DbPost>("update posts set favorite_count = (select count(*) from favorites where post_id = $1) where id = $1 returning *", [postId]);
      return rows[0] ? toPost(rows[0]) : post;
    }
    const index = store.favorites.findIndex((item) => item.userId === userId && item.postId === postId);
    if (index >= 0) {
      store.favorites.splice(index, 1);
      post.favoriteCount = Math.max(0, post.favoriteCount - 1);
    }
    return post;
  },

  async isPostFavorited(userId: string | undefined, postId: string) {
    if (!userId) return false;
    if (hasDatabase()) {
      const rows = await query<{ exists: boolean }>(
        "select exists(select 1 from favorites where user_id = $1 and post_id = $2) as exists",
        [userId, postId]
      );
      return Boolean(rows[0]?.exists);
    }
    return store.favorites.some((item) => item.userId === userId && item.postId === postId);
  },

  async listFavoritePosts(userId: string) {
    if (hasDatabase()) {
      const rows = await query<DbPostJoin>(
        `select p.*, f.created_at as relation_created_at
         from favorites f
         join posts p on p.id = f.post_id
         where f.user_id = $1 and p.status = 'published'
         order by f.created_at desc`,
        [userId]
      );
      return rows.map(toPost);
    }
    const ids = store.favorites
      .filter((item) => item.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((item) => item.postId);
    return ids
      .map((id) => store.posts.find((post) => post.id === id && post.status === "published"))
      .filter((post): post is Post => Boolean(post));
  },

  async listViewHistoryPosts(userId: string) {
    if (hasDatabase()) {
      try {
        await ensureViewHistoryTable();
        const rows = await query<DbPostJoin>(
          `select p.*, h.viewed_at as relation_viewed_at
           from view_history h
           join posts p on p.id = h.post_id
           where h.user_id = $1 and p.status = 'published'
           order by h.viewed_at desc`,
          [userId]
        );
        return rows.map(toPost);
      } catch {
        return [];
      }
    }
    const ids = store.viewHistory
      .filter((item) => item.userId === userId)
      .sort((a, b) => b.viewedAt.localeCompare(a.viewedAt))
      .map((item) => item.postId);
    return ids
      .map((id) => store.posts.find((post) => post.id === id && post.status === "published"))
      .filter((post): post is Post => Boolean(post));
  },

  async clearViewHistory(userId: string) {
    if (hasDatabase()) {
      try {
        await ensureViewHistoryTable();
        await query("delete from view_history where user_id = $1", [userId]);
      } catch {
        return true;
      }
      return true;
    }
    for (let index = store.viewHistory.length - 1; index >= 0; index -= 1) {
      if (store.viewHistory[index].userId === userId) store.viewHistory.splice(index, 1);
    }
    return true;
  },

  async listCategories() {
    if (hasDatabase()) {
      const rows = await query<DbCategory>("select * from categories order by created_at asc");
      return rows.map(toCategory);
    }
    return [...store.categories];
  },

  async upsertCategory(input: { id?: string; name: string; color: string }) {
    if (hasDatabase()) {
      const rows = input.id
        ? await query<DbCategory>("update categories set name = $2, color = $3 where id = $1 returning *", [input.id, input.name, input.color])
        : await query<DbCategory>("insert into categories (name, color) values ($1, $2) returning *", [input.name, input.color]);
      return toCategory(rows[0]);
    }
    if (input.id) {
      const category = store.categories.find((item) => item.id === input.id);
      if (!category) throw new Error("分类不存在");
      category.name = input.name;
      category.color = input.color;
      return category;
    }
    const category: Category = { id: `cat-${crypto.randomUUID()}`, name: input.name, color: input.color, createdAt: new Date().toISOString() };
    store.categories.push(category);
    return category;
  },

  async deleteCategory(id: string) {
    if (hasDatabase()) {
      await query("delete from categories where id = $1", [id]);
      return true;
    }
    const index = store.categories.findIndex((category) => category.id === id);
    if (index < 0) return false;
    store.categories.splice(index, 1);
    return true;
  },

  async listTags() {
    const posts = await this.listAdminPosts();
    return Array.from(new Set(posts.flatMap((post) => post.tags))).sort();
  },

  async listComments(postId?: string, admin = false) {
    if (hasDatabase()) {
      const rows = postId
        ? await query<DbComment>(
            `select * from comments where post_id = $1 ${admin ? "" : "and status = 'published'"} order by created_at desc`,
            [postId]
          )
        : await query<DbComment>(`select * from comments ${admin ? "" : "where status = 'published'"} order by created_at desc`);
      return rows.map(toComment);
    }
    return sortDescByCreatedAt(store.comments.filter((comment) => (!postId || comment.postId === postId) && (admin || comment.status === "published")));
  },

  async createComment(input: { postId: string; authorId: string; content: string }) {
    const post = await this.getPost(input.postId);
    const author = await this.getUserById(input.authorId);
    if (!post || !author) throw new Error("文章或用户不存在");
    if (hasDatabase()) {
      const rows = await query<DbComment>(
        `insert into comments (post_id, post_title, author_id, author_name, content, status)
         values ($1, $2, $3, $4, $5, 'published')
         returning *`,
        [post.id, post.title, author.id, author.nickname, input.content]
      );
      return toComment(rows[0]);
    }
    const comment: Comment = {
      id: `comment-${crypto.randomUUID()}`,
      postId: post.id,
      postTitle: post.title,
      authorId: author.id,
      authorName: author.nickname,
      content: input.content,
      status: "published",
      createdAt: new Date().toISOString()
    };
    store.comments.unshift(comment);
    return comment;
  },

  async updateCommentStatus(id: string, status: CommentStatus) {
    if (hasDatabase()) {
      const rows = await query<DbComment>("update comments set status = $2 where id = $1 returning *", [id, status]);
      return rows[0] ? toComment(rows[0]) : null;
    }
    const comment = store.comments.find((item) => item.id === id);
    if (!comment) return null;
    comment.status = status;
    return comment;
  },

  async deleteComment(id: string) {
    if (hasDatabase()) {
      await query("delete from comments where id = $1", [id]);
      return true;
    }
    const index = store.comments.findIndex((comment) => comment.id === id);
    if (index < 0) return false;
    store.comments.splice(index, 1);
    return true;
  },

  async listMessageThreads(userId: string): Promise<MessageThread[]> {
    const messages = hasDatabase()
      ? await (async () => {
        await ensureMessagesTable();
        return (await query<DbMessage>(
          "select * from messages where sender_id = $1 or receiver_id = $1 order by created_at desc",
          [userId]
        )).map(toMessage);
      })()
      : sortDescByCreatedAt(store.messages.filter((item) => item.senderId === userId || item.receiverId === userId));

    const byPeer = new Map<string, MessageThread>();
    messages.forEach((message) => {
      const peerId = message.senderId === userId ? message.receiverId : message.senderId;
      const peerName = message.senderId === userId ? message.receiverName : message.senderName;
      const existing = byPeer.get(peerId);
      if (!existing) {
        byPeer.set(peerId, {
          peerId,
          peerName,
          lastMessage: message.content,
          unreadCount: message.receiverId === userId && !message.readAt ? 1 : 0,
          updatedAt: message.createdAt
        });
      } else if (message.receiverId === userId && !message.readAt) {
        existing.unreadCount += 1;
      }
    });
    return Array.from(byPeer.values());
  },

  async listMessages(userId: string, peerId: string) {
    if (hasDatabase()) {
      await ensureMessagesTable();
      const rows = await query<DbMessage>(
        `select * from messages
         where (sender_id = $1 and receiver_id = $2) or (sender_id = $2 and receiver_id = $1)
         order by created_at asc`,
        [userId, peerId]
      );
      return rows.map(toMessage);
    }
    return [...store.messages]
      .filter((item) => (item.senderId === userId && item.receiverId === peerId) || (item.senderId === peerId && item.receiverId === userId))
      .sort((a, b) => Number(new Date(a.createdAt)) - Number(new Date(b.createdAt)));
  },

  async markMessagesRead(userId: string, peerId: string) {
    const readAt = new Date().toISOString();
    if (hasDatabase()) {
      await ensureMessagesTable();
      await query("update messages set read_at = now() where receiver_id = $1 and sender_id = $2 and read_at is null", [userId, peerId]);
      return true;
    }
    store.messages.forEach((message) => {
      if (message.receiverId === userId && message.senderId === peerId && !message.readAt) message.readAt = readAt;
    });
    return true;
  },

  async createMessage(input: { senderId: string; receiverId?: string; receiverNickname?: string; content: string }) {
    const sender = await this.getUserById(input.senderId);
    const receiver = input.receiverId ? await this.getUserById(input.receiverId) : input.receiverNickname ? await this.findUserByNickname(input.receiverNickname) : null;
    if (!sender || !receiver) throw new Error("收件人不存在");
    if (sender.id === receiver.id) throw new Error("不能给自己发送消息");
    if (hasDatabase()) {
      await ensureMessagesTable();
      const rows = await query<DbMessage>(
        `insert into messages (sender_id, sender_name, receiver_id, receiver_name, content)
         values ($1, $2, $3, $4, $5)
         returning *`,
        [sender.id, sender.nickname, receiver.id, receiver.nickname, input.content]
      );
      return toMessage(rows[0]);
    }
    const message: Message = {
      id: `message-${crypto.randomUUID()}`,
      senderId: sender.id,
      senderName: sender.nickname,
      receiverId: receiver.id,
      receiverName: receiver.nickname,
      content: input.content,
      createdAt: new Date().toISOString()
    };
    store.messages.push(message);
    return message;
  },

  async listNotifications(userId: string) {
    if (hasDatabase()) {
      await ensureNotificationsTable();
      const rows = await query<DbNotification>("select * from notifications where user_id = $1 order by created_at desc", [userId]);
      return rows.map(toNotification);
    }
    return sortDescByCreatedAt(store.notifications.filter((item) => item.userId === userId));
  },

  async markNotificationsRead(userId: string, ids?: string[]) {
    const readAt = new Date().toISOString();
    if (hasDatabase()) {
      await ensureNotificationsTable();
      if (ids?.length) {
        await query("update notifications set read_at = now() where user_id = $1 and id = any($2::uuid[])", [userId, ids]);
      } else {
        await query("update notifications set read_at = now() where user_id = $1", [userId]);
      }
      return true;
    }
    store.notifications.forEach((item) => {
      if (item.userId === userId && (!ids?.length || ids.includes(item.id))) item.readAt = readAt;
    });
    return true;
  },

  async createNotification(input: { userId: string; type: Notification["type"]; title: string; content: string }) {
    if (hasDatabase()) {
      await ensureNotificationsTable();
      const rows = await query<DbNotification>(
        `insert into notifications (user_id, type, title, content)
         values ($1, $2, $3, $4)
         returning *`,
        [input.userId, input.type, input.title, input.content]
      );
      return toNotification(rows[0]);
    }
    const notification: Notification = {
      id: `notification-${crypto.randomUUID()}`,
      userId: input.userId,
      type: input.type,
      title: input.title,
      content: input.content,
      createdAt: new Date().toISOString()
    };
    store.notifications.unshift(notification);
    return notification;
  },

  async listAiReviews() {
    if (hasDatabase()) {
      const rows = await query<DbAiReview>("select * from ai_review_results order by created_at desc");
      return rows.map(toAiReview);
    }
    return sortDescByCreatedAt(store.aiReviews);
  },

  async createAiReview(input: Omit<AiReviewResult, "id" | "createdAt" | "status"> & { status?: AiReviewResult["status"] }) {
    if (hasDatabase()) {
      const rows = await query<DbAiReview>(
        `insert into ai_review_results (target_type, target_id, action, score, summary, status)
         values ($1, $2, $3, $4, $5, $6)
         returning *`,
        [input.targetType, input.targetId, input.action, input.score, input.summary, input.status ?? "pending"]
      );
      return toAiReview(rows[0]);
    }
    const review: AiReviewResult = {
      id: `ai-review-${crypto.randomUUID()}`,
      targetType: input.targetType,
      targetId: input.targetId,
      action: input.action,
      score: input.score,
      summary: input.summary,
      status: input.status ?? "pending",
      createdAt: new Date().toISOString()
    };
    store.aiReviews.unshift(review);
    return review;
  },

  async updateAiReviewStatus(id: string, status: AiReviewResult["status"]) {
    if (hasDatabase()) {
      const rows = await query<DbAiReview>("update ai_review_results set status = $2 where id = $1 returning *", [id, status]);
      return rows[0] ? toAiReview(rows[0]) : null;
    }
    const review = store.aiReviews.find((item) => item.id === id);
    if (!review) return null;
    review.status = status;
    return review;
  },

  async getAdminSummary(): Promise<AdminSummary> {
    if (hasDatabase()) {
      const [users, posts, published, pending, comments, messages, notifications, aiReviews, views] = await Promise.all([
        countTable("users"),
        countTable("posts"),
        query<{ count: string }>("select count(*)::text as count from posts where status = 'published'").then((rows) => Number(rows[0]?.count ?? 0)),
        query<{ count: string }>("select count(*)::text as count from posts where status = 'pending'").then((rows) => Number(rows[0]?.count ?? 0)),
        countTable("comments"),
        countTable("messages"),
        countTable("notifications"),
        countTable("ai_review_results"),
        query<{ total: string }>("select coalesce(sum(view_count), 0)::text as total from posts").then((rows) => Number(rows[0]?.total ?? 0))
      ]);
      return { totals: { users, posts, published, pending, comments, messages, notifications, aiReviews, views } };
    }

    return {
      totals: {
        users: store.users.length,
        posts: store.posts.length,
        published: store.posts.filter((post) => post.status === "published").length,
        pending: store.posts.filter((post) => post.status === "pending").length,
        comments: store.comments.length,
        messages: store.messages.length,
        notifications: store.notifications.length,
        aiReviews: store.aiReviews.length,
        views: store.posts.reduce((sum, post) => sum + post.viewCount, 0)
      }
    };
  },

  async listRecommendations() {
    const posts = await this.listPublishedPosts();
    return posts.map((post) => ({
      postId: post.id,
      title: post.title,
      score: post.viewCount + post.favoriteCount * 5,
      reason: "基于浏览量与收藏量的 demo 推荐分"
    }));
  }
};
