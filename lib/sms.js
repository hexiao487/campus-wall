import crypto from 'crypto';

/** 腾讯云短信配置，缺任意一项即视为未配置 */
export function smsConfig() {
  const secretId = (process.env.TENCENT_SMS_SECRET_ID || '').trim();
  const secretKey = (process.env.TENCENT_SMS_SECRET_KEY || '').trim();
  const appId = (process.env.TENCENT_SMS_APP_ID || '').trim();
  const signName = (process.env.TENCENT_SMS_SIGN_NAME || '').trim();
  const templateId = (process.env.TENCENT_SMS_TEMPLATE_ID || '').trim();
  if (!secretId || !secretKey || !appId || !signName || !templateId) return null;
  return { secretId, secretKey, appId, signName, templateId };
}

/** 6 位数字验证码 */
export function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** 验证码只存哈希，避免库泄露后可直接登录 */
export function hashCode(phone, code) {
  const salt = process.env.AUTH_SECRET || 'dev-only-insecure-secret-change-me';
  return crypto.createHash('sha256').update(`${phone}:${code}:${salt}`).digest('hex');
}

export function normalizePhone(raw) {
  return String(raw || '').replace(/[^\d]/g, '').replace(/^86/, '').slice(0, 11);
}

export function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

/* ---------------- 腾讯云短信 TC3 签名 ---------------- */

function sha256hex(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function hmac(key, msg) {
  return crypto.createHmac('sha256', key).update(msg).digest();
}

/**
 * 通过腾讯云短信发送验证码。
 * 需要环境变量：TENCENT_SMS_SECRET_ID / SECRET_KEY / APP_ID / SIGN_NAME / TEMPLATE_ID
 * 模板内容需为「您的验证码是 {1}，5 分钟内有效」这类单变量模板。
 */
export async function sendSmsCode({ cfg, phone, code }) {
  const host = 'sms.tencentcloudapi.com';
  const service = 'sms';
  const action = 'SendSms';
  const version = '2021-01-11';
  const region = 'ap-guangzhou';

  const payload = JSON.stringify({
    PhoneNumberSet: [`+86${phone}`],
    SmsSdkAppId: String(cfg.appId),
    SignName: cfg.signName,
    TemplateId: String(cfg.templateId),
    TemplateParamSet: [code]
  });

  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const contentType = 'application/json; charset=utf-8';

  const canonicalRequest = [
    'POST',
    '/',
    '',
    `content-type:${contentType}\nhost:${host}\n`,
    'content-type;host',
    sha256hex(payload)
  ].join('\n');

  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(timestamp),
    `${date}/${service}/tc3_request`,
    sha256hex(canonicalRequest)
  ].join('\n');

  const secretDate = hmac(`TC3${cfg.secretKey}`, date);
  const secretService = hmac(secretDate, service);
  const secretSigning = hmac(secretService, 'tc3_request');
  const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign).digest('hex');

  const authorization =
    `TC3-HMAC-SHA256 Credential=${cfg.secretId}/${date}/${service}/tc3_request, ` +
    `SignedHeaders=content-type;host, Signature=${signature}`;

  const res = await fetch(`https://${host}/`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': contentType,
      'X-TC-Action': action,
      'X-TC-Version': version,
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Region': region
    },
    body: payload,
    cache: 'no-store'
  });

  const data = await res.json();
  const r = data?.Response;
  if (r?.Error) throw new Error(`${r.Error.Code}: ${r.Error.Message}`);
  const status = r?.SendStatusSet?.[0];
  if (status && status.Code !== 'Ok') throw new Error(`${status.Code}: ${status.Message}`);
  return true;
}
