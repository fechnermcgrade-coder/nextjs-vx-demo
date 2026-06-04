import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

function loadEnvFile() {
  const envPath = path.join(rootDir, ".env.local");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (!key || process.env[key]) continue;
    let value = rest.join("=").trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

async function count(client, table) {
  const result = await client.query(`select count(*)::int as count from ${table}`);
  return result.rows[0]?.count ?? 0;
}

async function main() {
  loadEnvFile();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured in ht/.env.local");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 2,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    ssl: databaseUrl.includes("sslmode=disable") ? false : { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  try {
    const schema = fs.readFileSync(path.join(rootDir, "supabase-schema.sql"), "utf8");
    await client.query(schema);

    await client.query("begin");
    await client.query(`
      insert into users (id, openid, nickname, avatar_url, bio, role, status, created_at, last_login_at)
      values
        ('00000000-0000-0000-0000-000000000001', null, '管理员', '', '负责内容审核、用户管理和站点运营。', 'admin', 'active', now() - interval '8 days', now()),
        ('00000000-0000-0000-0000-000000000002', 'demo-openid', '小程序用户', '', '刚来到 Vitex 社区，喜欢记录灵感和问题。', 'user', 'active', now() - interval '6 days', now()),
        ('00000000-0000-0000-0000-000000000003', 'demo-openid-reader', '清晨读者', '', '关注技术、生活和 AI 工具。', 'user', 'active', now() - interval '5 days', now())
      on conflict (id) do update set
        nickname = excluded.nickname,
        avatar_url = excluded.avatar_url,
        bio = excluded.bio,
        role = excluded.role,
        status = excluded.status,
        last_login_at = excluded.last_login_at
    `);

    await client.query(`
      insert into categories (id, name, color, created_at)
      values
        ('10000000-0000-0000-0000-000000000001', '生活随笔', '#24777b', now() - interval '7 days'),
        ('10000000-0000-0000-0000-000000000002', '技术札记', '#3c6e71', now() - interval '7 days'),
        ('10000000-0000-0000-0000-000000000003', 'AI 灵感', '#8a5a44', now() - interval '7 days')
      on conflict (id) do update set
        name = excluded.name,
        color = excluded.color
    `);

    await client.query(`
      insert into posts (
        id, title, excerpt, content, cover_url, category_id, category_name, tags,
        status, author_id, author_name, view_count, favorite_count, created_at, updated_at
      )
      values
        (
          '20000000-0000-0000-0000-000000000001',
          '第一篇社区文章',
          '这是用于本地联调的小程序首页文章，管理员后台可以看到它的浏览、评论和推荐状态。',
          '欢迎来到 Vitex 社区。这里的内容由微信小程序展示，Next.js 只负责 API、业务逻辑、数据库和管理员面板。当前演示数据用于验证文章流、详情页、评论、收藏、审核和推荐等核心路径。',
          '',
          '10000000-0000-0000-0000-000000000001',
          '生活随笔',
          array['公告', '起步'],
          'published',
          '00000000-0000-0000-0000-000000000001',
          '管理员',
          128,
          12,
          now() - interval '3 days',
          now() - interval '2 days'
        ),
        (
          '20000000-0000-0000-0000-000000000002',
          'AI 辅助审核的边界',
          'AI 只产出建议和评分，最终发布、拒绝或隐藏仍由后台规则和管理员确认。',
          '内容审核适合让 AI 做初筛：识别风险、提取标签、生成摘要和推荐理由。但 AI 不应该直接拥有无限数据库权限，本项目通过受控 API 写入审核结果，再由管理员在后台确认。',
          '',
          '10000000-0000-0000-0000-000000000003',
          'AI 灵感',
          array['AI', '审核', '推荐'],
          'published',
          '00000000-0000-0000-0000-000000000001',
          '管理员',
          96,
          8,
          now() - interval '2 days',
          now() - interval '1 day'
        ),
        (
          '20000000-0000-0000-0000-000000000003',
          '待审核：小程序端提交的体验建议',
          '这条文章保持 pending 状态，用来验证管理员审核通过后小程序首页才展示。',
          '我希望首页的文章卡片更容易扫读，详情页评论输入更稳定，消息入口也能更明确。管理员可以在后台审核通过这条内容。',
          '',
          '10000000-0000-0000-0000-000000000002',
          '技术札记',
          array['小程序', '体验'],
          'pending',
          '00000000-0000-0000-0000-000000000002',
          '小程序用户',
          14,
          1,
          now() - interval '12 hours',
          now() - interval '12 hours'
        )
      on conflict (id) do update set
        title = excluded.title,
        excerpt = excluded.excerpt,
        content = excluded.content,
        cover_url = excluded.cover_url,
        category_id = excluded.category_id,
        category_name = excluded.category_name,
        tags = excluded.tags,
        status = excluded.status,
        author_id = excluded.author_id,
        author_name = excluded.author_name,
        view_count = excluded.view_count,
        favorite_count = excluded.favorite_count,
        updated_at = excluded.updated_at
    `);

    await client.query(`
      insert into favorites (user_id, post_id, created_at)
      values
        ('00000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', now() - interval '2 days'),
        ('00000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', now() - interval '1 day')
      on conflict (user_id, post_id) do nothing
    `);

    await client.query(`
      insert into comments (id, post_id, post_title, author_id, author_name, content, status, created_at)
      values
        ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '第一篇社区文章', '00000000-0000-0000-0000-000000000002', '小程序用户', '已经可以在小程序里看到文章流了，下一步重点看审核和评论体验。', 'published', now() - interval '2 days'),
        ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'AI 辅助审核的边界', '00000000-0000-0000-0000-000000000003', '清晨读者', 'AI 只做建议这个边界很好，后台确认更稳妥。', 'published', now() - interval '1 day'),
        ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', '待审核：小程序端提交的体验建议', '00000000-0000-0000-0000-000000000003', '清晨读者', '这条评论用于后台待处理列表检查。', 'pending', now() - interval '8 hours')
      on conflict (id) do update set
        post_title = excluded.post_title,
        author_name = excluded.author_name,
        content = excluded.content,
        status = excluded.status
    `);

    await client.query(`
      insert into messages (id, sender_id, sender_name, receiver_id, receiver_name, content, read_at, created_at)
      values
        ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '管理员', '00000000-0000-0000-0000-000000000002', '小程序用户', '欢迎来到 Vitex 社区，发文后会进入后台审核。', null, now() - interval '1 day'),
        ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '小程序用户', '00000000-0000-0000-0000-000000000001', '管理员', '收到，我会先提交一篇体验建议。', null, now() - interval '23 hours')
      on conflict (id) do update set
        sender_name = excluded.sender_name,
        receiver_name = excluded.receiver_name,
        content = excluded.content,
        read_at = excluded.read_at
    `);

    await client.query(`
      insert into notifications (id, user_id, type, title, content, read_at, created_at)
      values
        ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'system', '欢迎使用 Vitex', '小程序展示端和后台 API 已经连接到 Supabase。', null, now() - interval '1 day'),
        ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'post', '文章已进入审核', '你提交的文章会由管理员在后台审核后展示。', null, now() - interval '12 hours')
      on conflict (id) do update set
        title = excluded.title,
        content = excluded.content,
        read_at = excluded.read_at
    `);

    await client.query(`
      insert into ai_review_results (id, target_type, target_id, action, score, summary, status, created_at)
      values
        ('60000000-0000-0000-0000-000000000001', 'post', '20000000-0000-0000-0000-000000000003', 'review', 82, '演示 AI 审核结果：内容风险低，建议人工确认后发布。', 'pending', now() - interval '6 hours'),
        ('60000000-0000-0000-0000-000000000002', 'recommendation', '20000000-0000-0000-0000-000000000002', 'score', 76, '浏览和收藏表现稳定，可作为小程序首页推荐内容。', 'confirmed', now() - interval '5 hours')
      on conflict (id) do update set
        action = excluded.action,
        score = excluded.score,
        summary = excluded.summary,
        status = excluded.status
    `);

    await client.query("commit");

    const tables = ["users", "categories", "posts", "comments", "messages", "notifications", "ai_review_results"];
    const counts = {};
    for (const table of tables) {
      counts[table] = await count(client, table);
    }

    console.log("Database initialized successfully.");
    console.log(JSON.stringify({ mode: process.env.DATA_MODE || "unknown", counts }, null, 2));
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
