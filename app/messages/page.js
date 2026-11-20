'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import { avatarStyle, initial, timeAgo } from '@/lib/format';

export default function MessagesPage() {
  const [me, setMe] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mentions, setMentions] = useState([]);
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

  const load = useCallback(async () => {
    try {
      const [res, mRes] = await Promise.all([
        fetch('/api/dm', { cache: 'no-store' }),
        fetch('/api/mentions', { cache: 'no-store' })
      ]);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '加载失败');
      setConversations(data.conversations || []);
      const mData = await mRes.json().catch(() => ({}));
      setMentions(mData.mentions || []);
      if (mData.unread > 0) {
        // 看过即标记为已读，底部导航的红点随之消失
        fetch('/api/mentions', { method: 'POST' }).catch(() => {});
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const user = await loadMe();
      if (!user) {
        setLoading(false);
        return;
      }
      await load();
    })();
  }, [loadMe, load]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setMe(null);
    setConversations([]);
  }

  return (
    <>
      <SiteHeader me={me} onLogout={handleLogout} />
      <div className="shell">
        <div className="hero">
          <div>
            <h1 className="room-title">私信</h1>
            <div className="room-sub">和好友一对一聊天，能发图片、发语音、约对讲机</div>
          </div>
          <Link className="btn btn-ghost btn-mini" href="/friends">加好友</Link>
        </div>

        {err && <div className="alert">{err}</div>}

        {me && mentions.length > 0 && (
          <div className="card mention-inbox">
            <div className="section-title">@ 提到我的</div>
            {mentions.slice(0, 12).map((m) => (
              <Link className="row mention-row" href={m.link || '/'} key={m.id}>
                <span className="avatar" style={{ ...avatarStyle(m.from.username, m.from.avatar_url), width: 38, height: 38, borderRadius: 12 }}>
                  {initial(m.from.username)}
                </span>
                <div className="row-main">
                  <div className="row-title">
                    {m.from.username}
                    <span className="mention-tag">在帖子里 @ 了你</span>
                    {!m.read && <i className="dot-unread" />}
                  </div>
                  <div className="row-sub">{m.snippet}</div>
                </div>
                <div className="post-time">{timeAgo(m.createdAt)}</div>
              </Link>
            ))}
          </div>
        )}

        {!me && !loading && (
          <div className="card">
            <div className="section-title">登录后才能收发私信</div>
            <div style={{ marginTop: 12 }}>
              <Link className="btn btn-primary" href="/login">登录 / 注册</Link>
            </div>
          </div>
        )}

        {me && (
          <div className="card">
            {loading && <div className="empty">加载中…</div>}
            {!loading && conversations.length === 0 && (
              <div className="empty">还没有会话，先去好友页找人聊两句</div>
            )}
            {conversations.map((c) => (
              <Link className="row" href={`/messages/${c.peer.id}`} key={c.peer.id}>
                <span className="avatar" style={{ ...avatarStyle(c.peer.username, c.peer.avatar_url), width: 40, height: 40, borderRadius: 13 }}>
                  {initial(c.peer.username)}
                </span>
                <div className="row-main">
                  <div className="row-title">
                    {c.peer.username}
                    {c.peer.role === 'admin' && <span className="badge-admin">管理员</span>}
                  </div>
                  <div className="row-sub">
                    {c.lastFromMe ? '我：' : ''}
                    {c.lastMessage}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="post-time">{timeAgo(c.lastAt)}</div>
                  {c.unread > 0 && <span className="tag-ok" style={{ marginTop: 6, display: 'inline-block' }}>{c.unread}</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
