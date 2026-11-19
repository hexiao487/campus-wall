-- ============================================================
-- 校园墙 · Supabase 数据库初始化脚本
-- 用法：Supabase 控制台 -> SQL Editor -> New query -> 粘贴全部内容 -> Run
-- ============================================================

create extension if not exists "pgcrypto";

-- 用户表
create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  username      text not null unique,
  password_hash text not null,
  role          text not null default 'user',   -- user / admin
  is_muted      boolean not null default false, -- 是否被禁言
  created_at    timestamptz not null default now()
);

-- 帖子表
create table if not exists public.posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid references public.users(id) on delete set null,
  author_name   text not null,
  content       text not null,
  image_url     text,
  like_count    integer not null default 0,
  comment_count integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);

-- 点赞表（一个用户对一个帖子只能点一次）
create table if not exists public.likes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- 评论表
create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  author_id   uuid references public.users(id) on delete set null,
  author_name text not null,
  content     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists comments_post_idx on public.comments (post_id, created_at);

-- ------------------------------------------------------------
-- 触发器：自动维护点赞数 / 评论数
-- ------------------------------------------------------------
create or replace function public.sync_like_count() returns trigger
language plpgsql security definer as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  elsif (tg_op = 'DELETE') then
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists likes_count_trigger on public.likes;
create trigger likes_count_trigger
after insert or delete on public.likes
for each row execute function public.sync_like_count();

create or replace function public.sync_comment_count() returns trigger
language plpgsql security definer as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif (tg_op = 'DELETE') then
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists comments_count_trigger on public.comments;
create trigger comments_count_trigger
after insert or delete on public.comments
for each row execute function public.sync_comment_count();

-- ------------------------------------------------------------
-- 开启 RLS：所有读写都走服务端 service_role（会绕过 RLS），
-- 所以这里只要开启、不建策略，匿名 key 无法直接读写，更安全。
-- ------------------------------------------------------------
alter table public.users    enable row level security;
alter table public.posts    enable row level security;
alter table public.likes    enable row level security;
alter table public.comments enable row level security;

-- ------------------------------------------------------------
-- 授权：用 SQL 建表时 Supabase 不会自动给 service_role 授予表权限，
-- 缺这一段线上会报 "permission denied for table xxx"。
-- RLS 已开启且无策略，anon/authenticated 即使有 grant 也读不到数据。
-- ------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant all privileges on all tables    in schema public to anon, authenticated, service_role;
grant all privileges on all sequences in schema public to anon, authenticated, service_role;
grant all privileges on all functions in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 图片存储桶（公开可读，只有服务端能上传）
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('campus-wall', 'campus-wall', true)
on conflict (id) do nothing;

drop policy if exists "campus-wall public read" on storage.objects;
create policy "campus-wall public read"
on storage.objects for select
using (bucket_id = 'campus-wall');
