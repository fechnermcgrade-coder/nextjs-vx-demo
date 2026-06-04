import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const demoPasswordHash = "pbkdf2$120000$vitex-demo-salt-01$83e47e185c05ba3c255aea8d38ca0e64c47bf5f829b475776f04b2faaa1cc5ce";

const adminId = "00000000-0000-0000-0000-000000000001";
const userId = "00000000-0000-0000-0000-000000000002";

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

async function main() {
  loadEnvFile();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured in ht/.env.local");

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 2,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 20_000,
    ssl: databaseUrl.includes("sslmode=disable") ? false : { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  try {
    await client.query("begin");

    const tableExists = async (tableName) => {
      const result = await client.query(
        "select to_regclass($1) as name",
        [`public.${tableName}`]
      );
      return Boolean(result.rows[0]?.name);
    };

    const runIfTableExists = async (tableName, sql, params = []) => {
      if (await tableExists(tableName)) {
        await client.query(sql, params);
      }
    };

    await client.query(`
      do $$
      declare
        item record;
      begin
        for item in
          select tablename
          from pg_tables
          where schemaname = 'public'
        loop
          execute format('alter table public.%I enable row level security', item.tablename);
        end loop;
      end $$;
    `);

    await client.query(`
      alter table users add column if not exists email text;
      alter table users add column if not exists username text;
      alter table users add column if not exists password_hash text not null default '';
      alter table users add column if not exists nickname text;
      alter table users add column if not exists avatar_url text not null default '';
      alter table users add column if not exists bio text not null default '';
      alter table users add column if not exists role text not null default 'user';
      alter table users add column if not exists status text not null default 'active';
      alter table users add column if not exists created_at timestamptz not null default now();
      alter table users add column if not exists last_login_at timestamptz;
    `);

    await client.query(`
      update users
      set username = coalesce(nullif(username, ''), 'user_' || replace(id::text, '-', '_'))
      where username is null or username = ''
    `);

    await client.query(`
      update users
      set nickname = username
      where nickname is null or nickname = '' or nickname is distinct from username
    `);

    await client.query("drop index if exists users_nickname_lower_unique");
    await client.query("drop index if exists users_email_lower_unique");
    await client.query("drop index if exists users_username_lower_unique");
    await client.query("alter table users drop constraint if exists users_email_key");
    await client.query("alter table users drop constraint if exists users_username_key");
    await client.query("alter table users drop constraint if exists users_nickname_key");
    await client.query("alter table users drop constraint if exists users_nickname_matches_username");

    await client.query(`
      update users
      set email = null,
          username = 'reserved_' || replace(id::text, '-', '_'),
          nickname = 'reserved_' || replace(id::text, '-', '_')
      where id in ($1, $2)
         or lower(coalesce(email, '')) in ('admin@test.com', 'user@test.com')
         or lower(username) in ('admin', 'user')
    `, [adminId, userId]);

    await client.query(`
      insert into users (id, email, username, password_hash, nickname, avatar_url, bio, role, status, created_at, last_login_at)
      values
        ($1, 'admin@test.com', 'admin', $3, 'admin', '', '负责内容审核、用户管理和站点运营。', 'admin', 'active', now(), now()),
        ($2, 'user@test.com', 'user', $3, 'user', '', '普通用户账号。', 'user', 'active', now(), now())
      on conflict (id) do update set
        email = excluded.email,
        username = excluded.username,
        password_hash = excluded.password_hash,
        nickname = excluded.nickname,
        avatar_url = excluded.avatar_url,
        bio = excluded.bio,
        role = excluded.role,
        status = excluded.status,
        last_login_at = excluded.last_login_at
    `, [adminId, userId, demoPasswordHash]);

    await runIfTableExists("posts", "update posts set author_id = $1, author_name = 'user' where author_id not in ($1, $2)", [userId, adminId]);
    await runIfTableExists("comments", "update comments set author_id = $1, author_name = 'user' where author_id not in ($1, $2)", [userId, adminId]);
    await runIfTableExists("messages", "update messages set sender_id = $1, sender_name = 'user' where sender_id not in ($1, $2)", [userId, adminId]);
    await runIfTableExists("messages", "update messages set receiver_id = $1, receiver_name = 'user' where receiver_id not in ($1, $2)", [userId, adminId]);
    await runIfTableExists("notifications", "update notifications set user_id = $1 where user_id not in ($1, $2)", [userId, adminId]);
    await runIfTableExists("favorites", "delete from favorites where user_id not in ($1, $2)", [userId, adminId]);
    await client.query("delete from users where id not in ($1, $2)", [adminId, userId]);

    await client.query("update users set nickname = username where nickname is distinct from username");
    await client.query("alter table users alter column username set not null");
    await client.query("alter table users alter column nickname set not null");
    await client.query("alter table users drop constraint if exists users_nickname_matches_username");
    await client.query("alter table users add constraint users_nickname_matches_username check (nickname = username)");
    await client.query("create unique index users_email_lower_unique on users (lower(email)) where email is not null");
    await client.query("create unique index users_username_lower_unique on users (lower(username))");

    await runIfTableExists("posts", "alter table posts add column if not exists cover_url text not null default ''");
    await runIfTableExists("posts", "alter table posts add column if not exists moderation_reason text not null default ''");
    await runIfTableExists("posts", "alter table posts add column if not exists moderation_note text not null default ''");
    await client.query(`
      create table if not exists view_history (
        user_id uuid not null references users(id) on delete cascade,
        post_id uuid not null references posts(id) on delete cascade,
        viewed_at timestamptz not null default now(),
        primary key (user_id, post_id)
      )
    `);
    await client.query("alter table view_history enable row level security");
    await client.query("create index if not exists view_history_user_viewed_at_idx on view_history (user_id, viewed_at desc)");

    await client.query("commit");

    const rlsRows = await client.query(`
      select tablename, rowsecurity
      from pg_tables
      where schemaname = 'public'
      order by tablename
    `);
    const userRows = await client.query(`
      select email, username, nickname, role, status
      from users
      order by role, email
    `);
    const columnRows = await client.query(`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
        and (
          (table_name = 'posts' and column_name in ('cover_url', 'moderation_reason', 'moderation_note'))
          or (table_name = 'users' and column_name = 'avatar_url')
        )
      order by table_name, column_name
    `);

    console.log(JSON.stringify({
      publicTables: rlsRows.rows,
      users: userRows.rows,
      checkedColumns: columnRows.rows
    }, null, 2));
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
