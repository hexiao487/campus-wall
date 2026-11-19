-- ============================================================
-- 校园墙 · 增量升级：邮箱验证码登录 + 手机号/密码登录
-- 在 Supabase SQL Editor 执行一次即可
-- ============================================================

alter table public.users add column if not exists email text unique;

create table if not exists public.email_codes (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  code_hash  text not null,
  expires_at timestamptz not null,
  attempts   integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists email_codes_email_idx
  on public.email_codes (email, created_at desc);

alter table public.email_codes enable row level security;

grant all privileges on all tables in schema public to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

delete from public.email_codes where expires_at < now() - interval '1 day';
