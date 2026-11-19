import { NextResponse } from 'next/server';
import { signSession, setSessionCookie, ADMIN_ID } from '@/lib/auth';

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

    const token = await signSession({ sub: ADMIN_ID, username: '管理员', role: 'admin' });
    const res = NextResponse.json({ user: { username: '管理员', role: 'admin' } });
    return setSessionCookie(res, token, 7);
  } catch (e) {
    return NextResponse.json({ error: '登录失败：' + e.message }, { status: 500 });
  }
}
