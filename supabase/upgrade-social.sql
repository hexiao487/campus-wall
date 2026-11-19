-- ============================================================
-- V1.6 社交升级：关注 / 好友 / 私信（文字·图片·语音）/ 对讲机
-- 用法：Supabase 控制台 -> SQL Editor -> 粘贴 -> Run
-- ============================================================

-- 关注关系
create table if not exists public.follows (
  follower_id  uuid not null references public.users(id) on delete cascade,
  following_id uuid not null references public.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id)
);

create index if not exists follows_following_idx on public.follows (following_id);

-- 好友申请（status: pending / accepted / rejected）
create table if not exists public.friend_requests (
  id         uuid primary key default gen_random_uuid(),
  from_id    uuid not null references public.users(id) on delete cascade,
  to_id      uuid not null references public.users(id) on delete cascade,
  status     text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (from_id, to_id)
);

create index if not exists friend_requests_to_idx on public.friend_requests (to_id, status);

-- 私信（kind: text / image / audio / ptt_invite）
create table if not exists public.dm_messages (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid not null references public.users(id) on delete cascade,
  receiver_id   uuid not null references public.users(id) on delete cascade,
  kind          text not null default 'text',
  content       text,
  image_url     text,
  audio_url     text,
  audio_seconds integer,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists dm_messages_pair_idx
  on public.dm_messages (sender_id, receiver_id, created_at desc);
create index if not exists dm_messages_inbox_idx
  on public.dm_messages (receiver_id, created_at desc);

-- 对讲机语音分片（PCM16 base64，频道 = 两个好友 id 排序拼接）
create table if not exists public.ptt_chunks (
  id         bigserial primary key,
  channel    text not null,
  sender_id  uuid not null,
  seq        integer not null default 0,
  pcm        text not null,
  created_at timestamptz not null default now()
);

create index if not exists ptt_chunks_channel_idx on public.ptt_chunks (channel, id);

alter table public.follows         enable row level security;
alter table public.friend_requests enable row level security;
alter table public.dm_messages     enable row level security;
alter table public.ptt_chunks      enable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant all privileges on all tables    in schema public to anon, authenticated, service_role;
grant all privileges on all sequences in schema public to anon, authenticated, service_role;
grant all privileges on all functions in schema public to anon, authenticated, service_role;
