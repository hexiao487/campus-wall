const AUTHORIZE_URL = 'https://open.weixin.qq.com/connect/qrconnect';
const TOKEN_URL = 'https://api.weixin.qq.com/sns/oauth2/access_token';
const USERINFO_URL = 'https://api.weixin.qq.com/sns/userinfo';

/** 读取微信开放平台「网站应用」配置，未配置返回 null */
export function wechatConfig() {
  const appId = (process.env.WECHAT_APP_ID || '').trim();
  const secret = (process.env.WECHAT_APP_SECRET || '').trim();
  if (!appId || !secret) return null;
  return { appId, secret };
}

/** 生成微信扫码授权地址（state 由调用方生成并写入 cookie） */
export function buildAuthorizeUrl({ appId, redirectUri, state }) {
  return (
    `${AUTHORIZE_URL}?appid=${encodeURIComponent(appId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code&scope=snsapi_login` +
    `&state=${encodeURIComponent(state)}#wechat_redirect`
  );
}

/** code 换 access_token / openid */
export async function exchangeCode({ appId, secret, code }) {
  const url =
    `${TOKEN_URL}?appid=${encodeURIComponent(appId)}` +
    `&secret=${encodeURIComponent(secret)}` +
    `&code=${encodeURIComponent(code)}&grant_type=authorization_code`;
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();
  if (!data || !data.openid) {
    throw new Error(data?.errmsg || '微信授权失败');
  }
  return data; // { access_token, openid, unionid? }
}

/** 拉取微信昵称与头像（失败不影响登录） */
export async function fetchWechatProfile({ accessToken, openid }) {
  try {
    const url =
      `${USERINFO_URL}?access_token=${encodeURIComponent(accessToken)}` +
      `&openid=${encodeURIComponent(openid)}&lang=zh_CN`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    if (!data || data.errcode) return { nickname: '', avatarUrl: '' };
    return { nickname: data.nickname || '', avatarUrl: data.headimgurl || '' };
  } catch {
    return { nickname: '', avatarUrl: '' };
  }
}

/** 把微信昵称清理成可用作展示名的字符串 */
export function sanitizeNickname(raw) {
  const cleaned = String(raw || '')
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9_]/g, '')
    .trim();
  if (!cleaned) return '微信用户';
  return cleaned.slice(0, 12);
}
