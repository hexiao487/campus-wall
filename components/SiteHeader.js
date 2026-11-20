'use client';

import Link from 'next/link';
import TabBar from '@/components/TabBar';
import AccountMenu from '@/components/AccountMenu';

export default function SiteHeader({ me, onLogout }) {
  return (
    <>
      <header className="site-header">
        <div className="header-inner header-min">
          {!me && (
            <Link className="btn btn-primary btn-mini" href="/login">
              登录 / 注册
            </Link>
          )}
          <div className="header-left">
            <AccountMenu me={me} onLogout={onLogout} />
          </div>
          <div className="header-right">
            <Link className="search-fab" href="/search" aria-label="搜索">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" strokeWidth="1.9" />
                <path d="M15 15 20 20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
              </svg>
            </Link>
          </div>
        </div>
      </header>
      <TabBar me={me} />
    </>
  );
}
