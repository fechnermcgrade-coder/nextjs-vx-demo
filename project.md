# Vitex 项目交接文档

更新时间：2026-06-11  
项目根目录：`D:\nav\wtest\vitex\project_2`

## 1. 项目概况

Vitex 是一个微信小程序社区/博客项目，包含：

- `ht/`：Next.js 15 后端、管理后台、API 服务。
- `qt/`：微信小程序前端。
- `界面原型图/`：项目演示和 PPT 使用的界面截图素材。
- `Vitex_project_demo.pptx`：项目演示 PPT。

当前目标是把参考 Next.js 项目重构为微信小程序 + Next.js API 后台。项目已经实现了文章发布、草稿、审核、下架、评论、收藏、浏览历史、私信、通知、图片上传、后台管理、AI 审核、AI 推荐、后台 AI 对话和普通用户 AI 助手。

## 2. 技术栈

后端/管理端：

- Next.js `15.0.7`
- React `19.0.1`
- TypeScript
- Tailwind CSS
- PostgreSQL / Supabase
- `pg`
- `jose` JWT
- `zod`

小程序端：

- 微信小程序原生 WXML/WXSS/JS
- API 基础地址在 `qt/utils/request.js`，当前默认 `http://localhost:3001`
- 登录态保存在 `wx` storage：`token` 和 `user`

常用命令：

```bash
cd ht
npm install
npm run dev
npm run ts-check
npm run build
npm run db:init
npm run db:fix-security-users
```

后端默认端口：`3001`

## 3. 环境变量

后端环境配置由 `ht/src/lib/env.ts` 读取。常见变量包括：

- `DATABASE_URL`：PostgreSQL/Supabase 连接串。
- `APP_JWT_SECRET`：应用 JWT 密钥。
- `NEXT_PUBLIC_APP_URL`：上传文件返回 URL 的基础地址。
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_MODEL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

AI 优先使用 DeepSeek；没有 DeepSeek 时才尝试 OpenAI；都没有时走本地 fallback 文案。

## 4. 数据库设计

数据库 schema 在 `ht/supabase-schema.sql`。

主要表：

- `users`
  - 用户表。
  - `username` 就是昵称，`nickname` 必须等于 `username`。
  - 有约束：`users_nickname_matches_username check (nickname = username)`。
  - 用户名支持中文。
  - 邮箱登录用户当前约定只保留：
    - 管理员：`admin@test.com`
    - 普通用户：`user@test.com`

- `categories`
  - 文章分类。
  - 后台可新增分类。
  - 小程序发布页和编辑页已经接入分类选择。

- `posts`
  - 文章表。
  - 状态：`draft`、`pending`、`published`、`rejected`。
  - 用户草稿会写数据库，但不会投递到后台审核列表。
  - 审核拒绝、后台下架都会回到用户草稿箱，并带 `moderation_reason` / `moderation_note`。
  - `cover_url` 是文章封面/文章图片，详情页和后台查看弹窗可展示。
  - `author_name` 兼容旧数据，但 repository 查询时优先使用关联用户的 `username/nickname`。

- `comments`
  - 评论默认就是发布态。
  - 不需要审核。
  - 后台只提供删除操作。

- `favorites`
  - 收藏表。
  - `POST /api/posts/[id]/favorite` 收藏。
  - `DELETE /api/posts/[id]/favorite` 取消收藏。
  - 后端会检查当前用户是否真的收藏，避免跨用户缓存误删。

- `view_history`
  - 浏览历史表。
  - 查看已发布文章时记录。
  - 支持清空历史。

- `messages`
  - 私信表。
  - 通过 `sender_id`、`receiver_id` 存储。
  - 同一个作者会话反复点击应进入同一会话，数据不会因退出登录丢失。

- `notifications`
  - 通知表。
  - 管理员审核通过、拒绝、下架会创建通知给文章作者。

- `ai_review_results`
  - AI 审核/推荐/摘要等记录表。

安全脚本：

- `ht/scripts/fix-supabase-security-and-users.mjs`
  - 用于修复 Supabase RLS/策略、用户约束、两个固定用户等。
  - 如果云端数据库和本地代码不一致，优先检查并执行这个脚本。

## 5. 后端 API 概览

