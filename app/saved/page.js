'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import Feed from '@/components/Feed';

export default function SavedPage() {
  const [me, setMe] = useState(null);
  const [posts, setPosts] = useState([]);
  const [savedIds, setSavedIds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        const user = (await res.json()).user || null;
        setMe(user);
        if (!user) {
          setLoading(false);
          return;
        }
        const sv = await fetch('/api/saved', { cache: 'no-store' });
        const data = await sv.json();
        setPosts(data.posts || []);
        setSavedIds(data.ids || []);
      } catch {
        /* 忽略 */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setMe(null);
    setPosts([]);
  }

  return (
    <>
      <SiteHeader me={me} onLogout={logout} />
      <main className="shell">
        <div className="page-head">
          <h1>我的收藏</h1>
          <p>点帖子上的 ☆ 就能收藏，收藏只存在你自己的账号里。</p>
        </div>

        {!me && !loading && (
          <div className="card">
            <div className="empty">登录后才能看收藏</div>
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <Link className="btn btn-primary btn-mini" href="/login">去登录</Link>
            </div>
          </div>
        )}

        {me && (loading ? <div className="empty">加载中…</div> : (
          <Feed
            posts={posts}
            setPosts={(fn) => {
              setPosts((prev) => {
                const next = typeof fn === 'function' ? fn(prev) : fn;
                setSavedIds((ids) => ids.filter((id) => next.some((p) => p.id === id)));
                return next;
              });
            }}
            me={me}
            savedIds={savedIds}
            setSavedIds={setSavedIds}
            onNotice={() => {}}
          />
        ))}

        <div className="page-foot">
          <Link href="/">← 回首页</Link>
        </div>
      </main>
    </>
  );
}
