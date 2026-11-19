import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSupabase } from '@/lib/supabase';
import { signSession, setSessionCookie } from '@/lib/auth';

export async function POST(request) {
  try {
    const body = await request.json();
    const username = String(body.username || '').trim();
    const password = String(body.password || '');

    if (!username || !password) {
      return NextResponse.json({ error: '请输入用户名和密码' }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data: user } = await supabase
      .from('users')
      .select('id, username, password_hash, role, is_muted')
      .eq('username', username)
      .maybeSingle();

    if (!user) {
      return NextResponse.json({ error: '用户名或密码不正确' }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return NextResponse.json({ error: '用户名或密码不正确' }, { status: 401 });
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
