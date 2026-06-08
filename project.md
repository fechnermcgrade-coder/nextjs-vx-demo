# Vitex 项目交接文档

更新时间：2026-06-08

本文档是下一个 AI 或开发者接手 `D:\nav\wtest\vitex\project_2` 时的入口。先读本文档，再改代码。旧的 `PROJECT_HANDOFF.md` 已被废弃，不要恢复。

## 项目定位

Vitex 是一个“微信小程序社区 + Next.js 后端/API + 管理后台”的项目。

- `qt/`：微信小程序端，普通用户使用。
- `ht/`：Next.js 15 App Router 项目，包含后端 API、Supabase/PostgreSQL 数据访问、AI 接口和管理后台。
- Next.js 首页 `/` 不是用户站点，当前主要进入 `/admin` 管理后台。
- 小程序本地请求后端地址：`http://localhost:3001`。
- 管理员使用 `/admin` 和 `/admin/ai`。
- 普通用户只使用微信小程序端。

## 当前技术栈

后端/管理端：

- Next.js `15.0.7`
- React `19.0.1`
- TypeScript
- Tailwind CSS
- `pg` 连接 Supabase PostgreSQL
- `jose` 处理 JWT
- `zod` 做接口校验
- DeepSeek 优先的 AI Provider，OpenAI 可作为备用，无 key 时有 demo fallback

微信小程序：

- 原生微信小程序 JavaScript
- 无云开发
- 通过 `wx.request` / `wx.uploadFile` 调用 `ht` 后端
- 通过本地 storage 保存 `token` 和用户信息，但必须做用户隔离

## 运行命令

在 `ht/` 下：

```powershell
npm.cmd run dev
npm.cmd run start
npm.cmd run build
npm.cmd run lint
npm.cmd run ts-check
npm.cmd run db:init
npm.cmd run db:fix-security-users
```

最近一次确认：

- `npm.cmd run ts-check` 通过。
- `node --check qt/pages/post/create/index.js` 通过。

## 环境变量

环境变量放在 `ht/.env.local`，不要把真实 secret 写入文档、代码或小程序端。

关键项：

