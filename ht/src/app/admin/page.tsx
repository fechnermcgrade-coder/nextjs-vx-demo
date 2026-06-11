"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ApiResult<T> = { success: boolean; data: T; message?: string };
type Tab = "dashboard" | "review" | "posts" | "comments" | "users" | "categories" | "heat";
type Summary = { totals: { users: number; posts: number; published: number; pending: number; comments: number; messages: number; notifications: number; aiReviews: number; views: number } };
type Post = { id: string; title: string; excerpt?: string; content?: string; coverUrl?: string; status: string; moderationReason?: string; moderationNote?: string; categoryId?: string; categoryName: string; authorName: string; viewCount?: number; favoriteCount?: number; createdAt: string };
type Comment = { id: string; postId?: string; postTitle: string; authorName: string; content: string; createdAt: string };
type User = { id: string; email?: string; username?: string; nickname: string; role: string; status: string; bio: string; createdAt: string };
type Category = { id: string; name: string; color: string; createdAt: string };
type AdminCache = { summary: Summary | null; posts: Post[]; comments: Comment[]; users: User[]; categories: Category[] };
type ConfirmState = { title: string; message: string; danger?: boolean; onConfirm: () => void } | null;
type AiReviewResult = { configured: boolean; provider: string; score: number; summary: string; tags?: string[]; suggestion?: "pass" | "reject" };
type AiReviewState = { post: Post; loading: boolean; result?: AiReviewResult; error?: string } | null;
type StatusInsight = { loading: boolean; content: string; error?: string };

const PAGE_SIZE = 10;
const CACHE_KEY = "vitex-admin-cache:v7";
const emptyCache: AdminCache = { summary: null, posts: [], comments: [], users: [], categories: [] };
const tabs: Array<{ key: Tab; label: string; hint: string }> = [
  { key: "dashboard", label: "总览", hint: "趋势与待办" },
  { key: "review", label: "审核", hint: "待审队列" },
  { key: "posts", label: "文章", hint: "发布治理" },
  { key: "comments", label: "评论", hint: "实时内容" },
  { key: "users", label: "用户", hint: "账号状态" },
  { key: "categories", label: "分类", hint: "内容栏目" },
  { key: "heat", label: "热度", hint: "内容表现" }
];
const statusLabels: Record<string, string> = { draft: "草稿", pending: "待审核", published: "已发布", rejected: "已拒绝", active: "启用", disabled: "停用" };

async function readJson<T>(response: Response) {
  const json = (await response.json()) as ApiResult<T>;
  if (!response.ok || !json.success) throw new Error(json.message || "请求失败");
  return json.data;
}

function fmtTime(value: string) {
  return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "-";
}

function isToday(value?: string) {
  return Boolean(value && value.slice(0, 10) === new Date().toISOString().slice(0, 10));
}

function pageItems<T>(items: T[], page: number) {
  return items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
}

