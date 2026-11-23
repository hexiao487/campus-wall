import crypto from 'crypto';

/** Resend 邮件服务配置，缺任意一项即视为未配置 */
export function emailConfig() {
  const key = (process.env.RESEND_API_KEY || '').trim();
  const from = (process.env.EMAIL_FROM || '').trim();
  if (!key || !from) return null;
  return { key, from };
}

export function isValidEmail(raw) {
  const s = String(raw || '').trim();
  return s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

export function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

export function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function hashCode(email, code) {
  const salt = process.env.AUTH_SECRET || 'dev-only-insecure-secret-change-me';
  return crypto
    .createHash('sha256')
    .update(`${normalizeEmail(email)}:${code}:${salt}`)
    .digest('hex');
}

function mailHtml(code, ttl) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:32px;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC',sans-serif;">
  <div style="max-width:420px;margin:0 auto;background:#ffffff;border:1px solid rgba(0,0,0,.07);border-radius:22px;padding:30px 26px;">
    <div style="font-size:13px;color:#86868b;letter-spacing:.02em;">回声</div>
    <div style="font-size:22px;font-weight:600;color:#0a0a0a;margin:10px 0 6px;">登录验证码</div>
    <div style="font-size:13px;color:#6e6e73;line-height:1.7;">请在页面中输入以下 6 位验证码完成登录。</div>
    <div style="margin:22px 0;font-size:34px;font-weight:700;letter-spacing:8px;color:#0a0a0a;background:#f5f5f7;border-radius:14px;padding:16px;text-align:center;">${code}</div>
    <div style="font-size:12px;color:#86868b;line-height:1.7;">验证码 ${ttl} 分钟内有效，只能使用一次。<br/>如果不是你本人操作，忽略这封邮件即可。</div>
  </div>
  <div style="max-width:420px;margin:14px auto 0;text-align:center;font-size:11px;color:#a1a1a6;">此邮件由回声自动发送，请勿直接回复。</div>
</body></html>`;
}

/** 通过 Resend 发送验证码邮件 */
export async function sendCodeEmail({ cfg, email, code, ttl = 10 }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: cfg.from,
      to: [email],
      subject: `【回声】登录验证码 ${code}`,
      html: mailHtml(code, ttl)
    }),
    cache: 'no-store'
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `发送失败(${res.status})`);
  return true;
}
