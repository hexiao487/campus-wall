'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import { timeAgo } from '@/lib/format';

export default function AdminPage() {
  const [me, setMe] = useState(null);
  const [checked, setChecked] = useState(false);
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const [tab, setTab] = useState('posts');
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [notice, setNotice] = useState('');

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = await res.json();
      setMe(data.user || null);
    } catch {
      setMe(null);
    } finally {
      setChecked(true);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const loadPosts = useCallback(async () => {
    try {
      const res = await fetch('/api/posts', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPosts(data.posts || []);
    } catch (e) {
      setNotice(e.message);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsers(data.users || []);
    } catch (e) {
      setNotice(e.message);
    }
  }, []);

  useEffect(() => {
    if (me?.role === 'admin') {
      loadPosts();
      loadUsers();
    }
  }, [me, loadPosts, loadUsers]);

  async function login(e) {
    e.preventDefault();
    if (busy) return;
    setErr('');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '登录失败');
      setMe(data.user);
      setPassword('');
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setMe(null);
    setPosts([]);
    setUsers([]);
  }

  async function deletePost(post) {
    if (!window.confirm('确定删除这条帖子？删除后无法恢复。')) return;
    try {
      const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '删除失败');
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      setNotice('已删除该帖子');
    } catch (e) {
      setNotice(e.message);
    }
  }

  async function toggleMute(user) {
    const next = !user.is_muted;
    if (next && !window.confirm(`确定禁言「${user.username}」吗？禁言后 TA 将不能发帖和评论。`)) return;
    try {
      const res = await fetch(`/api/admin/users/${user.id}/mute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ muted: next })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '操作失败');
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_muted: data.user.is_muted } : u))
      );
      setNotice(next ? `已禁言 ${user.username}` : `已解除 ${user.username} 的禁言`);
    } catch (e) {
      setNotice(e.message);
    }
  }

  // 还没检查完登录态
  if (!checked) {
    return <div className="empty" style={{ paddingTop: 80 }}>正在检查登录状态…</div>;
  }

  // 未登录为管理员 -> 密码框
  if (!me || me.role !== 'admin') {
    return (
      <div className="auth-wrap">
        <div style={{ marginBottom: 20 }}>
          <Link className="brand" href="/">
            <span className="brand-logo">墙</span>
            校园墙 · 管理后台
          </Link>
        </div>

        <div className="card auth-card">
          <h1 className="auth-title">管理员登录</h1>
          <p className="auth-sub">请输入管理员密码（在 Vercel 环境变量 ADMIN_PASSWORD 中配置）</p>

          {err && <div className="alert">{err}</div>}
          {me && me.role !== 'admin' && (
            <div className="alert">
              你当前登录的是普通账号「{me.username}」，请先退出再进入管理后台。
            </div>
          )}

          <form onSubmit={login}>
            <div className="field">
              <label>管理员密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入管理员密码"
                autoComplete="current-password"
              />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', height: 44 }} disabled={busy}>
              {busy ? '验证中…' : '进入后台'}
            </button>
          </form>

          {me && (
            <div className="auth-foot">
              <button className="btn btn-ghost btn-mini" onClick={logout}>
                先退出当前账号
              </button>
            </div>
          )}

          <div className="auth-foot">
            <Link href="/">← 返回校园墙</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <SiteHeader me={me} onLogout={logout} />
      <main className="shell">
        <div className="hero">
          <h1>
            管理<span>后台</span>
          </h1>
          <p>删除违规帖子、禁言捣乱的账号。</p>
        </div>

        {notice && (
          <div className="alert ok" onClick={() => setNotice('')} style={{ cursor: 'pointer' }}>
            {notice}（点击关闭）
          </div>
        )}

        <div className="admin-tabs">
          <button className={tab === 'posts' ? 'active' : ''} onClick={() => setTab('posts')}>
            帖子管理
          </button>
          <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>
            用户管理
          </button>
        </div>

        {tab === 'posts' ? (
          <div className="card">
            {posts.length === 0 ? (
              <div className="empty">还没有帖子</div>
            ) : (
              posts.map((post) => (
                <div className="row" key={post.id}>
                  <div className="row-main">
                    <div className="row-title">
                      {post.author_name} · {timeAgo(post.created_at)}
                    </div>
                    <div className="row-sub">
                      {post.content || '（纯图片帖）'}
                      {post.image_url ? ' [含图片]' : ''}
                    </div>
                  </div>
                  <button className="btn btn-danger btn-mini" onClick={() => deletePost(post)}>
                    删帖
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="card">
            {users.length === 0 ? (
              <div className="empty">还没有注册用户</div>
            ) : (
              users.map((user) => (
                <div className="row" key={user.id}>
                  <div className="row-main">
                    <div className="row-title">
                      {user.username}{' '}
                      {user.is_muted ? (
                        <span className="tag-muted">已禁言</span>
                      ) : (
                        <span className="tag-ok">正常</span>
                      )}
                    </div>
                    <div className="row-sub">注册于 {timeAgo(user.created_at)}</div>
                  </div>
                  <button
                    className={`btn btn-mini ${user.is_muted ? 'btn-ghost' : 'btn-danger'}`}
                    onClick={() => toggleMute(user)}
                  >
                    {user.is_muted ? '解除禁言' : '禁言'}
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </>
  );
}
