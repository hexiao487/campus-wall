'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import Composer from '@/components/Composer';

export default function ComposePage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [ready, setReady] = useState(false);

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = await res.json();
      setMe(data.user || null);
    } catch {
      setMe(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setMe(null);
    router.replace('/login');
  }

  return (
    <>
      <SiteHeader me={me} onLogout={handleLogout} />
      <main className="shell compose-shell">
        <div className="compose-head">
          <h1>发帖</h1>
          <p>用 @ 提醒某个同学，TA 会在「消息」里看到。</p>
        </div>

        {ready ? (
          <Composer
            me={me}
            onPublished={(post) => {
              router.push('/');
              router.refresh?.();
              if (post?.id) window.location.hash = `post-${post.id}`;
            }}
          />
        ) : (
          <div className="card"><div className="empty">加载中…</div></div>
        )}
      </main>
    </>
  );
}
