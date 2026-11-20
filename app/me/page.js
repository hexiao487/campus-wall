'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import Feed from '@/components/Feed';
import { initial, avatarStyle } from '@/lib/format';
import { compressImage } from '@/lib/imageCompress';

const TABS = [
  { key: 'mine', label: '我的帖子' },
  { key: 'saved', label: '收藏' },
  { key: 'liked', label: '点赞' }
];

export default function MePage() {
  const [me, setMe] = useState(null);
  const [booted, setBooted] = useState(false);
  const [tab, setTab] = useState('mine');
  const [cache, setCache] = useState({ mine: null, saved: null, liked: null });
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState([]);
  const [likedIds, setLikedIds] = useState([]);
  const [menu, setMenu] = useState(false);
  const [mode, setMode] = useState(null); // name | avatar | delete | null
  const [nameInput, setNameInput] = useState('');
  const [pwdInput, setPwdInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        const user = (await res.json()).user || null;
        setMe(user);
        if (!user) return;
        load('mine');
        preload();
      } catch {
        /* 忽略 */
      } finally {
        setBooted(true);
      }
    })();
  }, []);

  async function preload() {
    try {
      const [sv, lk] = await Promise.all([
        fetch('/api/saved', { cache: 'no-store' }),
        fetch('/api/me/posts?type=liked', { cache: 'no-store' })
      ]);
      const sd = await sv.json().catch(() => ({}));
      const ld = await lk.json().catch(() => ({}));
      setSavedIds(sd.ids || []);
      setLikedIds((ld.posts || []).map((p) => p.id));
      setCache((c) => ({
        mine: c.mine,
        saved: c.saved || sd.posts || [],
        liked: c.liked || ld.posts || []
      }));
    } catch {
      /* 忽略 */
    }
  }

  async function load(which) {
    setLoading(true);
    try {
      if (which === 'saved') {
        const sv = await fetch('/api/saved', { cache: 'no-store' });
        const data = await sv.json();
        setSavedIds(data.ids || []);
        setCache((c) => ({ ...c, saved: data.posts || [] }));
      } else {
        const res = await fetch(`/api/me/posts?type=${which}`, { cache: 'no-store' });
        const data = await res.json();
        const posts = data.posts || [];
        setCache((c) => ({ ...c, [which]: posts }));
        if (which === 'liked') setLikedIds(posts.map((p) => p.id));
      }
    } catch {
      /* 忽略 */
    } finally {
      setLoading(false);
    }
  }

  function switchTab(key) {
    setTab(key);
    if (!cache[key]) load(key);
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setMe(null);
    setCache({ mine: null, saved: null, liked: null });
  }

  async function saveName(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: nameInput.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '修改失败');
      setMe((m) => ({ ...m, username: data.user.username }));
      setMsg('昵称已更新');
      setMode(null);
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadAvatar(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || busy) return;
    setBusy(true);
    setMsg('');
    try {
      const prepared = await compressImage(file, { maxSide: 512 });
      const fd = new FormData();
      fd.append('file', prepared);
      const up = await fetch('/api/upload', { method: 'POST', body: fd });
      const upd = await up.json();
      if (!up.ok) throw new Error(upd.error || '上传失败');
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: upd.url })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '换头像失败');
      setMe((m) => ({ ...m, avatar_url: data.user.avatar_url }));
      setMsg('头像已更新');
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/auth/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwdInput })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '注销失败');
      window.location.href = '/';
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  function switchAccount() {
    setMenu(false);
    fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
      window.location.href = '/login';
    });
  }

  const posts = cache[tab] || [];

  return (
    <>
      <SiteHeader me={me} onLogout={logout} />
      <main className="shell">
        {!me && booted && (
          <div className="card">
            <div className="empty">登录后才能看自己的页面</div>
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <Link className="btn btn-primary btn-mini" href="/login">去登录</Link>
            </div>
          </div>
        )}

        {me && (
          <>
            <div className="me-menu-row">
              <button className="me-menu-btn" onClick={() => setMenu((v) => !v)} aria-label="菜单">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="me-card">
              <Link className="me-avatar" href={`/u/${me.id}`} style={avatarStyle(me.username, me.avatar_url)}>
                {!me.avatar_url && initial(me.username)}
              </Link>
              <div className="me-info">
                <h1>
                  {me.username}
                  {me.role === 'admin' && <span className="badge-admin">管理员</span>}
                </h1>
                <p>{me.id ? '我的个人页面' : ''} <span className="ver-badge">V4.61beta</span></p>
                <div className="me-stats">
                  <span><b>{cache.mine ? cache.mine.length : '—'}</b> 帖子</span>
                  <span><b>{cache.saved ? cache.saved.length : '—'}</b> 收藏</span>
                  <span><b>{cache.liked ? cache.liked.length : '—'}</b> 点赞</span>
                </div>
              </div>
              <Link className="me-go" href={`/u/${me.id}`}>主页 ›</Link>
            </div>

            <div className="me-tabs">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  className={`me-tab ${tab === t.key ? 'on' : ''}`}
                  onClick={() => switchTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {loading && !posts.length ? (
              <div className="empty">加载中…</div>
            ) : posts.length === 0 ? (
              <div className="card">
                <div className="empty">
                  {tab === 'mine' && '还没发过帖子，去发一条吧。'}
                  {tab === 'saved' && '还没有收藏，点帖子上的 ☆ 试试。'}
                  {tab === 'liked' && '还没有点赞过，点 ♡ 试试。'}
                </div>
              </div>
            ) : (
              <Feed
                posts={posts}
                setPosts={(fn) =>
                  setCache((c) => {
                    const prev = c[tab] || [];
                    const next = typeof fn === 'function' ? fn(prev) : fn;
                    if (tab === 'saved') {
                      setSavedIds((ids) => ids.filter((id) => next.some((p) => p.id === id)));
                    }
                    return { ...c, [tab]: next };
                  })
                }
                me={me}
                likedIds={likedIds}
                setLikedIds={setLikedIds}
                savedIds={savedIds}
                setSavedIds={setSavedIds}
                onNotice={() => {}}
              />
            )}
          </>
        )}

        {menu && (
          <div className="sheet-mask" onClick={() => { setMenu(false); setMode(null); setMsg(''); }}>
            <div className="sheet" onClick={(e) => e.stopPropagation()}>
              <div className="sheet-bar" />
              <div className="sheet-title">菜单</div>

              {msg && <div className="sheet-msg">{msg}</div>}

              {!mode && (
                <>
                  <button className="glass-btn sheet-item" onClick={() => { setMode('name'); setNameInput(me?.username || ''); }}>
                    改昵称
                  </button>
                  <label className="glass-btn sheet-item">
                    换头像
                    <input type="file" accept="image/*" hidden onChange={uploadAvatar} />
                  </label>
                  <button className="glass-btn sheet-item" onClick={async () => { setMenu(false); await logout(); }}>
                    退出登录
                  </button>
                  <button className="glass-btn sheet-item" onClick={switchAccount}>切换账号</button>
                  <button className="glass-btn sheet-item danger" onClick={() => setMode('delete')}>注销账号</button>
                </>
              )}

              {mode === 'name' && (
                <form className="sheet-form" onSubmit={saveName}>
                  <label className="sheet-label">新的昵称</label>
                  <input className="sheet-input" value={nameInput} maxLength={20} onChange={(e) => setNameInput(e.target.value)} placeholder="2-20 个字符" />
                  <button className="glass-btn sheet-item" disabled={busy}>{busy ? '保存中…' : '保存昵称'}</button>
                  <button type="button" className="glass-btn sheet-item ghost" onClick={() => { setMode(null); setMsg(''); }}>返回</button>
                </form>
              )}

              {mode === 'delete' && (
                <form className="sheet-form" onSubmit={deleteAccount}>
                  <div className="sheet-warn">注销后账号无法恢复，你的帖子会保留。请输入密码确认。</div>
                  <input className="sheet-input" type="password" value={pwdInput} onChange={(e) => setPwdInput(e.target.value)} placeholder="输入登录密码" />
                  <button className="glass-btn sheet-item danger" disabled={busy}>{busy ? '处理中…' : '确认注销'}</button>
                  <button type="button" className="glass-btn sheet-item ghost" onClick={() => { setMode(null); setMsg(''); }}>返回</button>
                </form>
              )}
            </div>
          </div>
        )}

        <div className="page-foot">
          <Link href="/">← 回首页</Link>
          <a className="header-link" href="/downloads/campus-wall-v3.apk" download style={{ marginLeft: 14 }}>
            下载 App
          </a>
        </div>
      </main>
    </>
  );
}
