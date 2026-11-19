'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import { timeAgo, initial, avatarStyle } from '@/lib/format';

const POLL_MS = 5000;

export default function ChatPage() {
  const [me, setMe] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const listRef = useRef(null);
  const atBottomRef = useRef(true);

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = await res.json();
      setMe(data.user || null);
    } catch {
      setMe(null);
    }
  }, []);

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/chat', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '加载失败');
      setMessages(data.messages || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
    loadMessages();
  }, [loadMe, loadMessages]);

  useEffect(() => {
    const timer = setInterval(loadMessages, POLL_MS);
    return () => clearInterval(timer);
  }, [loadMessages]);

  useEffect(() => {
    const el = listRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }

  async function send(e) {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setErr('');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '发送失败');
      atBottomRef.current = true;
      setMessages((prev) => [...prev, data.message]);
      setText('');
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSending(false);
    }
  }

  async function remove(msg) {
    if (!window.confirm('撤回这条消息吗？')) return;
    setErr('');
    const backup = messages;
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    try {
      const res = await fetch(`/api/chat/${msg.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '撤回失败');
    } catch (e) {
      setMessages(backup);
      setErr(e.message);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setMe(null);
  }

  const isAdmin = me?.role === 'admin';
  const muted = me?.role === 'user' && me?.isMuted;

  return (
    <>
      <SiteHeader me={me} onLogout={handleLogout} />

      <main className="shell">
        <div className="hero">
          <h1>
            群<span>聊</span>
          </h1>
          <p>墙上的实时聊天室，所有登录的同学都在这里。</p>
        </div>

        {err && (
          <div className="alert" onClick={() => setErr('')} style={{ cursor: 'pointer' }}>
            {err}（点击关闭）
          </div>
        )}

        {isAdmin && (
          <div className="notice">
            你正以管理员身份浏览，可以发言、撤回任意消息；禁言请前往{' '}
            <Link href="/admin" style={{ color: 'var(--blue)', fontWeight: 600 }}>
              管理后台
            </Link>
            。
          </div>
        )}

        <div className="card chat-card">
          <div className="chat-list" ref={listRef} onScroll={handleScroll}>
            {loading ? (
              <div className="empty">正在加载群聊…</div>
            ) : messages.length === 0 ? (
              <div className="empty">还没有人说话，来开个场吧 ✨</div>
            ) : (
              messages.map((m) => {
                const mine = Boolean(me?.id) && m.author_id === me.id;
                const canDelete = isAdmin || mine;
                const isAdminMsg = m.author_name === '管理员';
                return (
                  <div className={`chat-row ${mine ? 'mine' : ''}`} key={m.id}>
                    {!mine && (
                      <span className="avatar chat-avatar" style={avatarStyle(m.author_name)}>
                        {initial(m.author_name)}
                      </span>
                    )}
                    <div className="chat-main">
                      <div className="chat-meta">
                        {!mine && (
                          <span className="chat-author">
                            {m.author_name}
                            {isAdminMsg && <span className="badge-admin">官方</span>}
                          </span>
                        )}
                        {mine && (
                          <span className="chat-author">
                            我{isAdminMsg && <span className="badge-admin">官方</span>}
                          </span>
                        )}
                        <span className="chat-time">{timeAgo(m.created_at)}</span>
                        {canDelete && (
                          <button className="chat-del" onClick={() => remove(m)}>
                            撤回
                          </button>
                        )}
                      </div>
                      <div className="chat-bubble">{m.content}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {me ? (
            <form className="chat-form" onSubmit={send}>
              <input
                value={text}
                maxLength={500}
                onChange={(e) => setText(e.target.value)}
                placeholder={muted ? '你已被禁言，暂时不能发言' : '说点什么…'}
                disabled={muted || sending}
              />
              <button className="btn btn-primary btn-mini" disabled={muted || sending || !text.trim()}>
                {sending ? '发送中' : '发送'}
              </button>
            </form>
          ) : (
            <div className="chat-guest">
              <Link className="btn btn-primary btn-mini" href="/login">
                登录 / 注册
              </Link>
              <span>登录后才能参与群聊</span>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
