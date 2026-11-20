'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import Feed from '@/components/Feed';

export default function TagPage() {
  const params = useParams();
  const tag = decodeURIComponent(String(params?.tag || ''));
  const [me, setMe] = useState(null);
  const [posts, setPosts] = useState([]);
  const [savedIds, setSavedIds] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (t) => {
    if (!t) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent('#' + t)}`, { cache: 'no-store' });
      const data = await res.json();
      setPosts(data.posts || []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        setMe((await res.json()).user || null);
        const sv = await fetch('/api/saved', { cache: 'no-store' });
        if (sv.ok) setSavedIds((await sv.json()).ids || []);
      } catch {
        /* 忽略 */
      }
      load(tag);
    })();
  }, [tag, load]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setMe(null);
  }

  return (
    <>
      <SiteHeader me={me} onLogout={logout} />
      <main className="shell">
        <div className="page-head">
          <h1>#{tag}</h1>
          <p>带这个话题的帖子，共 {posts.length} 条。</p>
        </div>

        {loading ? (
          <div className="empty">加载中…</div>
        ) : (
          <Feed
            posts={posts}
            setPosts={setPosts}
            me={me}
            savedIds={savedIds}
            setSavedIds={setSavedIds}
            onNotice={() => {}}
          />
        )}

        <div className="page-foot">
          <Link href="/">← 回首页</Link>
        </div>
      </main>
    </>
  );
}
