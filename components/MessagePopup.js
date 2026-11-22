'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { avatarStyle, initial } from '@/lib/format';

const TOAST_MS = 6000;

/** 全局新消息提醒：长轮询（服务器挂 24 秒）实现近似实时推送，失败自动重试 */
export default function MessagePopup() {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const [toasts, setToasts] = useState([]);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const seenIds = useRef(new Set());

  function pushToast(peer, content, msgId) {
    if (seenIds.current.has(msgId)) return false;
    seenIds.current.add(msgId);
    if (seenIds.current.size > 300) seenIds.current = new Set();
    if (pathnameRef.current === `/messages/${peer.id}`) return false;

    const id = `${peer.id}-${Date.now()}`;
    setToasts((prev) => [...prev, { id, peer, content }].slice(-3));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_MS);
    window.dispatchEvent(new CustomEvent('cw:newdm', { detail: { peerId: peer.id } }));
    return true;
  }

  useEffect(() => {
    let alive = true;
    let since = '';

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    async function loop() {
      try {
        const init = await fetch('/api/dm/watch?bridge=1', { cache: 'no-store' });
        if (init.ok) {
          const d = await init.json().catch(() => ({}));
          if (d.since) since = d.since;
        }
      } catch {
        /* 桥接失败也没关系，下面循环会自动兜底 */
      }
      while (alive) {
        try {
          const res = await fetch(`/api/dm/watch${since ? `?since=${encodeURIComponent(since)}` : ''}`, {
            cache: 'no-store'
          });
          if (!alive) break;
          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            if (data.since) since = data.since;
            for (const m of data.messages || []) {
              if (m.peer) pushToast(m.peer, m.content, m.id);
            }
          } else {
            await sleep(5000);
          }
        } catch {
          await sleep(5000);
        }
        if (alive) await sleep(200);
      }
    }

    loop();

    return () => {
      alive = false;
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