function includesQuery(values: Array<string | number | undefined>, query: string) {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return true;
  return values.some((value) => String(value ?? "").toLowerCase().includes(keyword));
}

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [statusInsight, setStatusInsight] = useState<StatusInsight>({ loading: false, content: "刷新管理数据后，AI 会基于最新文章状态分布给出运营建议。" });
  const [tab, setTab] = useState<Tab>("dashboard");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState("");
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [detailPost, setDetailPost] = useState<Post | null>(null);
  const [aiReviewState, setAiReviewState] = useState<AiReviewState>(null);
  const [cache, setCache] = useState<AdminCache>(emptyCache);
  const [categoryName, setCategoryName] = useState("");
  const [categoryColor, setCategoryColor] = useState("#2f5d62");

  const headers = useMemo(() => ({ Authorization: `Bearer ${token ?? ""}` }), [token]);
  const pendingPosts = cache.posts.filter((post) => post.status === "pending");
  const publishedPosts = cache.posts.filter((post) => post.status === "published");
  const reviewablePosts = cache.posts.filter((post) => post.status !== "draft");
  const commentsByPost = cache.comments.reduce<Record<string, number>>((map, comment) => {
    if (comment.postId) map[comment.postId] = (map[comment.postId] ?? 0) + 1;
    return map;
  }, {});
  const heatScore = (post: Post) => (post.viewCount ?? 0) + (post.favoriteCount ?? 0) * 5 + (commentsByPost[post.id] ?? 0) * 3;
  const hotPosts = [...publishedPosts].sort((a, b) => heatScore(b) - heatScore(a));
  const recentPosts = [...reviewablePosts].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 20);
  const trendBars = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    return {
      key,
      label: date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }),
      posts: cache.posts.filter((post) => post.createdAt.slice(0, 10) === key).length,
      comments: cache.comments.filter((comment) => comment.createdAt.slice(0, 10) === key).length,
      users: cache.users.filter((user) => user.createdAt.slice(0, 10) === key).length
    };
  });

  const fetchAll = useCallback(async (nextToken: string) => {
    if (!nextToken) return;
    setBusy("load");
    setMessage("正在加载管理数据...");
    try {
      const authHeaders = { Authorization: `Bearer ${nextToken}` };
      const [summary, posts, comments, users, categories] = await Promise.all([
        fetch("/api/admin/summary", { headers: authHeaders, cache: "no-store" }).then((res) => readJson<Summary>(res)),
        fetch("/api/admin/posts", { headers: authHeaders, cache: "no-store" }).then((res) => readJson<{ posts: Post[] }>(res)),
        fetch("/api/admin/comments", { headers: authHeaders, cache: "no-store" }).then((res) => readJson<{ comments: Comment[] }>(res)),
        fetch("/api/admin/users", { headers: authHeaders, cache: "no-store" }).then((res) => readJson<{ users: User[] }>(res)),
        fetch("/api/categories", { cache: "no-store" }).then((res) => readJson<{ categories: Category[] }>(res))
      ]);
      const next = { summary, posts: posts.posts, comments: comments.comments, users: users.users, categories: categories.categories };
      setCache(next);
      window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(next));
      setMessage("管理数据已加载");
    } catch (error) {
      window.localStorage.removeItem("admin_token");
      window.dispatchEvent(new Event("vitex-admin-auth"));
      setToken("");
      setMessage(error instanceof Error ? error.message : "加载失败");
      setStatusInsight({ loading: false, content: "管理数据加载失败，暂时无法生成 AI 状态建议。", error: error instanceof Error ? error.message : "加载失败" });
    } finally {
      setBusy("");
    }
  }, []);

  const refreshStatusInsight = useCallback(async () => {
    if (!token || statusInsight.loading) return;
    const source = cache;
    const summary = source.summary;
    if (!summary) {
      setStatusInsight({ loading: false, content: "请先刷新管理数据，再生成 AI 状态建议。" });
      return;
    }
    setStatusInsight({ loading: true, content: "AI 正在分析文章状态分布..." });
    const returnedCount = source.posts.filter((post) => post.status === "draft" && post.moderationReason).length;
    const totalStatus = summary.totals.published + summary.totals.pending + returnedCount;
    try {
      const insight = await fetch("/api/admin/ai/chat", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: `请基于当前后台文章状态分布，给管理员一段简洁运营点评和合理建议。当前总计 ${totalStatus} 篇，已发布 ${summary.totals.published} 篇，待审核 ${summary.totals.pending} 篇，退回草稿 ${returnedCount} 篇。请只输出 2 到 4 条中文短建议，重点关注审核压力、发布节奏、退回整改和内容健康，不要执行任何管理操作。`
          }]
        })
      }).then((res) => readJson<{ reply: { content: string } }>(res));
      setStatusInsight({ loading: false, content: insight.reply.content || "AI 暂未生成建议。" });
    } catch (error) {
      setStatusInsight({ loading: false, content: "AI 建议暂时不可用，请稍后重试。", error: error instanceof Error ? error.message : "AI 分析失败" });
    }
  }, [cache, headers, statusInsight.loading, token]);

  useEffect(() => {
    const savedToken = window.localStorage.getItem("admin_token") || "";
    const savedCache = window.sessionStorage.getItem(CACHE_KEY);
    setToken(savedToken);
    if (savedCache) {
      setCache(JSON.parse(savedCache));
      setMessage("已使用本页缓存数据，需要最新数据请手动刷新。");
      return;
    }
    if (savedToken) void fetchAll(savedToken);
  }, [fetchAll]);

  const askConfirm = (title: string, messageText: string, onConfirm: () => void, danger = false) => setConfirmState({ title, message: messageText, onConfirm, danger });

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy("login");
    setMessage("正在登录...");
    try {
      const data = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), password }) }).then((res) => readJson<{ token: string }>(res));
      window.localStorage.setItem("admin_token", data.token);
      window.dispatchEvent(new Event("vitex-admin-auth"));
      setToken(data.token);
      await fetchAll(data.token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登录失败");
    } finally {
      setBusy("");
    }
  };

  const runAction = async (key: string, task: () => Promise<void>, success: string) => {
    if (!token || busy) return;
    setBusy(key);
    try {
      await task();
      setMessage(success);
      await fetchAll(token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
    } finally {
      setBusy("");
    }
  };

  const updatePost = (post: Post, status: "published" | "draft", reason: "" | "rejected" | "takedown", note: string) => {
    const label = status === "published" ? "通过并发布" : reason === "takedown" ? "下架并退回草稿箱" : "拒绝并退回草稿箱";
    askConfirm(label, `确认${label}《${post.title}》吗？`, () => void runAction(`post-${post.id}-${status}`, async () => {
      await fetch("/api/admin/posts", { method: "PUT", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ id: post.id, status, moderationReason: reason, moderationNote: note }) }).then((res) => readJson(res));
    }, "文章状态已更新"), status !== "published");
  };

  const deletePost = (post: Post) => askConfirm("删除文章", `确认永久删除《${post.title}》吗？此操作不可恢复。`, () => void runAction(`post-${post.id}-delete`, async () => {
    await fetch(`/api/posts/${post.id}`, { method: "DELETE", headers }).then((res) => readJson(res));
  }, "文章已删除"), true);

  const runAiReview = (post: Post) => setAiReviewState({ post, loading: false });

  const executeAiReview = async () => {
    if (!aiReviewState || !token || aiReviewState.loading) return;
    const post = aiReviewState.post;
    setAiReviewState({ post, loading: true });
    setBusy(`post-${post.id}-ai`);
    try {
      const data = await fetch("/api/ai/review-post", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id })
      }).then((res) => readJson<{ result: AiReviewResult }>(res));
      const result = { ...data.result, suggestion: data.result.suggestion ?? (data.result.score >= 70 ? "pass" : "reject") };
      setAiReviewState({ post, loading: false, result });
      setMessage("AI 审核建议已生成，仍需管理员最终决定");
    } catch (error) {
      setAiReviewState({ post, loading: false, error: error instanceof Error ? error.message : "AI 审核失败" });
    } finally {
      setBusy("");
    }
  };

  const deleteComment = (comment: Comment) => askConfirm("删除评论", "确认删除这条评论吗？删除后不可恢复。", () => void runAction(`comment-${comment.id}-delete`, async () => {
    await fetch(`/api/comments/${comment.id}`, { method: "DELETE", headers }).then((res) => readJson(res));
  }, "评论已删除"), true);

  const updateUser = (user: User, status: "active" | "disabled") => askConfirm(status === "active" ? "启用用户" : "停用用户", `确认${status === "active" ? "启用" : "停用"}用户 ${user.email || user.nickname} 吗？`, () => void runAction(`user-${user.id}-${status}`, async () => {
    await fetch("/api/admin/users", { method: "PUT", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ id: user.id, status }) }).then((res) => readJson(res));
  }, "用户状态已更新"), status === "disabled");

  const addCategory = (event: React.FormEvent) => {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) return;
    askConfirm("新增分类", `确认新增分类“${name}”吗？`, () => void runAction("category-create", async () => {
      await fetch("/api/categories", { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ name, color: categoryColor }) }).then((res) => readJson(res));
      setCategoryName("");
    }, "分类已新增"));
  };

  const logout = () => askConfirm("退出工作台", "确认退出当前管理员登录状态吗？", () => {
    window.localStorage.removeItem("admin_token");
    window.sessionStorage.removeItem(CACHE_KEY);
    window.dispatchEvent(new Event("vitex-admin-auth"));
    setToken("");
    setCache(emptyCache);
    setMessage("已退出登录");
  });

  if (token === null) return <div className="flex min-h-[70vh] items-center justify-center"><LoadingCard title="正在恢复登录状态" text="正在检查管理员登录信息，请稍候。" /></div>;
  if (!token) return <div className="flex min-h-[calc(100vh-120px)] items-center justify-center"><section className="w-full max-w-md rounded-[28px] border border-[#d9e1df] bg-[#fbfaf6] p-7 shadow-xl shadow-[#d9e1df]/60"><p className="text-sm font-black uppercase text-[#2f5d62]">Vitex Admin</p><h1 className="mt-3 text-3xl font-black text-slate-950">管理后台登录</h1><p className="mt-3 leading-7 text-slate-600">请输入管理员邮箱和密码。普通用户账号无法进入工作台。</p><form onSubmit={login} className="mt-7 space-y-4"><label className="block text-sm font-bold text-slate-700">管理员邮箱<input className="mt-2 w-full rounded-2xl border border-[#d9e1df] bg-white px-4 py-3 outline-none focus:border-[#2f5d62]" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" /></label><label className="block text-sm font-bold text-slate-700">密码<input className="mt-2 w-full rounded-2xl border border-[#d9e1df] bg-white px-4 py-3 outline-none focus:border-[#2f5d62]" value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" /></label><button className="w-full rounded-2xl bg-[#2f5d62] px-5 py-3 font-black text-white disabled:opacity-50" disabled={busy === "login"} type="submit">{busy === "login" ? "登录中..." : "进入工作台"}</button></form>{message && <p className="mt-4 text-sm text-slate-600">{message}</p>}</section></div>;

  const list = tab === "review" ? pendingPosts : tab === "posts" ? reviewablePosts : tab === "comments" ? cache.comments : tab === "users" ? cache.users : tab === "categories" ? cache.categories : tab === "heat" ? hotPosts : [];
  const filtered = list.filter((item) => includesQuery(Object.values(item as Record<string, unknown>).map(String), query));
  const paged = pageItems(filtered, page);
  const today = { users: cache.users.filter((u) => isToday(u.createdAt)).length, pending: pendingPosts.filter((p) => isToday(p.createdAt)).length, comments: cache.comments.filter((c) => isToday(c.createdAt)).length, views: 0 };

  return <div className="space-y-6">{busy === "load" && <LoadingOverlay />}<section className="rounded-[28px] border border-[#d9e1df] bg-gradient-to-br from-[#fbfaf6] to-[#eef4f3] p-7 text-slate-950 shadow-sm"><div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-sm font-black uppercase text-[#2f5d62]">Editorial Desk</p><h1 className="mt-3 text-4xl font-black">Vitex 管理工作台</h1><p className="mt-3 max-w-2xl leading-7 text-slate-600">后台只处理待审和已发布文章，用户草稿不会投递到后台。</p></div><div className="flex flex-wrap gap-3"><button className="rounded-2xl bg-[#2f5d62] px-5 py-3 text-sm font-black text-white disabled:opacity-50" onClick={() => askConfirm("刷新数据", "确认刷新后台管理数据吗？", () => void fetchAll(token))} disabled={Boolean(busy)}>刷新数据</button><button className="rounded-2xl border border-[#e3c98d] bg-[#fff7e8] px-5 py-3 text-sm font-black text-[#8a5a00] shadow-sm disabled:opacity-50" onClick={() => askConfirm("刷新 AI 建议", "确认让 AI 基于当前状态分布重新生成运营建议吗？", () => void refreshStatusInsight())} disabled={statusInsight.loading || busy === "load"}>{statusInsight.loading ? "AI 分析中..." : "刷新 AI 建议"}</button><button className="rounded-2xl border border-[#d9e1df] bg-white px-5 py-3 text-sm font-black text-slate-800" onClick={logout}>退出</button></div></div></section>{message && busy !== "load" && <div className="rounded-2xl border border-[#d9e1df] bg-[#eef4f3] px-5 py-3 text-sm font-bold text-[#2f5d62]">{message}</div>}<nav className="grid gap-3 md:grid-cols-7">{tabs.map((item) => <button key={item.key} className={`rounded-2xl border p-4 text-left transition ${tab === item.key ? "border-[#2f5d62] bg-[#2f5d62] text-white" : "border-[#d9e1df] bg-white text-slate-900 hover:border-[#2f5d62]"}`} onClick={() => { setTab(item.key); setQuery(""); setPage(1); }}><span className="block font-black">{item.label}</span><span className="mt-1 block text-xs opacity-70">{item.hint}</span></button>)}</nav>{tab === "dashboard" && <div className="space-y-5"><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat label="用户" value={cache.summary?.totals.users ?? cache.users.length} delta={today.users} tone="teal" /><Stat label="待审文章" value={cache.summary?.totals.pending ?? pendingPosts.length} delta={today.pending} tone="amber" /><Stat label="评论" value={cache.summary?.totals.comments ?? cache.comments.length} delta={today.comments} tone="blue" /><Stat label="浏览量" value={cache.summary?.totals.views ?? 0} delta={today.views} tone="rose" /></section><Panel title="近 7 天变化"><TrendChart bars={trendBars} /></Panel><div className="grid gap-5 lg:grid-cols-2"><Panel title="状态分布"><StatusSummary published={publishedPosts.length} pending={pendingPosts.length} returned={cache.posts.filter((p) => p.status === "draft" && p.moderationReason).length} insight={statusInsight} /></Panel><Panel title="最近内容"><div className="max-h-[360px] space-y-3 overflow-y-auto pr-2">{recentPosts.map((post) => <div key={post.id} className="rounded-2xl bg-slate-50 p-4"><div className="flex justify-between gap-3"><span className="font-bold">{post.title}</span><Badge>{statusLabels[post.status] || post.status}</Badge></div><p className="mt-1 text-sm text-slate-500">{post.authorName} / {fmtTime(post.createdAt)}</p></div>)}{!recentPosts.length && <p className="py-8 text-center text-slate-500">暂无最近内容</p>}</div></Panel></div></div>}{tab !== "dashboard" && <Panel title={tabs.find((item) => item.key === tab)?.label} subtitle={`${filtered.length} 条数据`}><Search value={query} onChange={(value) => { setQuery(value); setPage(1); }} />{tab === "review" && <PostTable posts={paged as Post[]} commentsByPost={commentsByPost} busy={busy} onAi={runAiReview} onUpdate={updatePost} onView={setDetailPost} />}{tab === "posts" && <PostTable posts={paged as Post[]} commentsByPost={commentsByPost} busy={busy} onAi={runAiReview} onUpdate={updatePost} onDelete={deletePost} onView={setDetailPost} showStatus />}{tab === "heat" && <Table headings={["标题", "作者", "分类", "数据", "热度", "创建时间"]} colWidths={["330px", "115px", "130px", "240px", "80px", "140px"]} minWidth="980px" empty={!paged.length}>{(paged as Post[]).map((post) => <tr key={post.id} className="border-t border-slate-100"><td><Cell title={post.title} sub={post.excerpt} /></td><td className="whitespace-nowrap">{post.authorName}</td><td className="whitespace-nowrap">{post.categoryName}</td><td className="leading-6">{post.viewCount ?? 0} 浏览 / {post.favoriteCount ?? 0} 收藏 / {commentsByPost[post.id] ?? 0} 评论</td><td className="font-black text-[#2f5d62]">{heatScore(post)}</td><td>{fmtTime(post.createdAt)}</td></tr>)}</Table>}{tab === "comments" && <Table headings={["内容", "文章", "用户", "创建时间", "操作"]} empty={!paged.length}>{(paged as Comment[]).map((comment) => <tr key={comment.id} className="border-t border-slate-100"><td><Cell title={comment.content} /></td><td><Cell title={comment.postTitle} /></td><td>{comment.authorName}</td><td>{fmtTime(comment.createdAt)}</td><td><Action tone="danger" onClick={() => deleteComment(comment)}>删除</Action></td></tr>)}</Table>}{tab === "users" && <Table headings={["账号", "邮箱", "角色", "状态", "简介", "创建时间", "操作"]} colWidths={["170px", "210px", "80px", "90px", "210px", "140px", "120px"]} minWidth="940px" empty={!paged.length}>{(paged as User[]).map((user) => <tr key={user.id} className="border-t border-slate-100"><td><Cell title={user.nickname} sub={`@${user.username}`} /></td><td className="truncate">{user.email || "-"}</td><td>{user.role === "admin" ? "管理员" : "用户"}</td><td><Badge>{statusLabels[user.status] || user.status}</Badge></td><td><Cell title={user.bio || "-"} /></td><td>{fmtTime(user.createdAt)}</td><td className="space-x-2 whitespace-nowrap"><Action tone="success" disabled={user.status === "active"} onClick={() => updateUser(user, "active")}>启用</Action><Action tone="danger" disabled={user.status === "disabled"} onClick={() => updateUser(user, "disabled")}>停用</Action></td></tr>)}</Table>}{tab === "categories" && <><form onSubmit={addCategory} className="mb-4 grid gap-2 rounded-2xl border border-[#d9e1df] bg-[#fbfaf6] p-2 md:grid-cols-[1fr_auto_auto]"><input className="h-10 rounded-xl border border-[#d9e1df] bg-white px-3 text-sm" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="分类名称" /><input className="h-10 w-16 rounded-xl border border-[#d9e1df] bg-white p-1" type="color" value={categoryColor} onChange={(event) => setCategoryColor(event.target.value)} /><button className="h-10 rounded-xl bg-[#2f5d62] px-4 text-sm font-black text-white" type="submit">新增分类</button></form><Table headings={["名称", "颜色", "创建时间"]} empty={!paged.length}>{(paged as Category[]).map((category) => <tr key={category.id} className="border-t border-slate-100"><td>{category.name}</td><td><span className="inline-block h-4 w-4 rounded-sm align-middle" style={{ backgroundColor: category.color }} /> {category.color}</td><td>{fmtTime(category.createdAt)}</td></tr>)}</Table></>}<Pagination page={page} total={filtered.length} onChange={setPage} /></Panel>}<AiReviewDialog state={aiReviewState} onClose={() => setAiReviewState(null)} onExecute={executeAiReview} onApprove={(post) => updatePost(post, "published", "", "")} onReject={(post) => updatePost(post, "draft", "rejected", "审核不通过，请修改后重新提交。")} /><PostDetailDialog post={detailPost} onClose={() => setDetailPost(null)} /><ConfirmDialog state={confirmState} busy={Boolean(busy)} onClose={() => setConfirmState(null)} /></div>;
}

function LoadingOverlay() {
  return <div className="fixed left-0 top-0 z-[9999] flex h-screen w-screen items-center justify-center bg-[#fbfaf6]/60 px-4 backdrop-blur-[1px]"><LoadingCard title="正在刷新数据" text="正在同步后台管理数据，请稍候。" /></div>;
}

function LoadingCard({ title, text }: { title: string; text: string }) {
  return <div className="w-full max-w-sm rounded-[28px] border border-[#d9e1df] bg-white p-7 text-center shadow-[0_24px_80px_rgba(47,93,98,0.20)]"><div className="mx-auto h-11 w-11 animate-spin rounded-full border-4 border-[#d9e1df] border-t-[#2f5d62]" /><h3 className="mt-5 text-xl font-black text-slate-950">{title}</h3><p className="mt-2 text-sm font-bold leading-6 text-slate-500">{text}</p></div>;
}

function ConfirmDialog({ state, busy, onClose }: { state: ConfirmState; busy: boolean; onClose: () => void }) {
  if (!state) return null;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#fbfaf6]/55 px-4 backdrop-blur-[1px]"><div className="w-full max-w-md rounded-[28px] border border-[#d9e1df] bg-white p-7 shadow-[0_24px_80px_rgba(47,93,98,0.20)]"><p className={`text-sm font-black ${state.danger ? "text-red-600" : "text-[#2f5d62]"}`}>{state.danger ? "危险操作" : "操作确认"}</p><h3 className="mt-3 text-2xl font-black text-slate-950">{state.title}</h3><p className="mt-4 leading-7 text-slate-600">{state.message}</p><div className="mt-7 flex gap-3"><button className="h-12 min-w-0 flex-1 rounded-full bg-[#eef4f3] px-5 text-sm font-black text-[#2f5d62]" disabled={busy} onClick={onClose}>取消</button><button className={`h-12 min-w-0 flex-1 rounded-full px-5 text-sm font-black text-white disabled:opacity-50 ${state.danger ? "bg-red-600" : "bg-[#2f5d62]"}`} disabled={busy} onClick={() => { const action = state.onConfirm; onClose(); action(); }}>{busy ? "处理中..." : "确认执行"}</button></div></div></div>;
}

function AiReviewDialog({ state, onClose, onExecute, onApprove, onReject }: { state: AiReviewState; onClose: () => void; onExecute: () => void; onApprove: (post: Post) => void; onReject: (post: Post) => void }) {
  if (!state) return null;
  const suggestion = state.result?.suggestion === "reject" ? "AI 建议不通过" : "AI 建议通过";
  const suggestionClass = state.result?.suggestion === "reject" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700";
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#fbfaf6]/55 px-4 backdrop-blur-[1px]"><div className="w-full max-w-2xl rounded-[28px] border border-[#d9e1df] bg-white p-7 shadow-[0_24px_80px_rgba(47,93,98,0.20)]"><p className="text-sm font-black text-[#2f5d62]">AI 审核</p><h3 className="mt-3 text-2xl font-black text-slate-950">{state.post.title}</h3><p className="mt-3 leading-7 text-slate-600">AI 只能给出审核建议，没有发布、拒绝或修改数据库的权限。最终是否通过仍由管理员决定。</p>{state.loading && <div className="mt-6 rounded-2xl bg-[#eef4f3] p-5 text-sm font-black text-[#2f5d62]">AI 正在审核文章内容，请稍候...</div>}{state.error && <div className="mt-6 rounded-2xl bg-red-50 p-5 text-sm font-bold leading-7 text-red-700">{state.error}</div>}{state.result && <div className="mt-6 space-y-4"><div className={`inline-flex rounded-full px-4 py-2 text-sm font-black ${suggestionClass}`}>{suggestion}</div><div className="rounded-2xl bg-slate-50 p-5"><p className="text-sm font-black text-slate-500">AI 评分</p><p className="mt-2 text-3xl font-black text-slate-950">{state.result.score}</p></div><div className="rounded-2xl bg-slate-50 p-5"><p className="text-sm font-black text-slate-500">AI 建议</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{state.result.summary}</p></div></div>}<div className="mt-7 flex flex-wrap justify-end gap-3"><button className="rounded-full bg-[#eef4f3] px-5 py-3 text-sm font-black text-[#2f5d62]" disabled={state.loading} onClick={onClose}>关闭</button>{!state.result && <button className="rounded-full bg-red-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50" disabled={state.loading} onClick={onExecute}>{state.loading ? "审核中..." : "确认执行 AI 审核"}</button>}{state.result && <><button className="rounded-full bg-red-600 px-5 py-3 text-sm font-black text-white" onClick={() => { onClose(); onReject(state.post); }}>管理员拒绝</button><button className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-black text-white" onClick={() => { onClose(); onApprove(state.post); }}>管理员通过</button></>}</div></div></div>;
}

function PostTable({ posts, commentsByPost, busy, onAi, onUpdate, onDelete, onView, showStatus }: { posts: Post[]; commentsByPost: Record<string, number>; busy: string; onAi: (post: Post) => void; onUpdate: (post: Post, status: "published" | "draft", reason: "" | "rejected" | "takedown", note: string) => void; onDelete?: (post: Post) => void; onView: (post: Post) => void; showStatus?: boolean }) {
  const headings = showStatus ? ["标题", "作者", "状态", "数据", "创建时间", "操作"] : ["标题", "作者", "数据", "创建时间", "操作"];
  const colWidths = showStatus ? ["320px", "115px", "105px", "220px", "135px", "260px"] : ["360px", "120px", "230px", "135px", "260px"];
  return <Table headings={headings} colWidths={colWidths} minWidth={showStatus ? "1170px" : "1050px"} empty={!posts.length}>{posts.map((post) => <tr key={post.id} className="border-t border-slate-100"><td><Cell title={post.title} sub={post.excerpt} /></td><td className="whitespace-nowrap">{post.authorName}</td>{showStatus && <td><Badge>{statusLabels[post.status] || post.status}</Badge></td>}<td className="leading-6">{post.viewCount ?? 0} 浏览 / {post.favoriteCount ?? 0} 收藏 / {commentsByPost[post.id] ?? 0} 评论</td><td>{fmtTime(post.createdAt)}</td><td className="space-x-2 whitespace-nowrap"><Action tone="info" onClick={() => onView(post)}>查看</Action>{post.status === "pending" && <><Action busy={busy === `post-${post.id}-ai`} onClick={() => onAi(post)}>AI 审核</Action><Action tone="success" onClick={() => onUpdate(post, "published", "", "")}>通过</Action><Action tone="danger" onClick={() => onUpdate(post, "draft", "rejected", "审核不通过，请修改后重新提交。")}>拒绝</Action></>}{post.status === "published" && <><Action onClick={() => onUpdate(post, "draft", "takedown", "文章已下架，请整改后重新提交审核。")}>下架</Action>{onDelete && <Action tone="danger" onClick={() => onDelete(post)}>删除</Action>}</>}</td></tr>)}</Table>;
}

function Panel({ title, subtitle, children }: { title?: string; subtitle?: string; children: React.ReactNode }) {
  return <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">{title && <div className="mb-4"><h2 className="text-xl font-black text-slate-950">{title}</h2>{subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}</div>}{children}</section>;
}
function Stat({ label, value, delta, tone }: { label: string; value: number; delta: number; tone: "teal" | "amber" | "blue" | "rose" }) {
  const tones = {
    teal: "bg-[#eef4f3] text-[#2f5d62] ring-[#d9e1df]",
    amber: "bg-[#fff7e8] text-[#9a6a12] ring-[#f2dfba]",
    blue: "bg-[#eef6ff] text-[#1d5f91] ring-[#cfe5f7]",
    rose: "bg-[#fff1f1] text-[#a33a3a] ring-[#f2d1d1]"
  };
  return <div className={`flex min-h-36 flex-col items-center justify-center rounded-[28px] p-5 text-center ring-1 ${tones[tone]}`}><p className="text-sm font-black opacity-70">{label}</p><p className="mt-3 text-4xl font-black">{value}</p><p className="mt-2 text-xs font-black opacity-75">今日 {delta >= 0 ? "+" : ""}{delta}</p></div>;
}
function TrendChart({ bars }: { bars: Array<{ key: string; label: string; posts: number; comments: number; users: number }> }) {
  const max = Math.max(1, ...bars.flatMap((bar) => [bar.posts, bar.comments, bar.users]));
  return <div><div className="grid gap-3 md:grid-cols-7">{bars.map((bar) => <div key={bar.key} className="rounded-2xl bg-slate-50 p-3"><div className="flex h-40 items-end justify-center gap-2"><TrendMetricBar value={bar.posts} max={max} color="#2f5d62" /><TrendMetricBar value={bar.comments} max={max} color="#c9a66b" /><TrendMetricBar value={bar.users} max={max} color="#1d5f91" /></div><p className="mt-2 text-center text-xs font-bold text-slate-500">{bar.label}</p></div>)}</div><div className="mt-4 flex flex-wrap gap-4 text-xs font-black text-slate-500"><Legend color="#2f5d62" label="文章" /><Legend color="#c9a66b" label="评论" /><Legend color="#1d5f91" label="用户" /></div></div>;
}
function TrendMetricBar({ value, max, color }: { value: number; max: number; color: string }) {
  return <span className="flex h-full w-6 flex-col items-center justify-end gap-1"><span className="h-4 text-[10px] font-black leading-4 text-slate-500">{value ? value : ""}</span><span className="w-3 rounded-t" style={{ height: `${Math.max(8, (value / max) * 100)}px`, backgroundColor: color }} /></span>;
}
function StatusSummary({ published, pending, returned, insight }: { published: number; pending: number; returned: number; insight: StatusInsight }) {
  const [hovered, setHovered] = useState<{ label: string; value: number; percent: number; color: string; x: number; y: number } | null>(null);
  const total = published + pending + returned;
  const items = [
    { label: "已发布", value: published, color: "#2f5d62" },
    { label: "待审核", value: pending, color: "#c9a66b" },
    { label: "退回草稿", value: returned, color: "#b42318" }
  ].map((item) => ({ ...item, percent: total ? (item.value / total) * 100 : 0 }));
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return <div className="grid gap-5 md:grid-cols-[220px_1fr] md:items-center"><div className="relative mx-auto h-48 w-48" onMouseLeave={() => setHovered(null)}><svg viewBox="0 0 180 180" className="h-full w-full -rotate-90 rounded-full"><circle cx="90" cy="90" r={radius} fill="none" stroke="#eef4f3" strokeWidth="34" />{items.map((item) => {
    const dash = (item.percent / 100) * circumference;
    const segmentOffset = offset;
    offset += dash;
    if (!item.value) return null;
    return <circle key={item.label} cx="90" cy="90" r={radius} fill="none" stroke={item.color} strokeWidth="34" strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-segmentOffset} className="cursor-pointer transition-opacity hover:opacity-80" onMouseMove={(event) => {
      const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
      setHovered({ ...item, x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) });
    }} />;
  })}</svg><div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><p className="text-3xl font-black text-slate-950">{total}</p><p className="text-xs font-bold text-slate-500">篇</p></div></div>{hovered && <div className="pointer-events-none absolute z-10 min-w-32 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-xl" style={{ left: Math.min(hovered.x + 10, 110), top: Math.max(hovered.y - 12, 8) }}><p className="flex items-center gap-2 font-black text-slate-950"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: hovered.color }} />{hovered.label}</p><p className="mt-1 font-bold text-slate-500">{hovered.value} 篇 / {hovered.percent.toFixed(1)}%</p></div>}</div><div className="space-y-3">{items.map((item) => <div key={item.label} className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3"><span className="flex items-center gap-2 font-bold text-slate-700"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span><span className="font-black">{item.value} <span className="text-xs text-slate-400">/ {item.percent.toFixed(1)}%</span></span></div>)}</div><div className="md:col-span-2 rounded-2xl border border-[#d9e1df] bg-[#fbfaf6] p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-black text-[#2f5d62]">AI 状态建议</p>{insight.loading && <span className="text-xs font-black text-slate-400">分析中...</span>}</div><div className="admin-scrollbar mt-3 max-h-28 overflow-y-scroll pr-2 text-sm font-bold leading-7 text-slate-600"><p className="whitespace-pre-wrap">{insight.content}</p></div>{insight.error && <p className="mt-2 text-xs font-bold text-red-500">{insight.error}</p>}</div></div>;
}
function Legend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />{label}</span>;
}
function Search({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div className="mb-4 flex gap-2 rounded-2xl border border-[#d9e1df] bg-[#fbfaf6] p-2"><input className="h-10 flex-1 rounded-xl border border-[#d9e1df] bg-white px-3 text-sm outline-none" value={value} onChange={(event) => onChange(event.target.value)} placeholder="搜索" />{value && <button className="rounded-xl border border-[#d9e1df] bg-white px-4 text-sm font-bold" type="button" onClick={() => onChange("")}>清空</button>}</div>;
}
function Table({ headings, children, empty, colWidths, minWidth }: { headings: string[]; children: React.ReactNode; empty?: boolean; colWidths?: string[]; minWidth?: string }) {
  return <div className="overflow-auto rounded-2xl border border-slate-100"><table className="w-full table-fixed text-left text-sm [&_td]:p-3 [&_td]:align-top [&_th]:p-3 [&_th]:align-top" style={{ minWidth: minWidth ?? "100%" }}><thead className="bg-slate-50"><tr>{headings.map((heading, index) => <th key={heading} className="font-black text-slate-600" style={colWidths?.[index] ? { width: colWidths[index] } : undefined}>{heading}</th>)}</tr></thead><tbody>{empty ? <tr><td className="p-10 text-center text-slate-500" colSpan={headings.length}>暂无数据</td></tr> : children}</tbody></table></div>;
}
function Cell({ title, sub }: { title?: string; sub?: string }) {
  return <div className="max-w-full overflow-hidden"><p className="truncate font-black text-slate-900">{title || "-"}</p>{sub && <p className="mt-1 truncate text-xs text-slate-500">{sub}</p>}</div>;
}
function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{children}</span>;
}
function PostDetailDialog({ post, onClose }: { post: Post | null; onClose: () => void }) {
  if (!post) return null;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#fbfaf6]/55 px-4 backdrop-blur-[1px]"><div className="max-h-[82vh] w-full max-w-3xl overflow-hidden rounded-[28px] border border-[#d9e1df] bg-white shadow-[0_24px_80px_rgba(47,93,98,0.20)]"><div className="border-b border-slate-100 p-6"><p className="text-sm font-black text-[#2f5d62]">文章详情</p><h3 className="mt-2 text-2xl font-black text-slate-950">{post.title}</h3><p className="mt-2 text-sm font-bold text-slate-500">{post.authorName} / {post.categoryName} / {statusLabels[post.status] || post.status} / {fmtTime(post.createdAt)}</p></div><div className="max-h-[52vh] overflow-y-auto p-6">{post.coverUrl && <img src={post.coverUrl} alt={post.title} className="mb-5 max-h-80 w-full rounded-2xl object-cover" />}<p className="rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">{post.excerpt || "暂无摘要"}</p>{post.moderationNote && <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold leading-7 text-red-700">{post.moderationNote}</p>}<article className="mt-5 whitespace-pre-wrap text-sm leading-8 text-slate-800">{post.content || post.excerpt || "暂无正文内容"}</article></div><div className="flex justify-end border-t border-slate-100 p-4"><button className="rounded-full bg-[#eef4f3] px-6 py-3 text-sm font-black text-[#2f5d62]" onClick={onClose}>关闭</button></div></div></div>;
}
function Action({ children, onClick, busy, disabled, tone = "neutral" }: { children: React.ReactNode; onClick: () => void; busy?: boolean; disabled?: boolean; tone?: "success" | "danger" | "neutral" | "info" }) {
  const tones = { success: "bg-emerald-600", danger: "bg-red-600", neutral: "bg-slate-700", info: "bg-blue-600" };
  return <button className={`rounded-xl px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-35 ${tones[tone]}`} disabled={busy || disabled} onClick={onClick}>{busy ? "处理中..." : children}</button>;
}
function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return <div className="mt-4 flex items-center justify-between text-sm text-slate-500"><span>共 {total} 条</span><div className="flex gap-2"><button className="rounded-xl border px-3 py-2 disabled:opacity-40" disabled={page <= 1} onClick={() => onChange(page - 1)}>上一页</button><span className="rounded-xl bg-[#eef4f3] px-3 py-2 font-black text-[#2f5d62]">{page} / {totalPages}</span><button className="rounded-xl border px-3 py-2 disabled:opacity-40" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>下一页</button></div></div>;
}




