import { createClient } from '@supabase/supabase-js';

/**
 * 服务端 Supabase 客户端（使用 service_role key，拥有全部读写权限）。
 * 只允许在 app/api 下的服务端代码里使用。
 */
export function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      '缺少环境变量 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY，请在 .env.local / Vercel 中配置。'
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-application-name': 'campus-wall' } }
  });
}

export const BUCKET = 'campus-wall';
