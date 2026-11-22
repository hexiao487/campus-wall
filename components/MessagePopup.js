'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { avatarStyle, initial } from '@/lib/format';

const TOAST_MS = 6000;

/** 全局新消息提醒：SSE 实时推送私信，断线自动重连；不支持的浏览器退回轮询 */
export default function MessagePopup() {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const [toasts, setToasts] = useState([]);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const seenIds = useRef(new Set());

  function pushToast(peer, content) {
    const id = `${peer.id}-${Date.now()}`;
    setToasts((prev) => [...prev, { id, peer, content }].slice(-3));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_MS);
    window.dispatchEvent(new CustomEvent('cw:newdm', { detail: { peerId: peer.id } }));
  }

  useEffect(() => {
    let es = null;
    let alive = true;
    let fallbackTimer = null;

    function handleIncoming(peer, content, msgId) {
      window.__cwDmEvents = (window.__cwDmEvents || 0) + 1;
      if (!alive || !peer?.id) return;
      if (msgId) {
        if (seenIds.current.has(msgId)) return;
        seenIds.current.add(msgId);
        if (seenIds.current.size > 300) seenIds.current = new Set();
      }
      if (pathnameRef.current === `/messages/${peer.id}`) return;
      pushToast(peer, content);
    }

    function startFallback() {
      if (fallbackTimer) return;
      let primed = false;
      const seen = new Map();
      async function poll() {
        try {
          const res = await fetch('/api/dm', { cache: 'no-store' });
          if (!res.ok) return;
          const data = await res.json().catch(() => ({}));
          const list = data.conversations || [];
          if (!primed) {
            list.forEach((c) => seen.set(c.peer.id, { lastAt: c.lastAt || '', unread: c.unread || 0 }));
            primed = true;
            return;
          }
          list.forEach((c) => {
            const prev = seen.get(c.peer.id) || { lastAt: '', unread: 0 };
            seen.set(c.peer.id, { lastAt: c.lastAt || '', unread: c.unread || 0 });
            const unread = c.unread || 0;
            if (unread <= 0) return;
            if (unread > (prev.unread || 0) || (c.lastAt && c.lastAt !== prev.lastAt && !c.lastFromMe)) {
              handleIncoming(c.peer, c.lastMessage || '', `${c.peer.id}-${c.lastAt}`);
            }
          });
        } catch {
          /* 忽略 */
        }
      }
      poll();
      fallbackTimer = setInterval(poll, 20000);
    }

    function stopFallback() {
      if (fallbackTimer) {
        clearInterval(fallbackTimer);
        fallbackTimer = null;
      }
    }

    function connect() {
      if (!alive) return;
      if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') {
        startFallback();
        return;
      }
      try {
        es = new window.EventSource('/api/dm/stream');
      } catch {
        startFallback();
        return;
      }

      window.__cwEs = es;
      es.addEventListener('ready', () => {
        window.__cwReady = (window.__cwReady || 0) + 1;
        stopFallback();
      });

      es.addEventListener('dm', (e) => {
        try {
          const data = JSON.parse(e.data);
          handleIncoming(data.peer, data.content, data.id);
        } catch {
          /* 忽略坏数据 */
        }
      });

      es.addEventListener('error', () => {
        window.__cwEsErr = (window.__cwEsErr || 0) + 1;
        startFallback();
      });
    }

    window.__cwPopupMounted = (window.__cwPopupMounted || 0) + 1;
    connect();

    return () => {
      alive = false;
      stopFallback();
      if (es) es.close();
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="msg-pop-layer" aria-live="polite">
      {toasts.map(({ id, peer, content }) => (
        <button
          className="msg-pop"
          key={id}
          onClick={() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
            router.push(`/messages/${peer.id}`);
          }}
        >
          <span className="avatar msg-pop-avatar" style={avatarStyle(peer.username, peer.avatar_url)}>
            {peer.avatar_url ? '' : initial(peer.username)}
          </span>
          <span className="msg-pop-main">
            <span className="msg-pop-title">
              {peer.username}
              {peer.role === 'admin' && peer.username !== '管理员' && <span className="badge-admin">管理员</span>}
              <span className="msg-pop-live">新消息</span>
            </span>
            <span className="msg-pop-text">{content}</span>
          </span>
          <span className="msg-pop-reply">回复 ›</span>
        </button>
      ))}
    </div>
  );
}
