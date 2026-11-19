import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSupabase } from '@/lib/supabase';
import { signSession, setSessionCookie } from '@/lib/auth';

const PHONE_RE = /^1[3-9]\d{9}$/;

export async function POST(request) {
  try {
    const body = await request.json();
    const account = String(body.identifier ?? body.username ?? '').trim();
    const password = String(body.password || '');

    if (!account || !password) {
      return NextResponse.json({ error: '请输入账号和密码' }, { status: 400 });
    }

    const supabase = getSupabase();
    const isPhone = PHONE_RE.test(account);

    const { data: user } = await supabase
      .from('users')
      .select('id, username, password_hash, role, is_muted')
      .eq(isPhone ? 'phone' : 'username', account)
      .maybeSingle();

    if (!user || !user.password_hash) {
      return NextResponse.json({ error: isPhone ? '手机号或密码不正确' : '用户名或密码不正确' }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return NextResponse.json({ error: isPhone ? '手机号或密码不正确' : '用户名或密码不正确' }, { status: 401 });
    }

    const token = await signSession({ sub: user.id, username: user.username, role: user.role });
    const res = NextResponse.json({
      user: { username: user.username, role: user.role, isMuted: user.is_muted }
    });
    return setSessionCookie(res, token);
  } catch (e) {
    return NextResponse.json({ error: '登录失败：' + e.message }, { status: 500 });
  }
}