```env
NEXT_PUBLIC_APP_URL=http://localhost:3001
DATA_MODE=supabase
DATABASE_URL=postgresql://...
JWT_SECRET=...

ADMIN_USERNAME=admin
ADMIN_PASSWORD=...

WECHAT_APP_ID=...
WECHAT_APP_SECRET=...

DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

当前代码主要通过 `DATABASE_URL` + `pg` 访问 Supabase 数据库，不依赖 Supabase REST key。

## 数据库和账号约束

数据库使用 Supabase PostgreSQL。`DATA_MODE=supabase` 且 `DATABASE_URL` 可用时使用云端数据库，否则 repository 有内存 demo fallback。

云端数据库曾执行并验证过修复脚本：

```powershell
cd ht
npm.cmd run db:fix-security-users
```

该脚本负责：

- 开启 public 表 RLS，避免 Supabase 提示 “RLS is disabled”。
- 只保留两个标准用户：
  - `admin@test.com`，用户名 `admin`，角色 `admin`，状态 `active`
  - `user@test.com`，用户名 `user`，角色 `user`，状态 `active`
- 保证 `username` 和 `nickname` 是同一个概念：用户名就是昵称，昵称就是用户名。
- 修复文章、评论、消息里的作者/发送者/接收者快照名。
- 创建或修复 `view_history` 等业务表。

重要原则：

- 项目中不要再显示“管理员”“小程序用户”这类旧作者名，应该显示真实用户名 `admin` / `user` 或用户后续改出的用户名。
- 用户名支持中文、字母、数字、下划线和短横线。
- 修改用户资料时，改的是用户名；兼容字段 `nickname` 也要同步为同一个值。
- 后端查询文章、评论、消息时应尽量 join `users.username`，避免沿用旧快照名。

核心表包括：

- `users`
- `posts`
- `comments`
- `favorites`
- `view_history`
- `messages`
- `notifications`
- `categories`
- `ai_review_results`

## 后端核心文件

- `ht/src/lib/db.ts`：PostgreSQL pool 与 `query()`。
- `ht/src/lib/env.ts`：环境变量和 `DATA_MODE`。
- `ht/src/lib/repository.ts`：主要数据访问层，含大量表结构修复/兼容逻辑。
- `ht/src/lib/store.ts`：内存 demo 数据。
- `ht/src/lib/auth.ts`：普通用户 JWT。
- `ht/src/lib/current-user.ts`：当前用户/管理员鉴权。
- `ht/src/lib/http.ts`：统一 JSON 响应。
- `ht/src/lib/password.ts`：密码 hash/校验。
- `ht/src/lib/ai-provider.ts`：DeepSeek/OpenAI/demo AI 抽象。
- `ht/src/lib/admin-ai-rag.ts`：后台 AI 的只读数据库上下文。
- `ht/src/lib/user-ai-rag.ts`：小程序用户 AI 的只读 RAG 上下文。

数据库脚本：

- `ht/supabase-schema.sql`
- `ht/scripts/init-db.mjs`
- `ht/scripts/fix-supabase-security-and-users.mjs`

## 管理后台

主要文件：

- `ht/src/app/admin/page.tsx`
- `ht/src/app/admin/ai/page.tsx`
- `ht/src/app/admin-nav.tsx`

当前能力：

- 管理员登录卡片居中，账号密码默认空。
- `/api/admin/login` 只允许管理员登录，普通用户不能进入工作台。
- 登录后导航栏显示社区名，以及“工作台”“AI 对话”按钮。
- 当前页面对应按钮有背景色。
- 未登录时不显示工作台和 AI 对话入口。
- `/admin` 包含总览、审核、文章、评论、用户、分类、热度模块。
- 总览含用户、待审文章、评论、浏览量统计，并显示“今日 +N”。
- 近 7 天变化为柱状图，柱上显示数值，底部有颜色图例。
- 状态分布有饼图。
- 刷新数据有居中加载卡片，不应挤压在页面顶部。
- 管理危险操作都应走确认弹窗，避免误触。
- 确认弹窗、AI 审核弹窗、文章详情弹窗现在使用浅色浮层，不再使用厚重黑幕。
- 审核模块和文章模块有蓝色“查看”按钮，弹窗内显示文章详情和封面图。
- 待审核文章显示 AI 审核按钮，已发布文章不显示 AI 审核按钮。
- AI 审核只给建议、评分和“建议通过/不通过”，没有最终权限；管理员仍需手动通过或拒绝。
- 已发布文章支持下架和删除。
- 下架会把文章打回用户草稿箱，并写入 `moderationReason=takedown` 与整改说明。
- 审核拒绝也会打回用户草稿箱，并写入 `moderationReason=rejected` 与拒绝说明。
- 评论管理不需要状态列，但需要删除操作。
- 用户管理中，已启用用户不能再执行启用，已停用用户不能再执行停用。

后台 AI 对话：

- 页面：`/admin/ai`
- 接口：`/api/admin/ai/chat`、`/api/admin/ai/title`
- 支持会话列表、新建、删除、重命名/AI 生成标题。
- Enter 发送，Shift+Enter 换行。
- 对话记录保存在浏览器本地 localStorage。
- AI 可通过后台 RAG 读取实时数据库上下文。
- 可回答例如“最热文章是哪篇”，热度逻辑为：

```text
heat = viewCount + favoriteCount * 5 + commentCount * 3
```

- 后台 AI 是只读助手，不能直接删除、下架、启用、停用或修改数据库。

## 微信小程序页面

`qt/app.json` 当前配置的页面：

- `pages/index/index`：首页文章流、搜索、最新/热门。
- `pages/login/index`：登录/注册。
- `pages/post/detail`：文章详情、评论、收藏、AI 推荐、作者会话。
- `pages/post/create/index`：发布新文章。
- `pages/post/edit/index`：编辑已有草稿/文章。
- `pages/profile/index`：个人中心、我的文章、草稿箱、审核中、收藏、历史、通知、退出。
- `pages/profile/edit/index`：编辑用户名、简介、头像。
- `pages/messages/index`：消息列表 + 普通用户 AI 助手。
- `pages/messages/chat`：与某个用户的私信详情。
- `pages/notifications/index`：通知列表。
- `pages/logs/logs`：默认遗留页，不是核心功能。

TabBar 图标位于：

- `qt/assets/tabbar/home-normal.png`
- `qt/assets/tabbar/home-active.png`
- `qt/assets/tabbar/compose-normal.png`
- `qt/assets/tabbar/compose-active.png`
- `qt/assets/tabbar/messages-normal.png`
- `qt/assets/tabbar/messages-active.png`
- `qt/assets/tabbar/profile-normal.png`
- `qt/assets/tabbar/profile-active.png`

## 小程序请求和登录隔离

核心文件：

- `qt/utils/request.js`

它负责：

- `API_BASE_URL = 'http://localhost:3001'`
- 自动带 `Authorization: Bearer <token>`
- `request()`
- `uploadImage()`
- `ensureLogin()`
- `getStoredUser()`
- `logout()`
- session scope / 用户隔离辅助函数

必须保持的规则：

- 未登录时 `getStoredUser()` 应返回 `null`。
- 退出登录必须清理 token、user、用户私有缓存、dirty flags。
- 切换用户后，个人中心、收藏、历史、消息、通知、详情页收藏状态都不能沿用上一个用户缓存。
- “我的收藏/浏览历史”等缓存必须带当前用户 session scope。
- 请求返回较慢时，旧用户的返回结果不能覆盖新用户页面。

最近修复过：

- “我的收藏”不再沿用上一个用户缓存。
- 当前用户未收藏某文章时，后端取消收藏会返回失败，不能误取消上一个用户收藏。
- 消息页游客状态使用和发布页/个人中心一致的登录提示卡片。

## 发布页和编辑页

发布页和编辑页不是同一个页面：

- 发布页：`qt/pages/post/create/index.js`
- 编辑页：`qt/pages/post/edit/index.js`

注意：

- 发布页是 tabBar 页面，微信会保留页面实例。
- 之前出现过“从编辑页返回个人中心再去发布页，发布页渲染编辑内容”的问题。
- 当前发布页已改为纯新建文章页面：
  - 进入发布页时重置空表单。
  - 保存草稿/提交审核成功后重置空表单。
  - 发布页只 `POST /api/posts`，不再根据残留 `id` 走编辑逻辑。
- 编辑已有文章必须走 `pages/post/edit/index`，由个人中心草稿卡片的“编辑”进入。

`qt/pages/post/create.js`、`qt/pages/post/create.wxml`、`qt/pages/post/create.wxss` 等根层旧文件仍可能存在，但 `app.json` 指向的是 `pages/post/create/index`。优先维护 indexed 页面。

## 文章流转

主要状态：

- `draft`：草稿，只属于用户，不投递后台。
- `pending`：审核中，进入后台审核模块。
- `published`：已发布，首页可见。

历史上存在 `rejected` 类型兼容，但当前业务通常是把拒绝/下架文章退回 `draft` 并携带审核元数据。

规则：

- 草稿保存到数据库，但不出现在后台管理待审列表。
- 用户提交审核后状态变为 `pending`。
- 管理员通过后变为 `published`。
- 管理员拒绝后回到用户草稿箱，并标记“审核不通过”。
- 管理员下架后回到用户草稿箱，并标记“下架待整改”。
- 草稿箱卡片要明确展示这些标签和原因。
- 已发布文章详情浏览会记录浏览历史。
- 文章封面就是文章图片，列表、详情和后台详情弹窗都应展示。

## 收藏、历史、评论

收藏：

- 文章详情收藏按钮支持 toggle。
- 第一次点击收藏。
- 已收藏状态再次点击视为取消收藏。
- 取消收藏必须弹窗确认，避免误触。
- 取消成功后设置 `favorites_dirty`，个人中心“我的收藏”需要刷新。
- 后端取消收藏必须校验当前用户确实收藏了该文章。

历史：

- 文章详情访问会记录当前登录用户浏览历史。
- 个人中心有浏览历史入口。
- 浏览历史旁有清空历史操作。
- 清空历史必须使用统一弹窗确认。

评论：

- 评论是模拟实时评论，不需要审核。
- 评论管理后台不显示状态列。
- 后台可以删除评论。

## 消息和通知

消息：

- `GET /api/messages/threads`
- `GET /api/messages?peerId=...`
- `POST /api/messages`

要求：

- 私信应持久化到数据库。
- 用户退出登录后，已发送的会话内容不能丢失。
- 从文章详情点击“作者会话”进入和作者的同一个已有对话；反复点击也进入同一个 peer 会话。
- 消息列表、详情页展示用户名，而不是旧的“管理员/小程序用户”。
- 小程序端普通用户 AI 助手可以有 RAG，但不能对接管理员权限。

通知：

- `GET /api/notifications`
- `POST /api/notifications`
- 管理员通过审核、拒绝审核、下架文章时，应创建通知给文章作者。
- 小程序通知页应能展示这些信息并支持标记已读。

## 上传

上传接口：

- `POST /api/uploads`

当前实现：

- 登录用户可上传。
- 文件保存到 `ht/public/uploads`。
- 返回 URL 给小程序保存。
- 用于用户头像和文章封面。

注意：

- 这是本地/原型适用方案。
- 如果正式部署到 serverless 或多实例环境，应迁移到 Supabase Storage 等持久化对象存储。

## AI 功能边界

Provider：

- `ht/src/lib/ai-provider.ts`
- 优先 DeepSeek。
- 可 fallback OpenAI。
- 无 key 时 demo fallback。
- Prompt 已要求不要自称 ChatGPT，除非用户明确问供应商，也只能说明当前接入供应商。

后台 AI：

- 面向管理员。
- 可读取后台可见实时数据库上下文。
- 可做运营问答、热度分析、审核建议。
- 不能直接执行增删改查危险操作。

小程序 AI：

- 面向普通用户。
- 可读取普通用户可见的 RAG 上下文：
  - 已发布文章
  - 当前用户自己的文章
  - 当前用户收藏
  - 当前用户浏览历史
- 不能声称拥有后台权限。
- 不能访问其他用户草稿或审核队列。

文章 AI：

- `POST /api/ai/write-post`
- `POST /api/ai/review-post`
- `POST /api/ai/recommend-post`

判断原则：

- AI 审核/推荐要能识别恶意、诈骗、违法、仇恨、骚扰、垃圾内容等明显风险。
- 不应因为文章普通、平庸、文笔一般就建议下架或不推荐。
- AI 推荐只给建议和评分，最终是否收藏由用户决定。
- AI 审核只给建议和评分，最终是否通过由管理员决定。

## API 概览

认证/用户：

- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/wx/login`
- `GET /api/users/me`
- `PUT /api/users/me/profile`
- `GET /api/users/me/favorites`
- `GET /api/users/me/history`
- `DELETE /api/users/me/history`

