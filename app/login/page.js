'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const WX_ERRORS = {
  unconfigured: '微信登录还没配置：需要微信开放平台的网站应用 AppID / AppSecret',
  state: '微信授权已过期，请重新扫码',
  token: '微信授权校验失败，请重试',
  create: '建档失败，请稍后再试'
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState('login'); // login | register
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [wxEnabled, setWxEnabled] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('wechat');
    if (q && WX_ERRORS[q]) setErr(WX_ERRORS[q]);

    fetch('/api/auth/wechat/status')
      .then((r) => r.json())
      .then((d) => setWxEnabled(Boolean(d.enabled)))
      .catch(() => setWxEnabled(false));
  }, []);

  async function submit(e) {
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
      <div style={{ marginBottom: 20 }}>
        <Link className="brand" href="/">
          <span className="brand-logo">墙</span>
          校园墙
        </Link>
      </div>

      <div className="card auth-card">
        <h1 className="auth-title">{mode === 'login' ? '欢迎回来' : '加入校园墙'}</h1>
        <p className="auth-sub">
          {mode === 'login' ? '登录后可以发帖、点赞和评论' : '注册一个账号，开始你的第一次发帖'}
        </p>

        <div className="tabs">
          <button
            className={mode === 'login' ? 'active' : ''}
            onClick={() => {
              setMode('login');
              setErr('');
            }}
          >
            登录
          </button>
          <button
            className={mode === 'register' ? 'active' : ''}
            onClick={() => {
              setMode('register');
              setErr('');
            }}
          >
            注册
          </button>
        </div>

        {err && <div className="alert">{err}</div>}

        <button
          type="button"
          className="wechat-btn"
          disabled={!wxEnabled}
          onClick={() => {
            window.location.href = '/api/auth/wechat/start';
          }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="M8.7 3C4.8 3 1.6 5.7 1.6 9c0 1.9 1 3.6 2.7 4.7l-.7 2.1 2.4-1.2c.9.3 1.8.4 2.8.4h.5c-.1-.5-.2-.9-.2-1.4 0-3.3 2.9-6 6.5-6 .3 0 .5 0 .8.1C10.9 5 9.9 3 8.7 3zM6 5.6c.6 0 1 .4 1 1s-.4 1-1 1-1-.4-1-1 .4-1 1-1zm5.6 0c.6 0 1 .4 1 1s-.4 1-1 1-1-.4-1-1 .4-1 1-1zM22.4 13c0-2.7-2.6-4.9-5.8-4.9s-5.8 2.2-5.8 4.9 2.6 4.9 5.8 4.9c.7 0 1.4-.1 2-.3l2 1-.5-1.7c1.6-.9 2.6-2.3 2.6-3.9zM14.7 12c.5 0 .9.4.9.9s-.4.9-.9.9-.9-.4-.9-.9 .4-.9.9-.9zm4.2 0c.5 0 .9.4.9.9s-.4.9-.9.9-.9-.4-.9-.9 .4-.9.9-.9z" />
          </svg>
          {wxEnabled ? '微信扫码登录' : '微信扫码登录（未配置）'}
        </button>

        <div className="or-divider">或用账号密码</div>

        <form onSubmit={submit}>
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
          <button className="btn btn-primary" style={{ width: '100%', height: 44 }} disabled={busy}>
            {busy ? '请稍候…' : mode === 'login' ? '登录' : '注册并登录'}
          </button>
        </form>

        <div className="auth-foot">
          管理员请前往 <Link href="/admin">管理后台</Link>
        </div>
      </div>
    </div>
  );
}
