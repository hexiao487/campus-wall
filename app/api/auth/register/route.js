import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSupabase } from '@/lib/supabase';
import { signSession, setSessionCookie } from '@/lib/auth';

const USERNAME_RE = /^[a-zA-Z0-9_\u4e00-\u9fa5]{2,16}$/;
const PHONE_RE = /^1[3-9]\d{9}$/;

export async function POST(request) {
  try {
    const body = await request.json();
    const account = String(body.identifier ?? body.username ?? '').trim();
    const password = String(body.password || '');
    const isPhone = PHONE_RE.test(account);

    if (!isPhone && !USERNAME_RE.test(account)) {
      return NextResponse.json(
        { error: '请输入 11 位手机号，或 2-16 位用户名（中文、字母、数字、下划线）' },
        { status: 400 }
      );
    }
    if (!isPhone && account === '管理员') {
      return NextResponse.json({ error: '这个用户名被系统保留了' }, { status: 400 });
    }
    if (password.length < 6 || password.length > 64) {
      return NextResponse.json({ error: '密码长度需为 6-64 位' }, { status: 400 });
    }

    const supabase = getSupabase();
    const password_hash = await bcrypt.hash(password, 10);

    if (isPhone) {
      const { data: existPhone } = await supabase
        .from('users')
        .select('id, username, password_hash')
        .eq('phone', account)
        .maybeSingle();

      if (existPhone?.password_hash) {
        return NextResponse.json({ error: '这个手机号已经注册过了，直接登录吧' }, { status: 409 });
      }

      if (existPhone && !existPhone.password_hash) {
        // 之前用验证码/微信登录过，只是没设密码：补一个密码
        const { data: updated, error } = await supabase
          .from('users')
          .update({ password_hash })
          .eq('id', existPhone.id)
          .select('id, username, role')
          .single();
        if (error || !updated) {
          return NextResponse.json({ error: '设置密码失败，请稍后重试' }, { status: 500 });
        }
        const token = await signSession({ sub: updated.id, username: updated.username, role: 'user' });
        const res = NextResponse.json({ user: { username: updated.username, role: 'user' } });
        return setSessionCookie(res, token);
      }

      const base = `同学${account.slice(-4)}`;
      let username = base;
      for (let i = 0; i < 6; i++) {
        const { data: clash } = await supabase.from('users').select('id').eq('username', username).maybeSingle();
        if (!clash) break;
        username = `${base}${Math.floor(10 + Math.random() * 89)}`;
      }

      const { data: created, error } = await supabase
        .from('users')
        .insert({ username, password_hash, role: 'user', phone: account })
        .select('id, username, role')
        .single();

      if (error || !created) {
        return NextResponse.json({ error: '注册失败，请稍后重试' }, { status: 500 });
      }

      const token = await signSession({ sub: created.id, username: created.username, role: 'user' });
      const res = NextResponse.json({ user: { username: created.username, role: 'user' } });
      return setSessionCookie(res, token);
    }

    const { data: exist } = await supabase
      .from('users')
      .select('id')
      .eq('username', account)
      .maybeSingle();

    if (exist) {
      return NextResponse.json({ error: '这个用户名已经被注册了' }, { status: 409 });
    }

    const { data: created, error } = await supabase
      .from('users')
      .insert({ username: account, password_hash, role: 'user' })
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
