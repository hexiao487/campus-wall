'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState('login'); // login | register
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

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