认证：

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/wx/login`
- `POST /api/admin/login`

用户：

- `GET /api/users/me`
- `PUT /api/users/me/profile`
  - 修改用户名/昵称、简介、头像。
  - 用户名就是昵称，后端会同步 `username` 和 `nickname`。

文章：

- `GET /api/posts`
  - 未带 `mine=1` 时返回已发布文章。
  - `mine=1` 时返回当前用户文章，可按 `status` 过滤。
- `POST /api/posts`
  - 创建文章。
  - `submit=false` 保存草稿。
  - `submit=true` 提交审核。
  - 支持 `categoryId`、`coverUrl`。
- `GET /api/posts/[id]`
  - 已发布文章游客可见；草稿/待审/拒绝只允许作者或管理员可见。
  - 已发布文章会记录浏览量和浏览历史。
- `PUT /api/posts/[id]`
  - 作者可修改草稿/被拒文章。
  - 普通用户不能直接编辑审核中或已发布文章。
  - 支持更新分类和封面。
- `DELETE /api/posts/[id]`
  - 普通用户只能删除草稿/被拒文章。
  - 管理员可删除。
- `POST /api/posts/[id]/status`
  - `submit`：草稿提交审核。
  - `unpublish`：用户主动将已发布文章下架回草稿。
- `POST /api/posts/[id]/favorite`
- `DELETE /api/posts/[id]/favorite`
- `POST /api/posts/[id]/view`
- `GET /api/posts/[id]/comments`
- `POST /api/posts/[id]/comments`

收藏/历史：

- `GET /api/users/me/favorites`
- `GET /api/users/me/history`
- `DELETE /api/users/me/history`

消息/通知：

- `GET /api/messages/threads`
- `GET /api/messages?peerId=...`
- `POST /api/messages`
- `GET /api/notifications`
- `POST /api/notifications` 标记已读

分类/上传：

- `GET /api/categories`
- `POST /api/categories` 管理员
- `PUT /api/categories` 管理员
- `DELETE /api/categories?id=...` 管理员
- `POST /api/uploads`
  - 登录用户上传图片。
  - 当前落到 `ht/public/uploads`，返回 `/uploads/...` URL。

后台管理：

- `GET /api/admin/summary`
- `GET /api/admin/posts`
  - 不返回普通用户草稿。
- `PUT /api/admin/posts`
  - 审核通过、拒绝、下架。
  - 会给作者创建通知。
- `GET /api/admin/comments`
- `GET /api/admin/users`
- `PUT /api/admin/users`
- `GET /api/admin/recommendations`

AI：

- `POST /api/ai/write-post`
  - 小程序发布页 AI 生文。
- `POST /api/ai/recommend-post`
  - 文章详情页 AI 点评/推荐/打分。
- `POST /api/ai/profile-chat`
  - 小程序消息页 AI 助手，普通用户权限 RAG。
- `POST /api/ai/review-post`
  - 后台待审文章 AI 审核建议。
- `POST /api/ai/review-comment`
- `POST /api/ai/tags/generate`
- `POST /api/ai/summary/generate`
- `POST /api/ai/recommendations/generate`
- `POST /api/admin/ai/chat`
  - 管理后台 AI 对话，管理员权限 RAG。
- `POST /api/admin/ai/title`
  - 后台 AI 对话标题生成。
- `GET/PUT /api/admin/ai/reviews`

## 6. Repository 层

核心文件：`ht/src/lib/repository.ts`

该层做了两套数据源兼容：

- 有 `DATABASE_URL` 时使用 PostgreSQL。
- 没有数据库时回退 `ht/src/lib/store.ts` 的内存数据。

重要逻辑：

- `createPost`
  - 自动生成摘要。
  - 若未传 `categoryId`，兜底第一个分类或创建默认分类。
  - 作者名使用用户 `username/nickname`。

- `updatePost`
  - 支持更新标题、内容、封面、分类、状态、审核原因/备注。

- `recordPostView`
  - 增加浏览量。
  - 登录用户会写入 `view_history`。

- `favoritePost` / `unfavoritePost`
  - 收藏和取消收藏。
  - 取消收藏会检查当前用户记录，避免用户隔离问题。

- `listFavoritePosts` / `listViewHistoryPosts`
  - 个人中心收藏和历史数据来源。

- `listMessageThreads` / `listMessages` / `createMessage`
  - 私信会话和消息持久化。

- `createNotification`
  - 后台审核流通知作者。

## 7. 管理后台

主文件：

- `ht/src/app/admin/page.tsx`
- `ht/src/app/admin/ai/page.tsx`
- `ht/src/app/admin-nav.tsx`

登录：

- 只有管理员可登录。
- 登录卡片居中。
- 登录表单不默认填账号密码。

导航：

- 未登录不显示工作台/AI 对话。
- 登录后右侧显示“工作台”和“AI 对话”。
- 当前页面按钮有背景色。

工作台：

- 总览、审核、文章、评论、用户、分类、热度模块。
- 所有危险/管理操作都应走统一确认弹窗。
- 审核和文章模块有“查看”按钮，弹窗展示文章详情和封面图。
- 待审文章有 AI 审核按钮；已发布文章没有 AI 审核按钮。
- 评论无状态列，提供删除操作。
- 用户启用/停用按钮会根据当前状态禁用。
- 分类模块可新增分类。
- 近 7 天趋势有颜色图例。
- 状态分布是 SVG 环形图，悬浮只显示自定义 tooltip，不使用浏览器原生 title。
- 最近内容有固定高度滚动，不会撑高卡片。
- 状态分布下方有 `AI 状态建议` 小卡片，内容区固定高度滚动。
- `刷新数据` 和 `刷新 AI 建议` 已拆分：
  - 刷新数据只拉管理数据，不等待 AI。
  - 刷新 AI 建议是独立按钮，使用柔和琥珀色，与主按钮区分但不突兀。
  - 刷新 AI 建议也走统一确认弹窗。

AI 对话页：

- 会话保存在浏览器本地存储。
- 支持新建、切换、删除、返回旧会话。
- Enter 发送，Shift+Enter 换行。
- 对话列表可滚动。
- 后台 AI 对话通过 `buildAdminAiRagContext` 检索数据库上下文。
- AI 不允许直接执行增删改查，只能给建议；写操作仍需管理员在工作台确认。

## 8. 小程序页面

小程序入口：`qt/app.json`

页面：

- `pages/index/index`
  - 首页文章流。
  - 已发布文章列表、搜索/排序。
  - 热度逻辑：浏览量 + 收藏数 * 5 + 评论数 * 3。

- `pages/login/index`
  - 邮箱登录/注册。
  - 登录后保存 token 和 user。
  - 登录后根据 next 返回。

- `pages/post/detail`
  - 文章详情。
  - 展示封面、正文、评论。
  - 收藏按钮：
    - 未收藏 -> 收藏。
    - 已收藏 -> 弹窗确认取消收藏。
  - AI 推荐按钮：
    - 调用 `/api/ai/recommend-post`。
    - AI 只给建议和打分，是否收藏仍由用户决定。
  - 作者会话按钮：
    - 进入和作者的私信会话。
    - 反复点击进入同一会话。
  - 评论提交。

- `pages/post/create/index`
  - 发布页。
  - 登录守卫。
  - 支持文章封面上传。
  - 支持文章分类选择。
  - 支持 AI 生文。
  - 保存草稿和提交审核都走确认弹窗。
  - 草稿写数据库但不进入后台。

- `pages/post/edit/index`
  - 编辑页。
  - 和发布页不是同一个页面，避免发布页带出编辑态。
  - 支持封面上传和分类回显/修改。
  - 可保存草稿或重新提交审核。

- `pages/profile/index`
  - 个人中心。
  - 我的文章、草稿箱、审核中、收藏、浏览历史。
  - 草稿箱会显示审核不通过/下架待整改标签。
  - 收藏和历史缓存按当前用户 `sessionScope` 隔离，避免退出登录后串数据。
  - 清空历史、取消收藏、下架、删除、退出登录等都有确认弹窗。

- `pages/profile/edit/index`
  - 编辑资料。
  - 不使用顶部卡片。
  - 支持上传头像。
  - 修改用户名即修改昵称。

- `pages/messages/index`
  - 消息列表。
  - 游客状态显示统一登录提示卡片。
  - 登录后显示私信会话列表和 AI 助手。
  - AI 助手接入 `/api/ai/profile-chat`，有普通用户权限 RAG。
  - AI 聊天区域做了滚动。

- `pages/messages/chat`
  - 私信详情。
  - 消息持久化在数据库。
  - 退出登录不会丢失。
  - 发送按钮宽度已调窄。

- `pages/notifications/index`
  - 通知列表。
  - 可接收管理员审核通过、拒绝、下架等通知。
  - 支持全部标记已读。

## 9. AI / RAG 当前实现

AI provider：`ht/src/lib/ai-provider.ts`

- `runAiTask`
  - 内容审核、标签、摘要、推荐。
- `runAiChat`
  - 后台/小程序 AI 对话。
- `runAiTitle`
  - 后台 AI 对话标题。
- `runAiPostWriter`
  - 小程序发布页 AI 生文。

后台 RAG：`ht/src/lib/admin-ai-rag.ts`

- 读取管理端可见数据：
  - 所有后台文章
  - 评论
  - 用户
  - 分类
  - 管理统计
- 根据问题关键词匹配文章标题、摘要、正文、分类、作者、标签、状态。
- 补充热门文章、待审文章、最近文章。
- 热度逻辑：浏览量 + 收藏数 * 5 + 评论数 * 3。
- 注意：这是关键词 RAG，不是向量检索；没有 pgvector/embedding。

小程序 RAG：`ht/src/lib/user-ai-rag.ts`

- 只读取普通用户可见上下文：
  - 公开已发布文章
  - 当前用户自己的文章
  - 当前用户收藏
  - 当前用户浏览历史
  - 分类
- 不能访问后台审核队列、其他用户草稿、管理权限。

重要边界：

- AI 可以分析、建议、点评、打分。
- AI 不能直接执行删除、下架、审核通过、停用用户等写操作。
- 后台写操作必须由管理员点击按钮并确认弹窗后执行。

## 10. 图片上传

后端：

- `POST /api/uploads`
- 文件落到 `ht/public/uploads`
- 返回公开 URL

小程序：

- 文章封面：
  - `pages/post/create/index`
  - `pages/post/edit/index`
  - 详情页展示 `coverUrl`
  - 后台文章详情弹窗也展示图片

- 用户头像：
  - `pages/profile/edit/index`
  - 保留默认头像逻辑
  - 用户上传头像后使用上传头像

## 11. 登录态与用户隔离

小程序请求封装：`qt/utils/request.js`

关键点：

- `request` 自动带 Authorization Bearer token。
- `uploadImage` 上传图片时带 token。
- 401 时会调用 `logout()` 清理 token/user。
- `getSessionUserId` / `getSessionScope` 用于缓存隔离。
- `clearSessionStorage` 当前清理 `favorites_dirty` 等会话级缓存。

个人中心收藏/历史缓存：

- 使用 `sessionScope` 分用户缓存。
- 切换用户或退出登录时会重置私有状态。
- `favorites_dirty` 用于详情页收藏变化后通知个人中心刷新收藏列表。

## 12. 已知注意点

- `qt/pages/post/create.*` 根文件仍存在，但 `app.json` 实际使用的是 `pages/post/create/index`。不要误改废弃入口。
- PowerShell 有时会把中文输出显示成乱码，不一定代表文件本身损坏。读写中文文件时尽量用 Node UTF-8 或 `apply_patch`。
- `ht/src/app/admin/page.tsx` 目前 JSX 很多是一行压缩写法，手工改动要小心闭合标签。
- 运行 `npm run ts-check` 可快速发现后台 TSX 语法问题。
- Supabase 云端如果出现 RLS disabled 或用户数据不一致，优先检查 `ht/scripts/fix-supabase-security-and-users.mjs`。
- 目前 RAG 是关键词检索，不是向量数据库；如果要增强，需要设计 embedding 表、切片、召回和来源引用。
- AI 状态建议的按钮在后台顶部，和刷新数据分离，刷新数据不再等待 AI。
- `project.md` 是当前唯一交接文档；旧的 `PROJECT_HANDOFF.md` 已删除，不要恢复。

## 13. 最近关键变更

- 小程序发布页/编辑页新增文章分类选择：
  - `qt/pages/post/create/index.js`
  - `qt/pages/post/create/index.wxml`
  - `qt/pages/post/create/index.wxss`
  - `qt/pages/post/edit/index.js`
  - `qt/pages/post/edit/index.wxml`
  - `qt/pages/post/edit/index.wxss`

- 后台总览增强：
  - 最近内容固定高度滚动。
  - 状态分布改为可 hover 的 SVG 环形图。
  - 去掉浏览器原生 tooltip，只保留自定义 tooltip。
  - 状态分布下方增加 AI 状态建议卡片。
  - AI 建议卡片正文固定高度滚动。
  - 刷新数据与刷新 AI 建议拆分。
  - 刷新 AI 建议按钮使用琥珀色，并走统一确认弹窗。

- 项目已推送到：
  - `https://github.com/fechnermcgrade-coder/nextjs-vx-demo`
  - 分支：`main`

## 14. 接手建议

接手后建议先做：

1. 运行 `cd ht && npm run ts-check`。
2. 查看 `git status --short`，确认当前是否有未提交改动。
3. 若要调试小程序接口，启动 `cd ht && npm run dev`，端口为 `3001`。
4. 确认 `.env` 中数据库和 AI key 是否可用。
5. 如果涉及云端数据库，务必同时更新 Supabase，不要只改本地 schema。
6. 后台危险操作继续沿用统一确认弹窗。
7. 小程序涉及用户私有数据时，继续按 `sessionScope` 做用户隔离。