文章：

- `GET /api/posts`
- `POST /api/posts`
- `GET /api/posts/[id]`
- `PUT /api/posts/[id]`
- `DELETE /api/posts/[id]`
- `POST /api/posts/[id]/status`
- `GET /api/posts/[id]/comments`
- `POST /api/posts/[id]/comments`
- `POST /api/posts/[id]/favorite`
- `DELETE /api/posts/[id]/favorite`
- `POST /api/posts/[id]/view`

评论：

- `DELETE /api/comments/[id]`

分类/标签：

- `GET /api/categories`
- `POST /api/categories`
- `PUT /api/categories`
- `DELETE /api/categories`
- `GET /api/tags`

消息/通知/上传：

- `GET /api/messages/threads`
- `GET /api/messages?peerId=...`
- `POST /api/messages`
- `GET /api/notifications`
- `POST /api/notifications`
- `POST /api/uploads`

管理端：

- `POST /api/admin/login`
- `GET /api/admin/summary`
- `GET /api/admin/posts`
- `PUT /api/admin/posts`
- `GET /api/admin/comments`
- `GET /api/admin/users`
- `PUT /api/admin/users`
- `GET /api/admin/ai/reviews`
- `PUT /api/admin/ai/reviews`
- `POST /api/admin/ai/chat`
- `POST /api/admin/ai/title`

