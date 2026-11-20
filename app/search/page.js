'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import Feed from '@/components/Feed';
import { avatarStyle, initial } from '@/lib/format';

function SearchInner() {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [me, setMe] = useState(null);
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [savedIds, setSavedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async (kw) => {
    const term = String(kw || '').trim();
    if (!term) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { cache: 'no-store' });
      const data = await res.json();
      setPosts(data.posts || []);
      setUsers(data.users || []);
    } catch {
      setPosts([]);
      setUsers([]);
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
    })();
    const initialQ = params.get('q') || '';
    if (initialQ) search(initialQ);
  }, [params, search]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setMe(null);
  }

  return (
    <>
      <SiteHeader me={me} onLogout={logout} />
      <main className="shell">
        <div className="page-head">
          <h1>搜索</h1>
          <p>输入关键词，同时搜帖子和同学。</p>
        </div>

        <form
          className="search-form"
          onSubmit={(e) => {
            e.preventDefault();
            search(q);
          }}
        >
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="试试「银杏」「#实习」「hx」" />
          <button className="btn btn-primary btn-mini" disabled={loading}>
            {loading ? '搜索中' : '搜索'}
          </button>
        </form>

        {searched && !loading && (
          <div className="search-result-note">
            找到 {users.length} 位同学、{posts.length} 条帖子
          </div>
        )}

        {users.length > 0 && (
          <div className="card users-hit">
            {users.map((u) => (
              <Link className="row" href={`/u/${u.id}`} key={u.id}>
                <span className="avatar" style={{ ...avatarStyle(u.username), width: 36, height: 36, borderRadius: 12 }}>
                  {initial(u.username)}
                </span>
                <div className="row-main">
                  <div className="row-title">
                    {u.username}
                    {u.role === 'admin' && <span className="badge-admin">管理员</span>}
                  </div>
                  <div className="row-sub">看主页 / 加好友</div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {searched && !loading && (
          <Feed
            posts={posts}
            setPosts={setPosts}
            me={me}
            savedIds={savedIds}
            setSavedIds={setSavedIds}
            onNotice={() => {}}
          />
        )}

        {!searched && <div className="empty">输入关键词开始搜索～</div>}

        <div className="page-foot">
          <Link href="/">← 回首页</Link>
        </div>
      </main>
    </>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<><SiteHeader me={null} /><main className="shell"><div className="empty">加载中…</div></main></>}>
      <SearchInner />
    </Suspense>
  );
}
