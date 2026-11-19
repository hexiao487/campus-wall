import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { buildAuthorizeUrl, wechatConfig } from '@/lib/wechat';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const cfg = wechatConfig();
  if (!cfg) {
    return NextResponse.redirect(new URL('/login?wechat=unconfigured', request.url));
  }

  const state = randomBytes(16).toString('hex');
  const redirectUri = `${request.nextUrl.origin}/api/auth/wechat/callback`;
  const url = buildAuthorizeUrl({ appId: cfg.appId, redirectUri, state });

  const res = NextResponse.redirect(url);
  res.cookies.set('cw_wx_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600
  });
  return res;
}
