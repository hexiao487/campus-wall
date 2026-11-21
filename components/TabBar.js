'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ICONS = {
  home: (
    <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true">
      <path d="M4 10.5 12 3l8 7.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6.5 10v9h11v-9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true">
      <path d="M4 6.5h16v9H9.5L4 19V6.5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
  friends: (
    <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true">
      <circle cx="9" cy="9" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 19c.6-3.4 2.9-5 5.5-5s4.9 1.6 5.5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 7.5a2.6 2.6 0 1 1 0 5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  dm: (
    <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="12.5" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 8.5 12 13l7-4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  ptt: (
    <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true">
      <rect x="9" y="3.5" width="6" height="10" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.5 12a6.5 6.5 0 0 0 13 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 18.5v2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ),
  me: (
    <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true">
      <circle cx="12" cy="8" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4.8 20c.8-4.2 3.6-6.2 7.2-6.2s6.4 2 7.2 6.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  compose: (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M4 20l1-4.2 10-10 3.2 3.2-10 10L4 20z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M14 4.9 16.2 2.7 19.4 5.9 17.2 8.1" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
    </svg>
  )
};

export default function TabBar({ me }) {
  const pathname = usePathname() || '/';
  const hide = pathname.startsWith('/p/');
  const [unread, setUnread] = useState({ dm: 0, mention: 0 });

  useEffect(() => {
    if (!me) {
      setUnread({ dm: 0, mention: 0 });
      return;
    }
    let alive = true;
    async function poll() {
      try {
        const [dmRes, mRes] = await Promise.all([
          fetch('/api/dm', { cache: 'no-store' }),
          fetch('/api/mentions', { cache: 'no-store' })
        ]);
        const dm = await dmRes.json().catch(() => ({}));
        const mo = await mRes.json().catch(() => ({}));
        if (!alive) return;
        setUnread({
          dm: (dm.conversations || []).reduce((s, c) => s + (c.unread || 0), 0),
          mention: mo.unread || 0
        });
      } catch {
        /* 忽略轮询失败 */
      }
    }
    poll();
    const t = setInterval(poll, 25000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [me, pathname]);

  const tabs = [
    { key: 'home', href: '/', label: '首页', icon: ICONS.home, active: pathname === '/' },
    {
      key: 'dm',
      href: '/messages',
      label: '消息',
      icon: ICONS.dm,
      active:
        pathname.startsWith('/messages') ||
        pathname.startsWith('/chat') ||
        pathname.startsWith('/friends'),
      badge: unread.dm + unread.mention
    },
    { key: 'ptt', href: '/ptt', label: '对讲机', icon: ICONS.ptt, active: pathname.startsWith('/ptt') },
    { key: 'me', href: '/me', label: '我的', icon: ICONS.me, active: pathname.startsWith('/me') }
  ];

  if (hide) return null;

  return (
    <nav className="tabbar-wrap" aria-label="底部导航">
      <div className="tabbar">
        {tabs.slice(0, 2).map((t) => (
          <TabLink key={t.key} {...t} />
        ))}

        <Link className={`tabbar-center ${pathname.startsWith('/compose') ? 'active' : ''}`} href={me ? '/compose' : '/login'} aria-label="发帖">
          <span className="tabbar-center-btn">{ICONS.compose}</span>
          <span className="tabbar-center-label">发帖</span>
        </Link>

        {tabs.slice(2).map((t) => (
          <TabLink key={t.key} {...t} />
        ))}
      </div>
    </nav>
  );
}

function TabLink({ href, label, icon, active, badge }) {
  return (
    <Link className={`tabbar-item ${active ? 'active' : ''}`} href={href}>
      <span className="tabbar-icon">
        {icon}
        {badge > 0 && <i className="tabbar-badge">{badge > 99 ? '99+' : badge}</i>}
      </span>
      <span className="tabbar-label">{label}</span>
    </Link>
  );
}
