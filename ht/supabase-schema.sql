create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  openid text unique,
  email text unique,
  username text not null,
  password_hash text not null default '',
  nickname text not null,
  avatar_url text not null default '',
  bio text not null default '',
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  constraint users_nickname_matches_username check (nickname = username)
);

create unique index if not exists users_username_lower_unique on users (lower(username));

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#24777b',
  created_at timestamptz not null default now()
);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  excerpt text not null default '',
  content text not null,
  cover_url text not null default '',
  category_id uuid not null references categories(id) on delete restrict,
  category_name text not null default '未分类',
  tags text[] not null default '{}',
  status text not null default 'pending' check (status in ('draft', 'pending', 'published', 'rejected')),
  moderation_reason text not null default '',
  moderation_note text not null default '',
  author_id uuid not null references users(id) on delete cascade,
  author_name text not null default '未知用户',
  view_count integer not null default 0,
  favorite_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists favorites (
  user_id uuid not null references users(id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists view_history (
  user_id uuid not null references users(id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  post_title text not null default '未知文章',
  author_id uuid not null references users(id) on delete cascade,
  author_name text not null default '未知用户',
  content text not null,
  status text not null default 'published' check (status in ('published')),
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references users(id) on delete cascade,
  sender_name text not null default '未知用户',
  receiver_id uuid not null references users(id) on delete cascade,
  receiver_name text not null default '未知用户',
  content text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null default 'system' check (type in ('system', 'comment', 'message', 'post')),
  title text not null,
  content text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists ai_review_results (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post', 'comment', 'recommendation', 'tag', 'summary')),
  target_id text not null,
  action text not null,
  score integer not null default 0,
  summary text not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists posts_status_created_at_idx on posts (status, created_at desc);
create index if not exists comments_post_id_created_at_idx on comments (post_id, created_at desc);
create index if not exists view_history_user_viewed_at_idx on view_history (user_id, viewed_at desc);
create index if not exists messages_participants_created_at_idx on messages (sender_id, receiver_id, created_at desc);
create index if not exists notifications_user_id_created_at_idx on notifications (user_id, created_at desc);
