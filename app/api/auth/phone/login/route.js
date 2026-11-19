import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { signSession, setSessionCookie } from '@/lib/auth';
import { hashCode, isValidPhone, normalizePhone } from '@/lib/sms';

export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS = 5;

function maskPhone(phone) {
  return `${phone.slice(0, 3)}****${phone.slice(7)}`;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const phone = normalizePhone(body.phone);
    const code = String(body.code || '').replace(/[^\d]/g, '');

    if (!isValidPhone(phone)) {
      return NextResponse.json({ error: '手机号格式不对' }, { status: 400 });
    }
    if (code.length !== 6) {
      return NextResponse.json({ error: '请输入 6 位验证码' }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data: row } = await supabase
      .from('phone_codes')
      .select('id, code_hash, expires_at, attempts')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) {
      return NextResponse.json({ error: '请先获取验证码' }, { status: 400 });
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: '验证码已过期，请重新获取' }, { status: 400 });
    }
    if ((row.attempts || 0) >= MAX_ATTEMPTS) {
      return NextResponse.json({ error: '尝试次数过多，请重新获取验证码' }, { status: 429 });
    }

    if (row.code_hash !== hashCode(phone, code)) {
      await supabase
        .from('phone_codes')
        .update({ attempts: (row.attempts || 0) + 1 })
        .eq('id', row.id);
      return NextResponse.json({ error: '验证码不对' }, { status: 400 });
    }

    // 用掉这次验证码
    await supabase.from('phone_codes').delete().eq('id', row.id);

    let { data: user } = await supabase
      .from('users')
      .select('id, username, role, is_muted')
      .eq('phone', phone)
      .maybeSingle();

    if (!user) {
      const base = `同学${phone.slice(-4)}`;
      let username = base;
      for (let i = 0; i < 6; i++) {
        const { data: clash } = await supabase
          .from('users')
          .select('id')
          .eq('username', username)
          .maybeSingle();
        if (!clash) break;
        username = `${base}${Math.floor(10 + Math.random() * 89)}`;
      }

      const { data: created, error } = await supabase
        .from('users')
        .insert({ username, password_hash: null, role: 'user', phone })
        .select('id, username, role, is_muted')
        .single();

      if (error || !created) {
        return NextResponse.json({ error: '登录失败：' + (error?.message || '') }, { status: 500 });
      }
      user = created;
    }

    const token = await signSession({ sub: user.id, username: user.username, role: 'user' });
    const res = NextResponse.json({
      user: { username: user.username, role: 'user' },
      phone: maskPhone(phone)
    });
    return setSessionCookie(res, token);
  } catch (e) {
    return NextResponse.json({ error: '登录失败：' + e.message }, { status: 500 });
  }
}
