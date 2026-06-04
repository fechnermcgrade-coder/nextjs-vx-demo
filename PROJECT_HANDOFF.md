# Project Handoff

This document summarizes the planning conversation for the project in `D:\nav\wtest\vitex\project_2`.
It is intended for the next Codex session to read before implementing.

## 2026-06-03 Rollback Recovery Status

User reported an accidental git rollback by another tool with no backup. This section records what was recovered in `project_2` after that rollback. Read this before older historical notes.

### Recovery Completed

- Backend/Next.js TypeScript check passes with `npm.cmd run ts-check` from `ht`.
- `ht/src/app/layout.tsx` again uses `AdminNav` and clean Chinese metadata.
- Admin login remains empty by default and is admin-only through `/api/admin/login`.
- `ht/src/app/admin/page.tsx` is restored as a functional management console with confirmation dialogs, dashboard metrics, review/posts/comments/users/categories/heat tabs, AI review action for pending posts, comment delete action, article approve/reject/takedown/delete flows, and cached session data to avoid needless refresh when returning from AI chat.
- `ht/src/app/admin/ai/page.tsx` is restored with admin route guard, persistent `localStorage` conversations, conversation list, new/delete/rename, Enter-to-send, Shift+Enter newline, no send button, always-visible internal scrollbars, and AI-generated title support through `/api/admin/ai/title`.
- `ht/src/lib/ai-provider.ts` keeps DeepSeek-first chat/title/task behavior and tells the assistant not to introduce itself as ChatGPT.
- Image upload support was restored:
  - `ht/src/app/api/uploads/route.ts`
  - `ht/public/uploads/.gitkeep`
  - Mini Program article cover upload/preview/save
  - Mini Program profile avatar upload/preview/save
- Article flow was restored:
  - user drafts are saved to DB but not listed in admin backend
  - submit sends article to `pending`
  - admin reject returns it to user draft box with `moderationReason: "rejected"`
  - admin takedown returns published article to user draft box with `moderationReason: "takedown"`
  - draft cards show labels for review failure or takedown整改
- `ht/src/app/api/ai/review-post/route.ts` was recreated and only allows AI review for `pending` posts.
- `ht/src/app/api/posts/route.ts`, `ht/src/app/api/posts/[id]/route.ts`, and `ht/src/app/api/admin/posts/route.ts` were restored with cover URL and moderation metadata support.
- `ht/src/app/api/auth/register/route.ts` and repository email-user creation were restored.
- `qt` Mini Program pages restored/cleaned for index, detail, create, edit, profile, upload preview, draft/pending/published tabs, and article cover display.
- `qt/app.json` uses generated tabbar PNGs under `qt/assets/tabbar`.
- `ht/supabase-schema.sql` was rebuilt with `users.email`, `users.username`, `users.password_hash`, nickname=username constraint, `posts.cover_url`, `posts.moderation_reason`, `posts.moderation_note`, and without old `hidden` status.
- `ht/package.json` includes `db:fix-security-users`.

### Cloud Database Reminder

Before the accidental rollback, cloud Supabase had already been fixed once:

- RLS enabled on public tables.
- Only two users kept:
  - admin: `admin@test.com`
  - user: `user@test.com`
- Username and nickname were aligned so username is nickname and nickname is username.
- Checked columns existed for `posts.cover_url`, `posts.moderation_reason`, `posts.moderation_note`, and `users.avatar_url`.

After rollback recovery, code and scripts are restored, but this recovery pass did not rerun the cloud DB script. If cloud state is uncertain, run from `ht`:

```text
npm.cmd run db:fix-security-users
```

### Verification Done In Recovery

```text
npm.cmd run ts-check
```

Result: passed.

## 2026-06-02 Latest Implementation Status

Read this section first. It supersedes older historical notes below that describe `ht` as empty or the Mini Program as a default template.

### Product Direction Locked By User

- `qt` is the only user-facing frontend. It is a WeChat Mini Program display/client app.
- `ht` is the Next.js 15 backend, business logic layer, API server, Supabase/PostgreSQL access layer, AI integration layer, and administrator console.
- `http://localhost:3001` must not be a normal Web article homepage. It should route to the administrator console.
- Ordinary users browse, login, post, comment, message, and view notifications through the Mini Program.
- Administrators use the Next.js `/admin` page for moderation and operations.

