'use client';

import Link from 'next/link';

/** 右上角固定的「发帖」入口：点一下回到首页输入框并聚焦 */
export default function PostFab({ me }) {
  return (
    <Link className="post-fab" href={me ? '/?compose=1' : '/login'} aria-label="发帖">
      <span className="post-fab-icon" aria-hidden="true">
        ✎
      </span>
      发帖
    </Link>
  );
}
