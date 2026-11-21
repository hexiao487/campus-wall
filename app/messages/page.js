'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import { avatarStyle, initial, timeAgo } from '@/lib/format';

const TABS = [
  { key: 'dm', label: '私信' },
  { key: 'groups', label: '群聊' },
  { key: 'friends', label: '好友' }
];

export default function MessagesPage() {
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState('dm');
  const [conversations, setConversations] = useState([]);
  const [groups, setGroups] = useState([]);
  const [friends, setFriends] = useState({ friends: [], incoming: [], outgoing: [] });
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
      const [res, mRes, gRes, fRes] = await Promise.all([
        fetch('/api/dm', { cache: 'no-store' }),
        fetch('/api/mentions', { cache: 'no-store' }),
        fetch('/api/groups', { cache: 'no-store' }),
        fetch('/api/friends', { cache: 'no-store' })
      ]);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '加载失败');
      setConversations(data.conversations || []);

      const mData = await mRes.json().catch(() => ({}));
      setMentions(mData.mentions || []);
      if (mData.unread > 0) {
        fetch('/api/mentions', { method: 'POST' }).catch(() => {});
      }

      const gData = await gRes.json().catch(() => ({}));
      setGroups(gData.mine || []);

      const fData = await fRes.json().catch(() => ({}));
      setFriends({
        friends: fData.friends || [],
        incoming: fData.incoming || [],
        outgoing: fData.outgoing || []
      });
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

  useEffect(() => {
    if (!me) return;
    const onNew = () => load();
    window.addEventListener('cw:newdm', onNew);
    return () => window.removeEventListener('cw:newdm', onNew);
  }, [me, load]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setMe(null);
    setConversations([]);
    setGroups([]);
    setFriends({ friends: [], incoming: [], outgoing: [] });
  }

  const dmUnread = conversations.reduce((s, c) => s + (c.unread || 0), 0);

  return (
    <>
      <SiteHeader me={me} onLogout={handleLogout} />
      <div className="shell">
        <div className="hero">
          <div>
            <h1 className="room-title">消息</h1>
            <div className="room-sub">私信、群聊、好友都收在这里</div>
          </div>
        </div>

        {err && <div className="alert">{err}</div>}

        {!me && !loading && (
          <div className="card">
            <div className="section-title">登录后才能收发消息</div>
            <div style={{ marginTop: 12 }}>
              <Link className="btn btn-primary" href="/login">登录 / 注册</Link>
            </div>
          </div>
        )}

        {me && (
          <>
            <div className="msg-tabs">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  className={`msg-tab ${tab === t.key ? 'on' : ''}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                  {t.key === 'dm' && dmUnread > 0 && <i className="msg-tab-dot" />}
                  {t.key === 'friends' && friends.incoming.length > 0 && <i className="msg-tab-dot" />}
                </button>
              ))}
            </div>

            {tab === 'dm' && (
              <>
                {mentions.length > 0 && (
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

                <div className="card">
                  {loading && <div className="empty">加载中…</div>}
                  {!loading && conversations.length === 0 && (
                    <div className="empty">还没有私信，去「好友」找人聊两句</div>
                  )}
                  {conversations.map((c) => (
                    <Link className="row" href={`/messages/${c.peer.id}`} key={c.peer.id}>
                      <span className="avatar" style={{ ...avatarStyle(c.peer.username, c.peer.avatar_url), width: 40, height: 40, borderRadius: 13 }}>
                        {initial(c.peer.username)}
                      </span>
                      <div className="row-main">
                        <div className="row-title">
                          {c.peer.username}
                          {c.peer.role === 'admin' && c.peer.username !== '管理员' && <span className="badge-admin">管理员</span>}
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
              </>
            )}

            {tab === 'groups' && (
              <div className="card">
                <div className="msg-section-head">
                  <div>
                    <div className="section-title">我的群聊</div>
                    <div className="row-sub">自己开群、申请进群，群主同意后一起聊</div>
                  </div>
                  <Link className="btn btn-ghost btn-mini" href="/chat">＋ 开群 / 加入</Link>
                </div>

                {loading && <div className="empty">加载中…</div>}
                {!loading && groups.length === 0 && (
                  <div className="empty">还没加入任何群，点右上角去开一个群</div>
                )}
                {groups.map((g) => (
                  <Link className="row" href={`/chat/${g.id}`} key={g.id}>
                    <span className="avatar msg-group-icon">{initial(g.name)}</span>
                    <div className="row-main">
                      <div className="row-title">
                        {g.name}
                        {g.is_owner && <span className="badge-admin">群主是我</span>}
                      </div>
                      <div className="row-sub">{g.member_count} 位成员 · 群主 {g.owner_name}</div>
                    </div>
                    <span className="row-sub">进入 ›</span>
                  </Link>
                ))}
              </div>
            )}

            {tab === 'friends' && (
              <div className="card">
                <div className="msg-section-head">
                  <div>
                    <div className="section-title">好友 {friends.friends.length}</div>
                    <div className="row-sub">好友申请 {friends.incoming.length} · 关注、私信、对讲机都在这里</div>
                  </div>
                  <Link className="btn btn-ghost btn-mini" href="/friends">好友中心</Link>
                </div>

                {loading && <div className="empty">加载中…</div>}
                {!loading && friends.friends.length === 0 && (
                  <div className="empty">还没有好友，去好友中心加一个</div>
                )}
                {friends.friends.map((f) => (
                  <div className="row" key={f.id}>
                    <Link className="avatar avatar-link" href={`/u/${f.id}`} style={{ ...avatarStyle(f.username, f.avatar_url), width: 40, height: 40, borderRadius: 13 }}>
                      {f.avatar_url ? '' : initial(f.username)}
                    </Link>
                    <div className="row-main">
                      <div className="row-title">
                        <Link className="author-link" href={`/u/${f.id}`}>{f.username}</Link>
                        {f.role === 'admin' && f.username !== '管理员' && <span className="badge-admin">管理员</span>}
                      </div>
                      <div className="row-sub">好友</div>
                    </div>
                    <div className="request-actions">
                      <Link className="btn btn-ghost btn-mini" href={`/messages/${f.id}`}>私信</Link>
                      <Link className="btn btn-ghost btn-mini" href="/ptt">对讲机</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
