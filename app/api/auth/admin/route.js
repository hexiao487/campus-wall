import { NextResponse } from 'next/server';
import { signSession, setSessionCookie } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';

const ADMIN_USERNAME = '管理员';

/** 确保库里存在一个管理员用户行，返回它的 id（管理员因此拥有点赞等普通账号能力） */
async function ensureAdminUserId(supabase) {
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from('users')
    .insert({ username: ADMIN_USERNAME, role: 'admin', password_hash: null })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return created.id;
}

/** 管理员登录：只输入密码，密码来自环境变量 ADMIN_PASSWORD */
export async function POST(request) {
  try {
    const body = await request.json();
    const password = String(body.password || '');
    const expected = process.env.ADMIN_PASSWORD;

    if (!expected) {
      return NextResponse.json(
        { error: '服务端未配置 ADMIN_PASSWORD，请先在环境变量里设置管理员密码' },
        { status: 500 }
      );
    }

    if (!password || password !== expected) {
      return NextResponse.json({ error: '管理员密码不正确' }, { status: 401 });
    }

    const supabase = getSupabase();
    const adminUserId = await ensureAdminUserId(supabase);

    const token = await signSession({ sub: adminUserId, username: ADMIN_USERNAME, role: 'admin' });
    const res = NextResponse.json({
      user: { id: adminUserId, username: ADMIN_USERNAME, role: 'admin' }
    });
    return setSessionCookie(res, token, 7);
  } catch (e) {
    return NextResponse.json({ error: '登录失败：' + e.message }, { status: 500 });
  }
}