### Latest Code Changes Implemented

Next.js/backend changes:

- `ht/src/app/page.tsx` now redirects `/` to `/admin`.
- `ht/src/app/layout.tsx` title/navigation now clearly reflects the admin/API role.
- `ht/src/app/admin/page.tsx` was rewritten as a fuller management console:
  - login
  - summary metrics
  - post moderation
  - comment moderation
  - user enable/disable
  - category creation/listing
  - AI review list and status updates
  - recommendation list
  - loading/error/action feedback
- `ht/src/app/api/health/route.ts` was added. It checks:
  - whether important env vars are present, without printing secret values
  - data mode
  - AI provider choice
  - database connectivity
  - whether required public tables exist
- `ht/supabase-schema.sql` was rewritten with clean Chinese defaults and idempotent table/index creation.
- `ht/scripts/init-db.mjs` was added. It reads `ht/.env.local`, creates schema, and writes idempotent demo data.
- `ht/package.json` now has:

```text
npm.cmd run db:init
```

Mini Program changes:

- `qt/app.json`, `qt/app.wxss`, and `qt/utils/request.js` were cleaned up.
- The Mini Program API base remains:

```js
const API_BASE_URL = 'http://localhost:3001'
```

- Main Mini Program pages were rewritten/cleaned with readable Chinese and better states:
  - `qt/pages/index/*`: article feed, login, create post, profile/messages/notifications navigation.
  - `qt/pages/post/detail.*`: article detail and comments.
  - `qt/pages/post/create.*`: submit article for admin review.
  - `qt/pages/profile/index.*`: profile view/edit.
  - `qt/pages/messages/index.*`: message thread list.
  - `qt/pages/messages/chat.*`: chat view/send message.
  - `qt/pages/notifications/index.*`: notification list and mark-all-read.

Other cleanup:

- `ht/src/lib/ai-provider.ts` was rewritten to fix mojibake and keep DeepSeek first, OpenAI fallback, demo fallback if no AI key exists.
- `ht/src/app/api/uploads/route.ts` was rewritten with clean Chinese. It is still intentionally a placeholder and does not implement Supabase Storage yet.

### Database Initialization Already Completed

The following command initially failed in the sandbox with `connect EACCES 198.18.0.160:5432`, then succeeded after running with approval outside the sandbox:

```text
npm.cmd run db:init
```

Successful output summary:

```json
{
  "mode": "supabase",
  "counts": {
    "users": 3,
    "categories": 3,
    "posts": 3,
    "comments": 3,
    "messages": 2,
    "notifications": 2,
    "ai_review_results": 2
  }
}
```

This means Supabase is reachable when not blocked by the tool sandbox, and demo data has been inserted.

### Validation Completed

From `ht`:

```text
npm.cmd run ts-check
npm.cmd run lint
npm.cmd run build
```

All passed. The first `build` attempt timed out at the final trace step because the timeout was 120 seconds, but rerunning with a longer timeout completed successfully.

Build result confirms:

- `/` is static and tiny, only redirecting to `/admin`.
- `/admin` is the only Web UI page.
- API routes are dynamic.

### Current Blocker / Next Handoff Point

The only unresolved item is local runtime verification from this Codex environment.

What was observed:

- Running the dev server in the foreground works:

```text
npm.cmd run dev
```

or:

```text
D:\vpnstore\AIservice\vx\node.exe node_modules\next\dist\bin\next dev -p 3001
```

Foreground logs show:

```text
Ready in 6-12s
Local: http://localhost:3001
```

- Attempts to keep the server running in the background from this Codex Windows shell were unreliable. `Start-Process` without logs returned but did not leave a listening process; `Start-Process` with redirected output hit a Windows env error about duplicate `Path`/`PATH`.
- A temporary PowerShell job started the dev server and compiled `/api/health`, but `/api/health` returned `503` during that sandboxed job. This is likely because the job was running in the restricted sandbox where Supabase TCP access is blocked, the same reason `db:init` first failed with `EACCES`.
- Do not treat the `503` as proof the app is broken. `db:init` succeeded outside the sandbox and `build` passed.

Recommended next step:

```powershell
cd D:\nav\wtest\vitex\project_2\ht
npm.cmd run dev
```

Then manually open:

