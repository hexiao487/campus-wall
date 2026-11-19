import { SignJWT, jwtVerify } from 'jose';

const COOKIE_NAME = 'cw_token';
const ADMIN_ID = 'admin-root';

function secretKey() {
  const s = process.env.AUTH_SECRET || 'dev-only-insecure-secret-change-me';
  return new TextEncoder().encode(s);
}

/** 生成登录态 token */
export async function signSession(payload, days = 30) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(secretKey());
}

async function verifySession(token) {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload;
  } catch {
    return null;
  }
}

/** 把登录态写入 cookie */
export function setSessionCookie(res, token, days = 30) {
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: days * 24 * 60 * 60
  });
  return res;
}

export function clearSessionCookie(res) {
  res.cookies.set(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}

/** 从请求里读取当前登录用户，未登录返回 null */
export async function getSessionUser(request) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifySession(token);
  if (!payload || !payload.role) return null;
  return {
    id: payload.sub === ADMIN_ID ? null : payload.sub,
    username: payload.username || '匿名同学',
    role: payload.role
  };
}

export { ADMIN_ID, COOKIE_NAME };
