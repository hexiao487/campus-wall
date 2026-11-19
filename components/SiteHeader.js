'use client';

import Link from 'next/link';
import { initial, avatarStyle } from '@/lib/format';

export default function SiteHeader({ me, onLogout }) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" href="/">
          <span className="brand-logo">墙</span>
          校园墙
          <span className="ver-badge">V1.3</span>
          <span className="brand-sub">说出你的想法</span>
        </Link>

        <div className="header-right">
          {me ? (
            <>
              <div className="user-chip">
                <span className="avatar" style={{ ...avatarStyle(me.username), width: 26, height: 26, borderRadius: 9, fontSize: 12 }}>
                  {initial(me.username)}
                </span>
                {me.username}
                {me.role === 'admin' && <span className="badge-admin">管理员</span>}
              </div>
              <button className="btn btn-ghost btn-mini" onClick={onLogout}>
                退出
              </button>
            </>
          ) : (
            <Link className="btn btn-primary btn-mini" href="/login">
              登录 / 注册
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