```text
http://localhost:3001
```

Expected result: it should redirect/show the administrator console at `/admin`.

Then verify:

```text
http://localhost:3001/api/health
```

If `/api/health` returns `503`, inspect the JSON body. Most likely causes:

- Node process cannot reach Supabase due to local network/proxy restrictions.
- `DATABASE_URL` host/password encoding is wrong.
- Required tables are missing, in which case rerun `npm.cmd run db:init` outside the sandbox.

### Important Constraints For Next AI

- Do not add a public Web frontend in Next.js unless the user explicitly asks. The user corrected this strongly.
- Do not put secrets in `qt`.
- Do not print `.env.local` values in chat or logs.
- Keep `qt` as the display/client app.
- Keep `ht` as admin/API/business logic only.
- Upload is intentionally placeholder for now; do not add Supabase Storage unless asked.
- Use `DATABASE_URL` Session Pooler style for Supabase/PostgreSQL.
- If a DB command fails with `EACCES 198.18.x.x:5432`, retry with approved non-sandbox execution.

## 2026-06-02 Implementation Handoff Update

This project is no longer just a plan. A full first skeleton has been implemented.

Current project shape:

- `ht`: Next.js 15 App Router backend plus administrator web console.
- `qt`: WeChat Mini Program JavaScript frontend.
- `PROJECT_HANDOFF.md`: planning and continuation notes.

Important files now present:

- `ht/src/lib/db.ts`: PostgreSQL connection pool using `pg` and `DATABASE_URL`.
- `ht/src/lib/repository.ts`: data repository. Uses Supabase/PostgreSQL when `DATA_MODE=supabase` and `DATABASE_URL` exists; otherwise demo in-memory data.
- `ht/src/lib/store.ts`: demo in-memory seed data.
- `ht/src/lib/ai-provider.ts`: DeepSeek/OpenAI provider abstraction with demo fallback when keys are missing.
- `ht/src/lib/auth.ts`: JWT signing and Bearer token verification.
- `ht/src/lib/current-user.ts`: user/admin guards for API routes.
- `ht/supabase-schema.sql`: SQL schema for Supabase/PostgreSQL.
- `qt/utils/request.js`: Mini Program request helper with Bearer token support.

Implemented backend API skeleton:

```text
POST /api/wx/login
POST /api/admin/login
GET  /api/users/me
PUT  /api/users/me/profile

GET    /api/posts
POST   /api/posts
GET    /api/posts/:id
PUT    /api/posts/:id
DELETE /api/posts/:id
POST   /api/posts/:id/view
POST   /api/posts/:id/favorite

GET  /api/posts/:id/comments
POST /api/posts/:id/comments
DELETE /api/comments/:id

GET    /api/categories
POST   /api/categories
PUT    /api/categories
DELETE /api/categories?id=...
GET    /api/tags

GET  /api/messages/threads
GET  /api/messages?peerId=...
POST /api/messages
GET  /api/notifications
POST /api/notifications
POST /api/uploads

POST /api/ai/review-post
POST /api/ai/review-comment
POST /api/ai/recommendations/generate
POST /api/ai/tags/generate
POST /api/ai/summary/generate

GET /api/admin/summary
GET /api/admin/posts
PUT /api/admin/posts
GET /api/admin/comments
PUT /api/admin/comments
GET /api/admin/users
PUT /api/admin/users
GET /api/admin/recommendations
GET /api/admin/ai/reviews
PUT /api/admin/ai/reviews
```

Implemented Mini Program pages:

```text
pages/index/index          article feed and quick navigation
pages/post/detail          post detail plus comments
pages/post/create          create post
pages/profile/index        profile view/edit
pages/messages/index       thread list
pages/messages/chat        chat view
pages/notifications/index  notifications
```

Validation already completed in `ht`:

```text
npm.cmd install --cache .npm-cache --no-audit --no-fund
npm.cmd run ts-check
npm.cmd run lint
npm.cmd run build
```

All passed after implementation. Runtime business validation was intentionally paused because the user was still configuring environment variables.

Important environment decision:

- Supabase should use the Session Pooler connection string through `DATABASE_URL`.
- The old REST-style variables are no longer needed for this codebase:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Keep secrets only in `ht/.env.local`.
- Do not place any secret in `qt`.

