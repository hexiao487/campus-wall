'use client';

import { compressImage } from '@/lib/imageCompress';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { imgSrc } from '@/lib/img';
import SiteHeader from '@/components/SiteHeader';
import { avatarStyle, initial, timeAgo } from '@/lib/format';

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  const list = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return list.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

export default function DmRoomPage() {
  const params = useParams();
  const peerId = params.id;

  const [me, setMe] = useState(null);
  const [peer, setPeer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);

  const listRef = useRef(null);
  const fileRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

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
      const res = await fetch(`/api/dm?with=${peerId}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '加载失败');
      setPeer(data.peer || null);
      setMessages(data.messages || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [peerId]);

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

  // 每 4 秒拉一次新消息
  useEffect(() => {
    if (!me) return;
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [me, load]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setMe(null);
  }

  async function send(payload) {
    setErr('');
    const res = await fetch('/api/dm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: peerId, ...payload })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '发送失败');
    setMessages((prev) => [...prev, data.message]);
    return data.message;
  }

  async function sendText() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      await send({ kind: 'text', content });
      setText('');
    } catch (e) {
      setErr(e.message);
    } finally {
      setSending(false);
    }
  }

  async function uploadFile(file) {
    const prepared = file.type?.startsWith('image/') ? await compressImage(file) : file;
    const form = new FormData();
    form.append('file', prepared);
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '上传失败');
    return data.url;
  }

  async function onPickImage(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setErr('');
    try {
      const url = await uploadFile(file);
      await send({ kind: 'image', imageUrl: url });
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setUploading(false);
    }
  }

  async function startRecord() {
    if (recording || uploading) return;
    setErr('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size) chunksRef.current.push(ev.data);
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setErr('拿不到麦克风权限，检查一下系统设置');
    }
  }

  async function stopRecord() {
    const rec = recorderRef.current;
    if (!rec) return;
    clearInterval(timerRef.current);
    const duration = Math.max(seconds, 1);
    setRecording(false);
    setUploading(true);

    const blob = await new Promise((resolve) => {
      rec.onstop = () => resolve(new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' }));
      rec.stop();
    });
    streamRef.current?.getTracks().forEach((t) => t.stop());
    recorderRef.current = null;

    try {
      if (blob.size < 800) throw new Error('说太短了，再按久一点');
      const ext = (blob.type || 'audio/webm').includes('mp4') ? 'mp4' : 'webm';
      const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type || 'audio/webm' });
      const url = await uploadFile(file);
      await send({ kind: 'audio', audioUrl: url, audioSeconds: duration });
    } catch (e) {
      setErr(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function invitePtt() {
    try {
      await send({ kind: 'ptt_invite', content: '邀请你一起用对讲机' });
    } catch (e) {
      setErr(e.message);
    }
  }

  const bubbles = messages.map((m) => {
    const mine = m.sender_id === me?.id;
    return (
      <div className={`dm-line ${mine ? 'mine' : ''}`} key={m.id}>
        {!mine && (
          <span className="avatar" style={{ ...avatarStyle(peer?.username || '?', peer?.avatar_url), width: 30, height: 30, borderRadius: 10 }}>
            {initial(peer?.username)}
          </span>
        )}
        <div className={`dm-bubble ${mine ? 'mine' : ''}`}>
          {m.kind === 'text' && <div>{m.content}</div>}
          {m.kind === 'image' && (
            <a href={m.image_url} target="_blank" rel="noreferrer">
              <img className="dm-image" src={imgSrc(m.image_url)} alt="图片" />
            </a>
          )}
          {m.kind === 'audio' && (
            <div className="dm-audio">
              <audio controls src={m.audio_url} preload="none" />
              <span className="post-time">{m.audio_seconds || 1}"</span>
            </div>
          )}
          {m.kind === 'ptt_invite' && (
            <Link className="dm-ptt-invite" href={`/ptt?with=${mine ? m.receiver_id : m.sender_id}`}>
              <strong>🎙 对讲机邀请</strong>
              <span>点这里进频道，按住说话就能实时听见对方</span>
            </Link>
          )}
          <div className="dm-time">{timeAgo(m.created_at)}</div>
        </div>
      </div>
    );
  });

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
            <div className="section-title">登录后才能私信</div>
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
        <div className="room-head">
          <Link className="room-back" href="/messages">← 私信</Link>
          <div>
            <div className="room-title">
              {peer ? (
                <Link className="author-link" href={`/u/${peer.id}`}>
                  {peer.username}
                  {peer.role === 'admin' && <span className="badge-admin">管理员</span>}
                </Link>
              ) : (
                '聊天'
              )}
            </div>
            <div className="room-sub">
              {peer ? (
                <Link href={`/ptt?with=${peerId}`}>🎙 和 TA 开对讲机</Link>
              ) : '对方不存在'}
            </div>
          </div>
        </div>

        {err && <div className="alert">{err}</div>}

        <div className="dm-list" ref={listRef}>
          {messages.length === 0 && <div className="empty">还没有消息，说句「你好」开始吧</div>}
          {bubbles}
        </div>

        <div className="dm-composer">
          <button className="btn btn-ghost btn-mini" onClick={() => fileRef.current?.click()} disabled={uploading}>
            📷
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickImage} />

          <input
            className="dm-input"
            placeholder="说点什么…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendText()}
          />

          <button
            className={`btn btn-mini ${recording ? 'btn-primary' : 'btn-ghost'}`}
            onClick={recording ? stopRecord : startRecord}
            disabled={uploading}
          >
            {recording ? `⏹ ${seconds}"` : uploading ? '上传中' : '🎤'}
          </button>
          <button className="btn btn-primary btn-mini" onClick={sendText} disabled={sending || !text.trim()}>
            发送
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <button className="btn btn-ghost btn-mini" onClick={invitePtt}>🎙 邀请 TA 用对讲机</button>
        </div>
      </div>
    </>
  );
}