AI：

- `POST /api/ai/profile-chat`
- `POST /api/ai/review-post`
- `POST /api/ai/review-comment`
- `POST /api/ai/recommend-post`
- `POST /api/ai/recommendations/generate`
- `POST /api/ai/tags/generate`
- `POST /api/ai/summary/generate`
- `POST /api/ai/write-post`

健康检查：

- `GET /api/health`

## UI 约定

小程序：

- 全局样式在 `qt/app.wxss`。
- 登录提示卡片应复用：
  - `.login-guard`
  - `.login-guard-title`
  - `.login-guard-text`
  - `.login-guard-btn`
  - `.card-shadow`
- 不要随意在单页重新定义不同风格的登录提示卡片。
- 所有删除、清空、取消收藏、提交审核、下架等误触风险操作都应有确认弹窗。
- 弹窗样式尽量统一。

后台：

- Tailwind 写在页面组件里。
- 管理操作必须保留确认弹窗。
- 弹窗应是自然浮在页面上的浅色浮层，不要厚重黑幕。
- 刷新/恢复登录加载态应为页面中心卡片。

## 编码注意

PowerShell 有时会把中文显示成乱码，这不一定代表文件真实损坏。怀疑编码时，用 Node 按 UTF-8 读取确认：

```powershell
node -e "const fs=require('fs'); console.log(fs.readFileSync('qt/pages/messages/index.wxml','utf8'))"
```

