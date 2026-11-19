import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSupabase } from '@/lib/supabase';
import { signSession, setSessionCookie } from '@/lib/auth';

const USERNAME_RE = /^[a-zA-Z0-9_\u4e00-\u9fa5]{2,16}$/;

export async function POST(request) {
  try {
    const body = await request.json();
    const username = String(body.username || '').trim();
    const password = String(body.password || '');

    if (!USERNAME_RE.test(username)) {
      return NextResponse.json({ error: '用户名需为 2-16 位中文、字母、数字或下划线' }, { status: 400 });
    }
    if (username === '管理员') {
      return NextResponse.json({ error: '这个用户名被系统保留了' }, { status: 400 });
    }
    if (password.length < 6 || password.length > 64) {
      return NextResponse.json({ error: '密码长度需为 6-64 位' }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data: exist } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (exist) {
      return NextResponse.json({ error: '这个用户名已经被注册了' }, { status: 409 });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const { data: created, error } = await supabase
      .from('users')
      .insert({ username, password_hash, role: 'user' })
      .select('id, username, role')
      .single();

    if (error || !created) {
      return NextResponse.json({ error: '注册失败，请稍后重试' }, { status: 500 });
    }

    const token = await signSession({ sub: created.id, username: created.username, role: 'user' });
    const res = NextResponse.json({ user: { username: created.username, role: 'user' } });
    return setSessionCookie(res, token);
  } catch (e) {
    return NextResponse.json({ error: '注册失败：' + e.message }, { status: 500 });
  }
}
