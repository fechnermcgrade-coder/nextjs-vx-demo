export type Role = "user" | "admin";
export type UserStatus = "active" | "disabled";
export type PostStatus = "draft" | "pending" | "published" | "rejected";
export type CommentStatus = "published";
export type NotificationType = "system" | "comment" | "message" | "post";
export type AiReviewStatus = "pending" | "confirmed" | "dismissed";

export type User = {
  id: string;
  openid?: string;
  email?: string;
  username: string;
  passwordHash: string;
  nickname: string;
  avatarUrl: string;
  bio: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
  lastLoginAt?: string;
};

export type PublicUser = Pick<User, "id" | "email" | "username" | "nickname" | "avatarUrl" | "bio" | "role">;

export type Category = {
  id: string;
  name: string;
  color: string;
  createdAt: string;
};

export type Post = {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  coverUrl: string;
  categoryId: string;
  categoryName: string;
  tags: string[];
  status: PostStatus;
  moderationReason?: "rejected" | "takedown" | "";
  moderationNote?: string;
  authorId: string;
  authorName: string;
  viewCount: number;
  favoriteCount: number;
  createdAt: string;
  updatedAt: string;
};

export type Comment = {
  id: string;
  postId: string;
  postTitle: string;
  authorId: string;
  authorName: string;
  content: string;
  status: CommentStatus;
  createdAt: string;
};

export type Message = {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName: string;
  content: string;
  readAt?: string;
  createdAt: string;
};

export type MessageThread = {
  peerId: string;
  peerName: string;
  lastMessage: string;
  unreadCount: number;
  updatedAt: string;
};

export type Notification = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  readAt?: string;
  createdAt: string;
};

export type AiReviewResult = {
  id: string;
  targetType: "post" | "comment" | "recommendation" | "tag" | "summary";
  targetId: string;
  action: string;
  score: number;
  summary: string;
  status: AiReviewStatus;
  createdAt: string;
};

export type AdminSummary = {
  totals: {
    users: number;
    posts: number;
    published: number;
    pending: number;
    comments: number;
    messages: number;
    notifications: number;
    aiReviews: number;
    views: number;
  };
};
