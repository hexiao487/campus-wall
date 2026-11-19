'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import { timeAgo, initial, avatarStyle } from '@/lib/format';

const POLL_MS = 5000;
const MAX_IMAGE = 4 * 1024 * 1024;

export default function GroupRoomPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params?.id;

  const [me, setMe] = useState(null);
  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [requests, setRequests] = useState([]);
  const [isOwner, setIsOwner] = useState(false);
  const [isMember, setIsMember] = useState(true);
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [busyReq, setBusyReq] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const listRef = useRef(null);
  const atBottomRef = useRef(true);
  const fileRef = useRef(null);

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

  const loadGroup = useCallback(async () => {
    try {
      const res = await fetch(`/api/groups/${groupId}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.status === 403) {
        setGroup(data.group || null);
        setIsMember(false);
        setIsOwner(false);
        return;
      }
      if (!res.ok) throw new Error(data.error || '加载失败');
      setGroup(data.group);
      setIsOwner(Boolean(data.is_owner));
      setIsMember(true);
      setMessages(data.messages || []);
      setRequests(data.requests || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    (async () => {
      const user = await loadMe();
      if (!user) {
        setLoading(false);
        return;
      }
      await loadGroup();
    })();
  }, [loadMe, loadGroup]);

  useEffect(() => {
    if (!isMember) return;
    const timer = setInterval(loadGroup, POLL_MS);
    return () => clearInterval(timer);
  }, [loadGroup, isMember]);

  useEffect(() => {
    const el = listRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setMe(null);
  }

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }

  async function joinGroup() {
    setErr('');
    try {
      const res = await fetch(`/api/groups/${groupId}/join`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '申请失败');
      setErr('申请已提交，等群主同意后就能进群聊了。');
    } catch (e) {
      setErr(e.message);
    }
  }

  async function pickImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr('');
    if (file.size > MAX_IMAGE) {
      setErr('图片不能超过 4MB，先压缩一下吧');
      e.target.value = '';
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '上传失败');
      setImageUrl(data.url);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  }

  async function send(e) {
    e.preventDefault();
    const content = text.trim();
    if (sending || uploading) return;
    if (!content && !imageUrl) return;
    setSending(true);
    setErr('');
    try {
      const res = await fetch(`/api/groups/${groupId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, imageUrl: imageUrl || null })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '发送失败');
      atBottomRef.current = true;
      setMessages((prev) => [...prev, data.message]);
      setText('');
      setImageUrl('');
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSending(false);
    }
  }

  async function recall(msg) {
    if (!window.confirm('撤回这条消息吗？')) return;
    const backup = messages;
    setErr('');
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    try {
      const res = await fetch(`/api/groups/${groupId}/messages/${msg.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '撤回失败');
    } catch (e) {
      setMessages(backup);
      setErr(e.message);
    }
  }

  async function review(reqRow, action) {
    if (busyReq) return;
    setErr('');
    setBusyReq(reqRow.id);
    try {
      const res = await fetch(`/api/groups/${groupId}/requests/${reqRow.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '操作失败');
      setRequests((prev) => prev.filter((r) => r.id !== reqRow.id));
      if (action === 'approve') await loadGroup();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusyReq('');
    }
  }

  const muted = me?.role === 'user' && me?.isMuted;

  return (
    <>
      <SiteHeader me={me} onLogout={handleLogout} />

      <main className="shell">
        <div className="room-head">
          <Link className="room-back" href="/chat">
            ‹ 全部群聊
          </Link>
          <div>
            <h1 className="room-title">{group?.name || '群聊'}</h1>
            {group && (
              <div className="room-sub">
                群主 {group.owner_name} · {group.member_count} 人
                {isOwner && <span className="badge-admin">群主是我</span>}
              </div>
            )}
          </div>
        </div>

        {err && (
          <div className="alert" onClick={() => setErr('')} style={{ cursor: 'pointer' }}>
            {err}（点击关闭）
          </div>
        )}

        {!me ? (
          <div className="card composer">
            <div className="notice" style={{ marginBottom: 0 }}>登录后才能进入群聊。</div>
            <div className="composer-bar">
              <Link className="btn btn-primary" href="/login">
                登录 / 注册
              </Link>
            </div>
          </div>
        ) : !isMember ? (
          <div className="card composer">
            <div className="notice" style={{ marginBottom: 10 }}>
              你还没加入「{group?.name || '这个群'}」，加入需要群主同意。
            </div>
            <div className="composer-bar">
              <button className="btn btn-primary" onClick={joinGroup}>
                申请加入
              </button>
              <button className="btn btn-ghost" onClick={() => router.push('/chat')}>
                回到群列表
              </button>
            </div>
          </div>
        ) : (
          <>
            {isOwner && requests.length > 0 && (
              <div className="card requests-card">
                <div className="group-section-title">加入申请（{requests.length}）</div>
                {requests.map((r) => (
                  <div className="request-row" key={r.id}>
                    <div className="request-who">
                      <span className="avatar" style={avatarStyle(r.user_name)}>
                        {initial(r.user_name)}
                      </span>
                      <span>{r.user_name}</span>
                      <span className="chat-time">{timeAgo(r.created_at)}</span>
                    </div>
                    <div className="request-actions">
                      <button
                        className="btn btn-primary btn-mini"
                        disabled={busyReq === r.id}
                        onClick={() => review(r, 'approve')}
                      >
                        同意
                      </button>
                      <button
                        className="btn btn-ghost btn-mini"
                        disabled={busyReq === r.id}
                        onClick={() => review(r, 'reject')}
                      >
                        拒绝
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="card chat-card">
              <div className="chat-list" ref={listRef} onScroll={handleScroll}>
                {loading ? (
                  <div className="empty">正在加载…</div>
                ) : messages.length === 0 ? (
                  <div className="empty">群里还很安静，来开个场吧 ✨</div>
                ) : (
                  messages.map((m) => {
                    const mine = Boolean(me?.id) && m.author_id === me.id;
                    const canDelete = isOwner || mine || me?.role === 'admin';
                    return (
                      <div className={`chat-row ${mine ? 'mine' : ''}`} key={m.id}>
                        {!mine && (
                          <span className="avatar chat-avatar" style={avatarStyle(m.author_name)}>
                            {initial(m.author_name)}
                          </span>
                        )}
                        <div className="chat-main">
                          <div className="chat-meta">
                            <span className="chat-author">
                              {mine ? '我' : m.author_name}
                              {m.author_name === '管理员' && <span className="badge-admin">官方</span>}
                            </span>
                            <span className="chat-time">{timeAgo(m.created_at)}</span>
                            {canDelete && (
                              <button className="chat-del" onClick={() => recall(m)}>
                                撤回
                              </button>
                            )}
                          </div>
                          {(m.content || m.image_url) && (
                            <div className="chat-bubble">
                              {m.content && <div>{m.content}</div>}
                              {m.image_url && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img className="chat-image" src={m.image_url} alt="图片消息" loading="lazy" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {imageUrl && (
                <div className="chat-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="待发送图片" />
                  <button className="btn btn-ghost btn-mini" onClick={() => setImageUrl('')}>
                    移除
                  </button>
                </div>
              )}

              <form className="chat-form" onSubmit={send}>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={pickImage}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-mini chat-img-btn"
                  onClick={() => fileRef.current?.click()}
                  disabled={muted || uploading || sending}
                  title="发图片"
                >
                  {uploading ? '上传中…' : '📷'}
                </button>
                <input
                  value={text}
                  maxLength={500}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={muted ? '你已被禁言，暂时不能发言' : '说点什么…'}
                  disabled={muted || sending}
                />
                <button
                  className="btn btn-primary btn-mini"
                  disabled={muted || sending || uploading || (!text.trim() && !imageUrl)}
                >
                  {sending ? '发送中' : '发送'}
                </button>
              </form>
            </div>
          </>
        )}
      </main>
    </>
  );
}
