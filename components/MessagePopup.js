'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { avatarStyle, initial } from '@/lib/format';

/** 全局新消息弹窗：轮询私信，别人发来新消息时弹出提示 */
export default function MessagePopup() {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const seen = useRef(new Map());
  const [toasts, setToasts] = useState([]);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    let alive = true;
    let primed = false;

    async function poll() {
      try {
        const res = await fetch('/api/dm', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        const list = data.conversations || [];

        if (!primed) {
          list.forEach((c) => seen.current.set(c.peer.id, { lastAt: c.lastAt || '', unread: c.unread || 0 }));
          primed = true;
          return;
        }

        const fresh = [];
        list.forEach((c) => {
          const key = c.lastAt || '';
          const prev = seen.current.get(c.peer.id) || { lastAt: '', unread: 0 };
          seen.current.set(c.peer.id, { lastAt: key, unread: c.unread || 0 });
          const unread = c.unread || 0;
          if (unread <= 0) return;
          const newer = unread > (prev.unread || 0);
          const changed = key && key !== prev.lastAt && !c.lastFromMe;
          if (newer || changed) fresh.push(c);
        });

        fresh.slice(0, 3).forEach((c) => {
          if (pathnameRef.current === `/messages/${c.peer.id}`) return;
          const id = `${c.peer.id}-${Date.now()}`;
          setToasts((prev) => [...prev, { id, conv: c }].slice(-3));
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
          }, 6000);
        });
      } catch {
        /* 轮询失败忽略 */
      }
    }

    poll();
    const t = setInterval(poll, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="msg-pop-layer" aria-live="polite">
      {toasts.map(({ id, conv }) => (
        <button
          className="msg-pop"
          key={id}
          onClick={() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
            router.push(`/messages/${conv.peer.id}`);
          }}
        >
          <span className="avatar msg-pop-avatar" style={avatarStyle(conv.peer.username, conv.peer.avatar_url)}>
            {conv.peer.avatar_url ? '' : initial(conv.peer.username)}
          </span>
          <span className="msg-pop-main">
            <span className="msg-pop-title">
              {conv.peer.username}
              {conv.peer.role === 'admin' && conv.peer.username !== '管理员' && (
                <span className="badge-admin">管理员</span>
              )}
            </span>
            <span className="msg-pop-text">{conv.lastMessage}</span>
          </span>
          <span className="msg-pop-reply">回复 ›</span>
        </button>
      ))}
    </div>
  );
}
