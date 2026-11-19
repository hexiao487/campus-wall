-- ============================================================
-- V1.5 升级脚本：群聊改版（自建群 + 群主审批加入 + 图片消息）
-- 用法：Supabase 控制台 -> SQL Editor -> 粘贴 -> Run
-- ============================================================

-- 群
create table if not exists public.chat_groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner_id   uuid not null references public.users(id) on delete cascade,
  owner_name text not null,
  created_at timestamptz not null default now()
);

-- 群成员（群主也算成员，role = owner）
create table if not exists public.chat_group_members (
  group_id   uuid not null references public.chat_groups(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  role       text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- 加入申请（一个用户对一个群只保留一条记录）
create table if not exists public.chat_group_requests (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.chat_groups(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  user_name  text not null,
  status     text not null default 'pending',   -- pending / approved / rejected
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create index if not exists chat_group_requests_group_idx
  on public.chat_group_requests (group_id, status);

-- 群消息（文字 + 图片）
create table if not exists public.chat_group_messages (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.chat_groups(id) on delete cascade,
  author_id   uuid references public.users(id) on delete set null,
  author_name text not null,
  content     text,
  image_url   text,
  created_at  timestamptz not null default now()
);

create index if not exists chat_group_messages_idx
  on public.chat_group_messages (group_id, created_at desc);

alter table public.chat_groups          enable row level security;
alter table public.chat_group_members   enable row level security;
alter table public.chat_group_requests  enable row level security;
alter table public.chat_group_messages  enable row level security;