Current required `ht/.env.local` variables:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3001
DATA_MODE=supabase
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@<pooler-host>:5432/postgres?sslmode=require
JWT_SECRET=long-random-string

ADMIN_USERNAME=admin
ADMIN_PASSWORD=123123

WECHAT_APP_ID=wxc0a5c8f4210530c8
WECHAT_APP_SECRET=your-mini-program-app-secret

DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash

OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

User configuration notes from latest conversation:

- User has configured all environment variables except possibly final checks.
- User asked whether WeChat IP whitelist is required. Recommendation: keep it off during local development. `localhost` is not added to the whitelist. The whitelist is for the backend server's public outbound IP when calling WeChat APIs.
- Enable WeChat IP whitelist only after deployment to a server with a stable public outbound IP. Do not enable it for local testing or ordinary serverless deployments without fixed egress IP.
- User prefers the simpler Next.js-style Supabase setup using only `DATABASE_URL`.

Important caution:

- Do not echo or print `ht/.env.local` contents in chat. It may now contain real secrets.
- The `DATABASE_URL` password may contain special characters. If testing DB connectivity fails, first check URL encoding of the password and whether `sslmode=require` is included.
- Before business validation with Supabase, run `ht/supabase-schema.sql` in Supabase SQL editor or equivalent migration flow.

Recommended next steps:

```text
1. Confirm `ht/.env.local` is complete without exposing secrets.
2. Run `ht/supabase-schema.sql` in Supabase.
3. Restart the Next.js server from `ht` with `npm.cmd run dev`.
4. Validate only after env + schema are ready:
   - POST /api/admin/login
   - POST /api/wx/login
   - GET /api/posts
   - Admin page /admin
5. Open the WeChat Mini Program in DevTools and test feed/login/post/comment flows.
6. Polish UI and replace demo-only upload placeholder with real Supabase Storage when needed.
```

## 2026-06-02 Current Readthrough And Chat Integration

User request for this pass, translated from Chinese:

```text
Read through the current project and integrate the chat information from the user and the previous AI into the Markdown handoff.
```

This pass read the current project and integrated the previous AI planning notes into this handoff file. No source code was changed during this pass.

Current project reality:

- Root contains `PROJECT_HANDOFF.md`, `ht/`, and `qt/`.
- `ht/` currently exists but is empty. The planned Next.js backend/admin console has not been scaffolded yet.
- `qt/` is a WeChat Mini Program JavaScript project generated from the basic template.
- `qt/pages/index/*` is still the default avatar/nickname demo page.
- `qt/pages/logs/*` is still the default logs page.
- `qt/app.js` records launch logs and calls `wx.login()`, but does not send the login code to any backend yet.
- `qt/project.config.json` contains AppID `wxc0a5c8f4210530c8`.
- Several Chinese comments and strings in `qt` are mojibake, for example default WeChat template text in `app.js`, `index.js`, and `index.wxml`.

Important correction for future implementation:

- Treat this file as the source of planning context, not as proof that the backend already exists.
- The earlier plan says the project should have `ht` as a Next.js backend/admin console, but the directory is currently empty.
- The earlier plan says `qt` should become the Mini Program frontend for a blog/community app, but it is currently only the basic template.
- Do not place secrets in `qt`. AppSecret, Supabase service role key, AI keys, and JWT secret belong only in `ht/.env.local`.

Recommended immediate next step if the user asks to implement:

```text
1. Scaffold `ht` as a Next.js App Router + TypeScript project on port 3001.
2. Add `.env.local` placeholders and keep secrets out of git-visible Mini Program files.
3. Implement the first backend vertical slice:
   - POST /api/wx/login
   - POST /api/admin/login
   - GET /api/posts
   - GET /api/posts/:id
4. Add `qt/utils/request.js` with API base URL `http://localhost:3001`.
5. Replace the default `qt/pages/index` with a simple post feed connected to the backend contract.
```

If the user only asks for planning or review, keep code unchanged and update this handoff instead.

## Project Shape

The project should contain two main parts:

- `ht`: Next.js backend plus administrator web console.
- `qt`: WeChat Mini Program frontend, JavaScript basic version, no cloud development.

The intended architecture is:

```text
WeChat Mini Program qt
  -> wx.request
  -> Next.js API in ht
  -> Supabase database/storage
  -> optional AI provider such as DeepSeek or OpenAI
