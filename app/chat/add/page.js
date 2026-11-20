'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import { initial, avatarStyle } from '@/lib/format';

export default function AddFriendPage() {
  const [me, setMe] = useState(null);
  const [q, setQ] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/auth/me', { cache: 'no-store' });
        setMe((await r.json()).user || null);
      } catch {
        /* 忽略 */
      }
      await search('');
    })();
  }, []);

  async function search(keyword) {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(keyword)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '搜索失败');
      setUsers(data.users || []);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function add(user) {
    if (busy) return;
    setBusy(user.id);
    setMsg('');
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', to: user.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '申请失败');
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, friend_status: 'pending' } : u)));
      setMsg(data.status === 'already_friends' ? '你们已经是好友了' : `已向 ${user.username} 发出好友申请`);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <>
      <SiteHeader me={me} onLogout={async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
      }} />

      <main className="shell add-friend-shell">
        <div className="add-top">
          <Link className="glass-btn add-back" href="/chat">‹ 返回群聊</Link>
          <Link className="glass-btn add-invite" href="/compose?invite=1">📣 发帖邀请陌生人</Link>
        </div>

        <div className="page-head">
          <h1>添加好友</h1>
          <p>搜用户名加好友，或者发一条帖子把陌生人喊进来。</p>
        </div>

        <form
          className="search-form"
          onSubmit={(e) => {
            e.preventDefault();
            search(q.trim());
          }}
        >
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜用户名，留空看推荐" />
          <button className="glass-btn" type="submit">搜索</button>
        </form>

        {msg && <div className="sheet-msg" style={{ padding: '4px 2px 10px' }}>{msg}</div>}

        {loading ? (
          <div className="empty">加载中…</div>
        ) : users.length === 0 ? (
          <div className="empty">没找到这个人</div>
        ) : (
          users.map((u) => (
            <div className="user-row" key={u.id}>
              <Link className="avatar" href={`/u/${u.id}`} style={avatarStyle(u.username, u.avatar_url)}>
                {!u.avatar_url && initial(u.username)}
              </Link>
              <div className="user-row-main">
                <b>{u.username}{u.role === 'admin' && u.username !== '管理员' && <span className="badge-admin">管理员</span>}</b>
                <span>
                  {u.friend ? '已是好友' : u.pendingOut || u.friend_status === 'pending' ? '已申请，等对方同意' : u.pendingIn ? '对方已申请你，去好友页同意' : '还没加好友'}
                </span>
              </div>
              {u.friend ? (
                <Link className="glass-btn user-row-btn" href={`/messages/${u.id}`}>私信</Link>
              ) : u.pendingOut || u.friend_status === 'pending' ? (
                <button className="glass-btn user-row-btn" disabled>已申请</button>
              ) : (
                <button className="glass-btn user-row-btn" onClick={() => add(u)} disabled={busy === u.id}>
                  {busy === u.id ? '发送中' : '加好友'}
                </button>
              )}
            </div>
          ))
        )}
      </main>
    </>
  );
}
