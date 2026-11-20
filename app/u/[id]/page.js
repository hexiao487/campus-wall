'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import PostCard from '@/components/PostCard';
import { avatarStyle, initial, timeAgo } from '@/lib/format';

export default function UserProfilePage() {
  const params = useParams();
  const userId = params.id;

  const [me, setMe] = useState(null);
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

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

  const load = useCallback(async () => {
    try {
      const [pRes, postRes] = await Promise.all([
        fetch(`/api/users/${userId}`, { cache: 'no-store' }),
        fetch(`/api/posts?author=${userId}`, { cache: 'no-store' })
      ]);
      const pData = await pRes.json();
      if (!pRes.ok) throw new Error(pData.error || '加载失败');
      setProfile(pData);
      const postData = await postRes.json();
      setPosts(postData.posts || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    (async () => {
      await loadMe();
      await load();
    })();
  }, [loadMe, load]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setMe(null);
  }

  async function doAction(url, body) {
    if (!me) {
      setErr('登录后才能操作');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '操作失败');
      setToast(
        body.action === 'request'
          ? '好友申请已发出'
          : body.action === 'accept'
          ? '已加为好友'
          : '操作成功'
      );
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleFollow() {
    const following = profile?.relation?.following;
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: userId, follow: !following })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '操作失败');
      setToast(following ? '已取消关注' : '已关注');
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function like(id) {
    const res = await fetch(`/api/posts/${id}/like`, { method: 'POST' });
    if (res.ok) await load();
  }

  if (loading) {
    return (
      <>
        <SiteHeader me={me} onLogout={handleLogout} />
        <div className="shell"><div className="empty">加载中…</div></div>
      </>
    );
  }

  if (err && !profile) {
    return (
      <>
        <SiteHeader me={me} onLogout={handleLogout} />
        <div className="shell">
          <div className="card"><div className="empty">{err}</div></div>
        </div>
      </>
    );
  }

  const u = profile.user;
  const rel = profile.relation || {};
  const stats = profile.stats || {};

  return (
    <>
      <SiteHeader me={me} onLogout={handleLogout} />
      <div className="shell">
        {toast && <div className="notice" onClick={() => setToast('')}>{toast}</div>}
        {err && <div className="alert">{err}</div>}

        <div className="card profile-card">
          <div className="profile-head">
            <span className="avatar profile-avatar" style={avatarStyle(u.username, u.avatar_url)}>
              {u.avatar_url ? '' : initial(u.username)}
            </span>
            <div className="profile-main">
              <div className="profile-name">
                {u.username}
                {u.role === 'admin' && <span className="badge-admin">管理员</span>}
              </div>
              <div className="profile-sub">
                加入于 {new Date(u.created_at).getFullYear()} 年 · {timeAgo(u.created_at)}活跃
              </div>
              <div className="profile-stats">
                <span><b>{stats.posts}</b> 帖子</span>
                <span><b>{stats.following}</b> 关注</span>
                <span><b>{stats.followers}</b> 粉丝</span>
              </div>
            </div>
          </div>

          {!rel.isMe && (
            <div className="profile-actions">
              <button className={rel.following ? 'btn btn-ghost' : 'btn btn-primary'} onClick={toggleFollow} disabled={busy}>
                {rel.following ? '已关注' : '+ 关注'}
              </button>

              {rel.friend ? (
                <>
                  <Link className="btn btn-primary" href={`/messages/${u.id}`}>发私信</Link>
                  <Link className="btn btn-ghost" href={`/ptt?with=${u.id}`}>开对讲机</Link>
                </>
              ) : rel.pendingOut ? (
                <span className="tag-muted">好友申请已发出</span>
              ) : rel.pendingIn ? (
                <Link className="btn btn-primary" href="/friends">对方已申请，去同意</Link>
              ) : (
                <button className="btn btn-primary" onClick={() => doAction('/api/friends', { action: 'request', to: u.id })} disabled={busy}>
                  + 加好友
                </button>
              )}
            </div>
          )}

          {rel.isMe && (
            <div className="profile-actions">
              <Link className="btn btn-ghost" href="/friends">好友中心</Link>
              <Link className="btn btn-ghost" href="/messages">我的私信</Link>
            </div>
          )}
        </div>

        <div className="section-title" style={{ margin: '26px 0 14px' }}>
          {rel.isMe ? '我的帖子' : 'TA 的帖子'}
        </div>

        {posts.length === 0 && <div className="card"><div className="empty">还没有发过帖子</div></div>}
        {posts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            liked={false}
            me={me}
            onLike={like}
            onDelete={() => load()}
            onDeleteComment={() => load()}
          />
        ))}
      </div>
    </>
  );
}
