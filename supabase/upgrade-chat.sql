-- ============================================================
-- V1.4 升级脚本：管理员转为真实用户身份 + 群聊
-- 用法：Supabase 控制台 -> SQL Editor -> 粘贴 -> Run
-- ============================================================

-- 1) 管理员使用真实用户行，才能点赞 / 被 @ / 正常归属内容
--    登录接口会自动创建（这里只是兜底，避免唯一冲突时手忙脚乱）
do $$
begin
  if not exists (select 1 from public.users where role = 'admin') then
    insert into public.users (username, role, password_hash)
    values ('管理员', 'admin', null);
  end if;
end $$;

-- 2) 群聊消息表
create table if not exists public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid references public.users(id) on delete set null,
  author_name text not null,
  content     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists chat_messages_created_at_idx
  on public.chat_messages (created_at desc);

alter table public.chat_messages enable row level security;