```

Next.js can be used as the backend. It should provide API routes, authentication, authorization, administrator pages, AI integration, and Supabase access. Supabase remains the cloud database.

The local Next.js dev server should run on port `3001`.

## Useful Skills Found

Most relevant skill:

- `C:\Users\user\.codex\skills\nextjs-fullstack-dev\SKILL.md`

This skill is highly relevant because it covers:

- Next.js App Router + TypeScript full-stack development
- API routes
- Supabase/PostgreSQL integration
- blog/community app patterns
- admin dashboards
- auth and role guards
- messages/comments/sharing
- static generated images and carousel assets
- Netlify/Vercel deployment cautions

Other useful skills:

- `C:\Users\user\.codex\skills\.system\openai-docs\SKILL.md`
- `C:\Users\user\.codex\skills\vercel-agent-skills\skills\react-best-practices\SKILL.md`
- `C:\Users\user\.codex\skills\vercel-agent-skills\skills\deploy-to-vercel\SKILL.md`
- `C:\Users\user\.codex\skills\ui-ux-pro-max-skill\.claude\skills\ui-ux-pro-max\SKILL.md`
- `C:\Users\user\.codex\skills\playwright\SKILL.md`

There is no dedicated WeChat Mini Program skill found locally, so use normal WeChat Mini Program JS patterns.

### How The Next AI Should Read Skills

At the start of implementation, read these files in this order:

```text
1. C:\Users\user\.codex\skills\nextjs-fullstack-dev\SKILL.md
2. C:\Users\user\.codex\skills\ui-ux-pro-max-skill\.claude\skills\ui-ux-pro-max\SKILL.md
3. C:\Users\user\.codex\skills\.system\openai-docs\SKILL.md only if using OpenAI docs or OpenAI APIs
4. C:\Users\user\.codex\skills\vercel-agent-skills\skills\react-best-practices\SKILL.md when building or optimizing Next.js UI
5. C:\Users\user\.codex\skills\playwright\SKILL.md when browser testing the admin web UI
```

Use `nextjs-fullstack-dev` as the main implementation guide. It contains the most relevant advice for this project: Next.js backend, Supabase, blog/community features, admin pages, uploads, generated images, auth, messages, and deployment concerns.

Use `ui-ux-pro-max` only for design decisions, page layout, mobile interaction, admin dashboard UX, colors, typography, spacing, and accessibility. Do not let it override backend/security decisions.

Use `openai-docs` only when the user chooses OpenAI or asks for current OpenAI API guidance. If the user chooses DeepSeek, implement a provider abstraction and use DeepSeek without requiring OpenAI.

Do not bulk-read every skill under `C:\Users\user\.codex\skills`. Read only the skill files above and any directly referenced subfiles needed for the current task.

## Reference Project

The user said `D:\nav\wtest\vitex\project_1` may be used as a reference only.

Useful reference files in project_1:

- `D:\nav\wtest\vitex\project_1\src\components\post\hero-carousel.tsx`
- `D:\nav\wtest\vitex\project_1\src\components\post\post-card.tsx`
- `D:\nav\wtest\vitex\project_1\src\app\admin\page.tsx`
- `D:\nav\wtest\vitex\project_1\src\app\messages\page.tsx`
- `D:\nav\wtest\vitex\project_1\src\app\api\messages\route.ts`
- `D:\nav\wtest\vitex\project_1\public\generated`
- `D:\nav\wtest\vitex\project_1\public\test\fm`
- `D:\nav\wtest\vitex\project_1\agent.md`

Do not copy blindly. Use it for architecture, UI ideas, API flow, and blog/community patterns.

## Historical `qt` State Before Implementation

Before the implementation pass, `qt` was the default WeChat Mini Program JavaScript basic template:

```text
qt/
  app.js
  app.json
  app.wxss
  pages/index/
  pages/logs/
  utils/util.js
