'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import { initial, avatarStyle } from '@/lib/format';

export default function FriendsPage() {
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [following, setFollowing] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = await res.json();
      setMe(data.user || null);
      return data.user || null;
    } catch {
      setMe(null);
      return null;
    }
  }, []);

  const loadFriends = useCallback(async () => {
    try {
      const res = await fetch('/api/friends', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '加载失败');
      setFriends(data.friends || []);
      setIncoming(data.incoming || []);
      setOutgoing(data.outgoing || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFollow = useCallback(async (scope) => {
    try {
      const res = await fetch(`/api/follow?scope=${scope}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '加载失败');
      if (scope === 'following') setFollowing(data.users || []);
      else setFollowers(data.users || []);
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const user = await loadMe();
      if (!user) {
        setLoading(false);
        return;
      }
      await loadFriends();
    })();
  }, [loadMe, loadFriends]);

  useEffect(() => {
    if (!me) return;
    if (tab === 'following') loadFollow('following');
    if (tab === 'followers') loadFollow('followers');
  }, [tab, me, loadFollow]);

  async function searchUsers() {
    setBusy('search');
    setErr('');
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '搜索失败');
      setFound(data.users || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy('');
    }
  }

  async function act(url, body, key) {
    setBusy(key);
    setErr('');
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '操作失败');
      await loadFriends();
      if (found.length) await searchUsers();
      if (tab === 'following') await loadFollow('following');
      if (tab === 'followers') await loadFollow('followers');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy('');
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setMe(null);
    setFriends([]);
    setIncoming([]);
  }

  const personRow = (u, right) => (
    <div className="row" key={u.id}>
      <Link className="avatar avatar-link" href={`/u/${u.id}`} style={{ ...avatarStyle(u.username, u.avatar_url), width: 38, height: 38, borderRadius: 12 }}>
        {u.avatar_url ? '' : initial(u.username)}
      </Link>
      <div className="row-main">
        <div className="row-title">
          <Link className="author-link" href={`/u/${u.id}`}>{u.username}</Link>
          {u.role === 'admin' && <span className="badge-admin">管理员</span>}
        </div>
        <div className="row-sub">{u.followedBy ? '关注了你' : ''}</div>
      </div>
      <div className="request-actions">{right}</div>
    </div>
  );

  if (loading) {
    return (
      <>
        <SiteHeader me={me} onLogout={handleLogout} />
        <div className="shell"><div className="empty">加载中…</div></div>
      </>
    );
  }

  if (!me) {
    return (
      <>
        <SiteHeader me={null} />
        <div className="shell">
          <div className="card">
            <div className="section-title">登录后才能加好友、关注和私信</div>
            <div style={{ marginTop: 12 }}>
              <Link className="btn btn-primary" href="/login">登录 / 注册</Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SiteHeader me={me} onLogout={handleLogout} />
      <div className="shell">
        <div className="hero">
          <div>
            <h1 className="room-title">好友</h1>
            <div className="room-sub">关注、加好友、私信，还能和好友开对讲机</div>
          </div>
        </div>

        {err && <div className="alert">{err}</div>}

        <div className="tabs">
          <button className={tab === 'friends' ? 'active' : ''} onClick={() => setTab('friends')}>
            好友 {friends.length}
          </button>
          <button className={tab === 'requests' ? 'active' : ''} onClick={() => setTab('requests')}>
            申请 {incoming.length}
          </button>
          <button className={tab === 'following' ? 'active' : ''} onClick={() => setTab('following')}>
            关注 {following.length}
          </button>
          <button className={tab === 'followers' ? 'active' : ''} onClick={() => setTab('followers')}>
            粉丝 {followers.length}
          </button>
          <button className={tab === 'find' ? 'active' : ''} onClick={() => setTab('find')}>
            找人
          </button>
        </div>

        {tab === 'friends' && (
          <div className="card">
            {friends.length === 0 && <div className="empty">还没有好友，去「找人」搜同学加好友吧</div>}
            {friends.map((u) =>
              personRow(
                u,
                <>
                  <Link className="btn btn-mini btn-primary" href={`/messages/${u.id}`}>私信</Link>
                  <Link className="btn btn-mini btn-ghost" href={`/ptt?with=${u.id}`}>对讲机</Link>
                  <button
                    className="btn btn-mini btn-ghost"
                    disabled={busy === 'rm' + u.id}
                    onClick={() => act('/api/friends', { action: 'remove', to: u.id }, 'rm' + u.id)}
                  >
                    删除
                  </button>
                </>
              )
            )}
          </div>
        )}

        {tab === 'requests' && (
          <div className="card">
            <div className="group-section-title">收到的申请</div>
            {incoming.length === 0 && <div className="empty">没有新的好友申请</div>}
            {incoming.map((r) =>
              personRow(
                r.user,
                <>
                  <button
                    className="btn btn-mini btn-primary"
                    disabled={busy === 'ac' + r.requestId}
                    onClick={() => act('/api/friends', { action: 'accept', requestId: r.requestId }, 'ac' + r.requestId)}
                  >
                    同意
                  </button>
                  <button
                    className="btn btn-mini btn-ghost"
                    disabled={busy === 'rj' + r.requestId}
                    onClick={() => act('/api/friends', { action: 'reject', requestId: r.requestId }, 'rj' + r.requestId)}
                  >
                    拒绝
                  </button>
                </>
              )
            )}
            <div className="group-section-title" style={{ marginTop: 24 }}>我发出的申请</div>
            {outgoing.length === 0 && <div className="empty">没有等待对方同意的申请</div>}
            {outgoing.map((r) =>
              personRow(
                r.user,
                <span className="tag-muted">等待同意</span>
              )
            )}
          </div>
        )}

        {tab === 'following' && (
          <div className="card">
            {following.length === 0 && <div className="empty">还没有关注任何人</div>}
            {following.map((u) =>
              personRow(
                u,
                <button
                  className="btn btn-mini btn-ghost"
                  disabled={busy === 'u' + u.id}
                  onClick={() => act('/api/follow', { targetId: u.id, follow: false }, 'u' + u.id)}
                >
                  取消关注
                </button>
              )
            )}
          </div>
        )}

        {tab === 'followers' && (
          <div className="card">
            {followers.length === 0 && <div className="empty">还没有粉丝</div>}
            {followers.map((u) =>
              personRow(
                u,
                <Link className="btn btn-mini btn-ghost" href={`/messages/${u.id}`}>私信</Link>
              )
            )}
          </div>
        )}

        {tab === 'find' && (
          <div className="card">
            <div className="group-create-form">
              <input
                className="group-name-input"
                placeholder="搜用户名，比如 小林"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
              />
              <button className="btn btn-primary" onClick={searchUsers} disabled={busy === 'search'}>
                {busy === 'search' ? '搜索中' : '搜索'}
              </button>
            </div>

            <div style={{ marginTop: 16 }}>
              {found.map((u) =>
                personRow(
                  u,
                  <>
                    <button
                      className="btn btn-mini btn-ghost"
                      disabled={busy === 'f' + u.id}
                      onClick={() => act('/api/follow', { targetId: u.id, follow: !u.following }, 'f' + u.id)}
                    >
                      {u.following ? '已关注' : '关注'}
                    </button>
                    {u.friend ? (
                      <>
                        <Link className="btn btn-mini btn-primary" href={`/messages/${u.id}`}>私信</Link>
                        <Link className="btn btn-mini btn-ghost" href={`/ptt?with=${u.id}`}>对讲机</Link>
                      </>
                    ) : u.pendingOut ? (
                      <span className="tag-muted">申请已发出</span>
                    ) : u.pendingIn ? (
                      <button
                        className="btn btn-mini btn-primary"
                        onClick={() => { setTab('requests'); }}
                      >
                        对方已申请
                      </button>
                    ) : (
                      <button
                        className="btn btn-mini btn-primary"
                        disabled={busy === 'rq' + u.id}
                        onClick={() => act('/api/friends', { action: 'request', to: u.id }, 'rq' + u.id)}
                      >
                        加好友
                      </button>
                    )}
                  </>
                )
              )}
              {found.length === 0 && <div className="empty">输入用户名搜一下同学</div>}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
