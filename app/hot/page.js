'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import Feed from '@/components/Feed';

const RANGES = [
  { key: 'day', label: '今日' },
  { key: 'week', label: '本周' },
  { key: 'all', label: '总榜' }
];

export default function HotPage() {
  const [me, setMe] = useState(null);
  const [range, setRange] = useState('day');
  const [posts, setPosts] = useState([]);
  const [savedIds, setSavedIds] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (r) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hot?range=${r}`, { cache: 'no-store' });
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
        const data = await res.json();
        setMe(data.user || null);
        const sv = await fetch('/api/saved', { cache: 'no-store' });
        if (sv.ok) setSavedIds((await sv.json()).ids || []);
      } catch {
        /* 忽略 */
      }
    })();
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setMe(null);
  }

  return (
    <>
      <SiteHeader me={me} onLogout={logout} />
      <main className="shell">
        <div className="page-head">
          <h1>热榜</h1>
          <p>按点赞数排序，看看大家都在顶什么。</p>
        </div>

        <div className="seg">
          {RANGES.map((r) => (
            <button key={r.key} className={range === r.key ? 'active' : ''} onClick={() => setRange(r.key)}>
              {r.label}
            </button>
          ))}
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