```

Historical observations:

- `app.js` already calls `wx.login()` and includes a comment about sending `res.code` to the backend.
- `pages/index` contains the default avatar/nickname example.
- Current WXML/comments have Chinese mojibake in places; fix when replacing the UI.
- `project.config.json` already contains an AppID: `wxc0a5c8f4210530c8`.
- AppID is not secret. AppSecret must never be placed in `qt`.

This direction has now mostly been implemented:

- Add a request helper such as `utils/request.js`.
- Use `API_BASE_URL = "http://localhost:3001"` in development.
- Store backend token in WeChat storage.
- Send token with `Authorization: Bearer <token>`.
- Replace default pages with blog app pages over time.

## Login Plan

### WeChat Mini Program User Login

Use WeChat one-click identity login:

```text
1. User taps login or app starts login flow.
2. qt calls wx.login().
3. wx.login returns temporary code.
4. qt sends code to ht: POST /api/wx/login.
5. ht uses WECHAT_APP_ID + WECHAT_APP_SECRET + code to call WeChat code2session.
6. WeChat returns openid/session_key/optional unionid.
7. ht finds or creates a Supabase user by openid.
8. ht returns app token and safe user info.
9. qt stores token and uses it for future API calls.
```

Do not return `session_key` to the Mini Program.

First login is registration:

```text
openid does not exist -> create user -> return token
```

Subsequent login:

```text
openid exists -> update last_login_at -> return token
```

User profile should be completed separately:

- First login can create a default user, such as `微信用户`.
- Let user choose avatar and input nickname in a profile page.
- Store nickname/avatar/bio through backend API.

### Admin Login

The user wants a simple admin login initially:

```text
username: admin
password: 123123
```

Recommended implementation:

- Put admin username/password in `ht/.env.local`.
- Verify admin login only in Next.js backend.
- Return admin token with role `admin`.
- Protect `/admin` pages and all `/api/admin/*` routes server-side.

This is acceptable for development. For production, use a stronger password and preferably password hashing.

## Environment Variables

Put sensitive variables in `ht/.env.local`.

Current minimum variables:

```env
# App
NEXT_PUBLIC_APP_URL=http://localhost:3001
JWT_SECRET=replace-with-long-random-string
DATA_MODE=supabase

# Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=123123

# WeChat Mini Program
WECHAT_APP_ID=wxc0a5c8f4210530c8
WECHAT_APP_SECRET=your-mini-program-app-secret

# Supabase PostgreSQL Session Pooler
DATABASE_URL=your-supabase-session-pooler-url

# AI provider: DeepSeek first choice if user provides it
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash

# Optional AI provider: OpenAI
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

Sensitive variables must not be placed in `qt`:

- `WECHAT_APP_SECRET`
- `DATABASE_URL`
- `DEEPSEEK_API_KEY`
- `OPENAI_API_KEY`
- `JWT_SECRET`

The project originally listed Supabase REST variables, but the implementation now uses `pg` with Supabase Session Pooler. Do not require `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, or `SUPABASE_SERVICE_ROLE_KEY` unless the implementation is changed again to use Supabase REST or Storage APIs.

`WECHAT_APP_SECRET` means the WeChat Mini Program AppSecret. It is found in:

```text
WeChat public platform
  -> Mini Program account
  -> Development
  -> Development Management
  -> Development Settings
  -> Developer ID
  -> AppID / AppSecret
```

## AI Agent Direction

The AI key does not have to be OpenAI. DeepSeek is acceptable.

Use a provider abstraction so the app is not hardcoded to one provider:

```text
AI Agent
  -> aiProvider
    -> DeepSeek / OpenAI / future provider
```

AI can be used for:

- article review
- comment review
- smart recommendations
- content summaries
- tag generation
- risk detection
- admin moderation suggestions

Important safety boundary:

- AI should not have unlimited direct database control.
- AI should call controlled backend functions only.
- High-risk operations should require admin confirmation or strict backend rules.

Good AI tool examples:

- `reviewPost(postId)`
- `reviewComment(commentId)`
- `scorePostForUser(userId, postId)`
- `generateTags(postId)`
- `summarizePost(postId)`
- `flagRiskyContent(content)`

AI should usually write to suggestion/result tables:

- `ai_review_results`
- `recommendation_scores`
- `ai_generated_tags`

Then backend rules or admins decide final publish/reject/delete/ban actions.

## Static Assets And Carousel Guidance

The Next.js skill says generated public images should typically live in:

- `public/generated/`
- `public/uploads/` for prototype uploads

For blog carousel and covers:

- Prefer real or generated bitmap images, not crude placeholders.
- Use JPG/PNG/WebP for rich artwork.
- Recommended carousel/post cover size: 16:9, such as `1280x720` or `1600x900`.
- Keep cover containers at stable aspect ratios/heights.
- Treat missing/broken images as first-class states.
- Verify image dimensions and aspect ratio on disk when generating assets.

## API Design

Base URL in development:

```text
http://localhost:3001
```

Unified auth header:

```text
Authorization: Bearer <token>
```

Suggested response shape:

```json
{
  "success": true,
  "data": {},
  "message": ""
}
```

Suggested error shape:

```json
{
  "success": false,
  "message": "未登录或权限不足"
}
```

### Auth APIs

```text
POST /api/wx/login
POST /api/admin/login
GET  /api/users/me
PUT  /api/users/me/profile
```

`POST /api/wx/login` request:

```json
{
  "code": "wx.login code"
}
```

Response:

```json
{
  "token": "...",
  "user": {
    "id": "uuid",
    "nickname": "微信用户",
    "avatarUrl": "",
    "role": "user"
  }
}
```

`POST /api/admin/login` request:

```json
{
  "username": "admin",
  "password": "123123"
}
```

### Post APIs

```text
GET    /api/posts
GET    /api/posts/:id
POST   /api/posts
PUT    /api/posts/:id
DELETE /api/posts/:id
POST   /api/posts/:id/view
POST   /api/posts/:id/favorite
```

Suggested post statuses:

```text
draft
pending
published
rejected
hidden
```

### Category And Tag APIs

```text
GET /api/categories
GET /api/tags
```

Admin category management:

```text
POST   /api/categories
PUT    /api/categories
DELETE /api/categories?id=xxx
```

### Comment APIs

```text
GET    /api/posts/:id/comments
POST   /api/posts/:id/comments
DELETE /api/comments/:id
```

Suggested comment statuses:

```text
pending
published
rejected
hidden
```

### Message And Notification APIs

First version should use polling instead of WebSocket.

```text
GET  /api/messages/threads
GET  /api/messages?peerId=xxx
POST /api/messages
GET  /api/notifications
POST /api/notifications
```

Mini Program can poll every 5-10 seconds for unread notifications/messages.
Later, consider Supabase Realtime or an independent WebSocket service.

### Upload APIs

```text
POST /api/uploads
```

Use for:

- avatar upload
- post cover upload
- article image upload
- message image upload

Production should prefer Supabase Storage. Do not rely on serverless runtime local file writes for durable storage.

### AI APIs

AI should normally be triggered from backend/admin flows, not exposed freely to Mini Program users.

```text
POST /api/ai/review-post
POST /api/ai/review-comment
POST /api/ai/recommendations/generate
POST /api/ai/tags/generate
POST /api/ai/summary/generate
```

Admin AI review APIs:

```text
GET /api/admin/ai/reviews
PUT /api/admin/ai/reviews
```

### Admin APIs

```text
GET /api/admin/summary
GET /api/admin/posts
PUT /api/admin/posts
GET /api/admin/comments
PUT /api/admin/comments
GET /api/admin/users
PUT /api/admin/users
GET /api/admin/recommendations
GET /api/admin/ai/reviews
PUT /api/admin/ai/reviews
```

Admin console should support:

- dashboard
- article review
- comment review
- user management
- recommendation management
- AI review result inspection
- statistics

## Suggested Development Order

Use API-first planning, then backend-first implementation with frontends following the contract.

Recommended order:

```text
1. Define database schema and API contracts.
2. Build Next.js backend foundation.
3. Implement WeChat login and admin login.
4. Implement token auth and role guards.
5. Implement posts list/detail/create.
6. Implement comments.
7. Implement Mini Program pages against real APIs.
8. Implement Next.js admin pages.
9. Add DeepSeek/OpenAI AI review and recommendation.
10. Add notifications/messages with polling.
11. Polish UI and generated/static assets.
```

The first vertical slice should be:

```text
WeChat login -> post list -> post detail -> create post
```

Once that works, expand to comments, admin review, AI, and messaging.

## Product Direction

The project should become a personal blog/community app:

- Mini Program user frontend
- Next.js administrator web console
- Supabase cloud database
- AI-assisted recommendation and moderation
- Safe backend-controlled permissions

Do not generate or modify project code until the user explicitly asks for implementation.
