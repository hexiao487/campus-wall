'use client';

import Link from 'next/link';
import { initial, avatarStyle } from '@/lib/format';
import PostFab from '@/components/PostFab';

export default function SiteHeader({ me, onLogout }) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" href="/">
          <span className="brand-logo">墙</span>
          校园墙
          <span className="ver-badge">V2.1</span>
          <span className="brand-sub">说出你的想法</span>
        </Link>

        <div className="header-right">
          <a className="header-link" href="/downloads/campus-wall-v1.5.apk" download>
            下载 App
          </a>
          <Link className="header-link" href="/chat">
            群聊
          </Link>
          <Link className="header-link" href="/friends">
            好友
          </Link>
          <Link className="header-link" href="/messages">
            私信
          </Link>
          <Link className="header-link" href="/ptt">
            对讲机
          </Link>
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
      <PostFab me={me} />
    </header>
  );
}
