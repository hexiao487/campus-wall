'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();

  const [tab, setTab] = useState('phone'); // phone | password
  const [smsReady, setSmsReady] = useState(false);

  // 手机号
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);

  // 账号密码
  const [mode, setMode] = useState('login'); // login | register
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/auth/phone/status')
      .then((r) => r.json())
      .then((d) => setSmsReady(Boolean(d.enabled)))
      .catch(() => setSmsReady(false));
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
      const res = await fetch('/api/auth/phone/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
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

  async function phoneLogin(e) {
    e.preventDefault();
    if (busy) return;
    setErr('');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/phone/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code })
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
      const url = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
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

  return (
    <div className="auth-wrap">
      <div style={{ marginBottom: 22 }}>
        <Link className="brand" href="/">
          <span className="brand-logo">墙</span>
          校园墙
        </Link>
      </div>

      <div className="card auth-card">
        <h1 className="auth-title">登录</h1>
        <p className="auth-sub">手机号登录，或用账号密码</p>

        <div className="tabs">
          <button
            className={tab === 'phone' ? 'active' : ''}
            onClick={() => {
              setTab('phone');
              setErr('');
            }}
          >
            手机号
          </button>
          <button
            className={tab === 'password' ? 'active' : ''}
            onClick={() => {
              setTab('password');
              setErr('');
            }}
          >
            账号密码
          </button>
        </div>

        {err && <div className="alert">{err}</div>}

        {tab === 'phone' ? (
          <form onSubmit={phoneLogin}>
            <div className="field">
              <label>手机号</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="11 位手机号"
                inputMode="numeric"
                autoComplete="tel"
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
                  disabled={sending || countdown > 0 || !/^1[3-9]\d{9}$/.test(phone)}
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
              {smsReady
                ? '首次登录会自动创建账号，昵称取手机尾号，可在后台改。'
                : '短信服务还没配置，验证码暂时发不出去；先在 Vercel 填腾讯云短信的 5 个环境变量。'}
            </div>
          </form>
        ) : (
          <form onSubmit={passwordSubmit}>
            <div className="field">
              <label>用户名</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="2-16 位中文、字母或数字"
                autoComplete="username"
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
              disabled={busy}
            >
              {busy ? '请稍候…' : mode === 'login' ? '登录' : '注册并登录'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setErr('');
                }}
                style={{ fontSize: 13, color: 'var(--ink-soft)' }}
              >
                {mode === 'login' ? '没有账号？注册一个' : '已有账号？去登录'}
              </button>
            </div>
          </form>
        )}

        <div className="auth-foot">
          管理员请前往 <Link href="/admin">管理后台</Link>
        </div>
      </div>
    </div>
  );
}
