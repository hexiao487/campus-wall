'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const PHONE_RE = /^1[3-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const TABS = [
  { key: 'email', label: '邮箱验证码' },
  { key: 'phone', label: '手机号 / 密码' },
  { key: 'account', label: '账号密码' }
];

export default function LoginPage() {
  const router = useRouter();

  const [tab, setTab] = useState('email');
  const [mailReady, setMailReady] = useState(true);

  // 邮箱验证码
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);

  // 手机号 / 账号 + 密码
  const [mode, setMode] = useState('login'); // login | register
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/auth/email/status')
      .then((r) => r.json())
      .then((d) => setMailReady(Boolean(d.enabled)))
      .catch(() => setMailReady(true));
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function sendCode() {
    if (sending || countdown > 0) return;
    setErr('');
    setSending(true);
    try {
      const res = await fetch('/api/auth/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '发送失败');
      setCountdown(60);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSending(false);
    }
  }

  async function emailLogin(e) {
    e.preventDefault();
    if (busy) return;
    setErr('');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/email/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '登录失败');
      router.push('/');
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  async function passwordSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setErr('');
    setBusy(true);
    try {
      const identifier = (tab === 'phone' ? phone : username).trim();
      const url = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '操作失败');
      router.push('/');
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  const isPhoneTab = tab === 'phone';
  const identifierValue = isPhoneTab ? phone : username;
  const canPasswordSubmit = isPhoneTab
    ? PHONE_RE.test(phone) && password.length >= 6
    : username.trim().length >= 2 && password.length >= 6;

  return (
    <div className="auth-wrap">
      <div style={{ marginBottom: 22 }}>
        <Link className="brand" href="/">
          <span className="brand-logo">墙</span>
          校园墙
          <span className="ver-badge">V4.65PRO</span>
        </Link>
      </div>

      <div className="card auth-card">
        <h1 className="auth-title">{mode === 'login' ? '登录' : '注册'}</h1>
        <p className="auth-sub">邮箱验证码、手机号密码、账号密码，任选一种</p>

        <div className="tabs tabs-3">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={tab === t.key ? 'active' : ''}
              onClick={() => {
                setTab(t.key);
                setErr('');
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {err && <div className="alert">{err}</div>}

        {tab === 'email' ? (
          <form onSubmit={emailLogin}>
            <div className="field">
              <label>邮箱</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                type="email"
                autoComplete="email"
              />
            </div>

            <div className="field">
              <label>验证码</label>
              <div className="code-row">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="6 位验证码"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
                <button
                  type="button"
                  className="code-btn"
                  disabled={sending || countdown > 0 || !EMAIL_RE.test(email)}
                  onClick={sendCode}
                >
                  {countdown > 0 ? `${countdown}s` : sending ? '发送中…' : '获取验证码'}
                </button>
              </div>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', height: 46 }}
              disabled={busy || code.length !== 6}
            >
              {busy ? '登录中…' : '登录 / 注册'}
            </button>

            <div className="hint-line">
              {mailReady
                ? '首次登录会自动建号，昵称取邮箱前缀，之后随时可以改密码。'
                : '邮件服务还没配置，验证码暂时发不出去；需要先在 Vercel 填 Resend 的 API Key 和发件地址。'}
            </div>
          </form>
        ) : (
          <form onSubmit={passwordSubmit}>
            <div className="field">
              <label>{isPhoneTab ? '手机号' : '账号（用户名）'}</label>
              <input
                value={identifierValue}
                onChange={(e) => (isPhoneTab ? setPhone(e.target.value) : setUsername(e.target.value))}
                placeholder={isPhoneTab ? '11 位手机号' : '2-16 位中文、字母、数字'}
                autoComplete={isPhoneTab ? 'tel' : 'username'}
              />
            </div>
            <div className="field">
              <label>密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'login' ? '输入密码' : '至少 6 位'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%', height: 46 }}
              disabled={busy || !canPasswordSubmit}
            >
              {busy ? '请稍候…' : mode === 'login' ? '登录' : '注册并登录'}
            </button>

            <div className="hint-line" style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setErr('');
                }}
                style={{ fontSize: 13, color: 'var(--ink-soft)' }}
              >
                {mode === 'login'
                  ? isPhoneTab
                    ? '没有账号？用手机号注册'
                    : '没有账号？注册一个账号'
                  : '已有账号？去登录'}
              </button>
            </div>

            {mode === 'register' && (
              <div className="hint-line">
                {isPhoneTab
                  ? '用手机号注册会自动生成昵称（同学 + 手机尾号）。'
                  : '账号注册只认用户名和密码，建议顺手记牢。'}
              </div>
            )}
          </form>
        )}

        <div className="auth-foot">
          管理员请前往 <Link href="/admin">管理后台</Link>
        </div>
      </div>
    </div>
  );
}
