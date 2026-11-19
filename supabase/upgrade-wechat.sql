-- ============================================================
-- 校园墙 · 增量升级：支持微信扫码登录
-- 已在 Supabase 建过库的，执行这一段即可（不要跑整个 schema.sql）
-- ============================================================

alter table public.users
  add column if not exists wechat_openid text unique,
  add column if not exists avatar_url text;

-- 微信用户没有密码，允许为空
alter table public.users alter column password_hash drop not null;

grant all privileges on all tables in schema public to anon, authenticated, service_role;
