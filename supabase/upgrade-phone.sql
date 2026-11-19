-- ============================================================
-- 校园墙 · 增量升级：支持手机号 + 短信验证码登录
-- 已在 Supabase 建过库的，执行这一段即可（不要跑整个 schema.sql）
-- ============================================================

alter table public.users add column if not exists phone text unique;

create table if not exists public.phone_codes (
  id         uuid primary key default gen_random_uuid(),
  phone      text not null,
  code_hash  text not null,
  expires_at timestamptz not null,
  attempts   integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists phone_codes_phone_idx
  on public.phone_codes (phone, created_at desc);

alter table public.phone_codes enable row level security;

-- 老库若还没授权过，这里补一次
grant all privileges on all tables in schema public to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- 清理历史验证码（可选）
delete from public.phone_codes where expires_at < now() - interval '1 day';
