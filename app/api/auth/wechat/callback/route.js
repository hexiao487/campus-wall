import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { signSession, setSessionCookie } from '@/lib/auth';
import { exchangeCode, fetchWechatProfile, sanitizeNickname, wechatConfig } from '@/lib/wechat';

export const dynamic = 'force-dynamic';

function fail(request, reason) {
  const res = NextResponse.redirect(new URL(`/login?wechat=${reason}`, request.url));
  res.cookies.set('cw_wx_state', '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}

export async function GET(request) {
  const cfg = wechatConfig();
  if (!cfg) return fail(request, 'unconfigured');

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const savedState = request.cookies.get('cw_wx_state')?.value;

  if (!code || !state || !savedState || state !== savedState) {
    return fail(request, 'state');
  }

  try {
    const token = await exchangeCode({ appId: cfg.appId, secret: cfg.secret, code });
    const openid = token.openid;
    const profile = await fetchWechatProfile({ accessToken: token.access_token, openid });

    const supabase = getSupabase();

    let { data: user } = await supabase
      .from('users')
      .select('id, username, role, is_muted')
      .eq('wechat_openid', openid)
      .maybeSingle();

    if (!user) {
      const base = sanitizeNickname(profile.nickname);
      let username = base;
      for (let i = 0; i < 6; i++) {
        const { data: clash } = await supabase
          .from('users')
          .select('id')
          .eq('username', username)
          .maybeSingle();
        if (!clash) break;
        username = `${base.slice(0, 10)}${Math.floor(1000 + Math.random() * 9000)}`;
      }

      const { data: created, error } = await supabase
        .from('users')
        .insert({
          username,
          password_hash: null,
          role: 'user',
          wechat_openid: openid,
          avatar_url: profile.avatarUrl || null
        })
        .select('id, username, role, is_muted')
        .single();

      if (error || !created) return fail(request, 'create');
      user = created;
    }

    const session = await signSession({ sub: user.id, username: user.username, role: 'user' });
    const res = NextResponse.redirect(new URL('/', request.url));
    setSessionCookie(res, session);
    res.cookies.set('cw_wx_state', '', { httpOnly: true, path: '/', maxAge: 0 });
    return res;
  } catch {
    return fail(request, 'token');
  }
}