不要因为 PowerShell 显示乱码就大面积重写文件。先确认真实文件内容。

## Git 和备份

- 当前目录是 Git 仓库。
- 远程曾设置为 `https://github.com/fechnermcgrade-coder/nextjs-vx-demo.git`。
- 用户曾要求把 `ht` 和 `qt` 全量推送备份。
- 工作区可能存在未提交修改。
- 不要执行 `git reset --hard`、`git checkout --` 等会丢改动的命令。

## 参考项目

用户提供过参考项目：

```text
D:\nav\wtest\vitex\project_1
```

使用方式：

- 可以参考其个人中心、私信滚动、文章流转、后台交互。
- 不要生搬硬套 UI。
- 当前项目有自己的小程序结构和管理后台风格。

## 已知遗留/未来优化

- `qt/pages/post/create.*` 根层旧文件仍存在，但实际页面是 `qt/pages/post/create/index.*`。
- `qt/pages/logs/logs` 是默认遗留页，可后续移除。
- 管理端 AI 会话目前在浏览器 localStorage，不是数据库持久化。
- 小程序消息页内的 AI 助手临时对话是否长期持久化，需要根据后续产品需求决定；用户私信已经要求数据库持久化。
- 上传目前是本地磁盘方案，生产环境应迁移到持久化对象存储。
- Supabase 连接偶尔会超时，执行 DB 修复脚本时可重试一次。

## 下一位接手规则

- 先读 `project.md`。
- 不要恢复 `PROJECT_HANDOFF.md`。
- 不要泄露 `.env.local`。
- 不要重置 Git 工作区。
- 小程序端改用户相关逻辑时，必须考虑登录态和用户隔离。
- 后台危险操作必须有确认弹窗。
- AI 功能默认只读或建议型，除非明确设计“受控后端动作 + 人工确认”。
- 涉及 Supabase 的问题，不能只改本地代码；必要时同步脚本和云端数据库。
