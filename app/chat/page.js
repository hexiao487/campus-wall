'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';

export default function ChatHubPage() {
  const [me, setMe] = useState(null);
  const [mine, setMine] = useState([]);
  const [others, setOthers] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [err, setErr] = useState('');

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = await res.json();
      setMe(data.user || null);
    } catch {
      setMe(null);
    }
  }, []);

  const loadGroups = useCallback(async () => {
    try {
      const res = await fetch('/api/groups', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '加载失败');
      setMine(data.mine || []);
      setOthers(data.others || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await loadMe();
      await loadGroups();
    })();
  }, [loadMe, loadGroups]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setMe(null);
    setMine([]);
    setOthers([]);
  }

  async function createGroup(e) {
    e.preventDefault();
    if (creating) return;
    setErr('');
    setCreating(true);
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '创建失败');
      setName('');
      await loadGroups();
      window.location.href = `/chat/${data.group.id}`;
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setCreating(false);
    }
  }

  async function join(group) {
    if (busyId) return;
    setErr('');
    setBusyId(group.id);
    try {
      const res = await fetch(`/api/groups/${group.id}/join`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '申请失败');
      setOthers((prev) =>
        prev.map((g) => (g.id === group.id ? { ...g, request_status: 'pending' } : g))
      );
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusyId('');
    }
  }

  return (
    <>
      <SiteHeader me={me} onLogout={handleLogout} />

      <main className="shell">
        <div className="hero">
          <h1>
            群<span>聊</span>
          </h1>
          <p>自己开群、申请进群，群主同意后才能一起聊。</p>
        </div>

        {err && (
          <div className="alert" onClick={() => setErr('')} style={{ cursor: 'pointer' }}>
            {err}（点击关闭）
          </div>
        )}

        {!me ? (
          <div className="card composer">
            <div className="notice" style={{ marginBottom: 0 }}>
              登录后才能创建群聊、申请加入和发言。
            </div>
            <div className="composer-bar">
              <Link className="btn btn-primary" href="/login">
                登录 / 注册
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="card group-create">
              <div className="group-section-title">创建群聊</div>
              <form className="group-create-form" onSubmit={createGroup}>
                <input
                  value={name}
                  maxLength={24}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="给群起个名字，比如「高二（3）班」"
                />
                <button className="btn btn-primary btn-mini" disabled={creating || !name.trim()}>
                  {creating ? '创建中…' : '创建'}
                </button>
              </form>
            </div>

            <div className="group-section-title" style={{ margin: '22px 0 10px' }}>
              我的群聊
            </div>
            {loading ? (
              <div className="empty">正在加载…</div>
            ) : mine.length === 0 ? (
              <div className="empty">还没加入任何群，先创建一个或者申请一个吧 ✨</div>
            ) : (
              mine.map((g) => (
                <Link className="card group-row" href={`/chat/${g.id}`} key={g.id}>
                  <div className="group-avatar">{g.name.slice(0, 1)}</div>
                  <div className="group-info">
                    <div className="group-name">
                      {g.name}
                      {g.is_owner && <span className="badge-admin">群主</span>}
                    </div>
                    <div className="group-sub">
                      群主 {g.owner_name} · {g.member_count} 人
                    </div>
                  </div>
                  <span className="group-enter">进入</span>
                </Link>
              ))
            )}

            <div className="group-section-title" style={{ margin: '22px 0 10px' }}>
              发现群聊
            </div>
            {loading ? null : others.length === 0 ? (
              <div className="empty">暂时没有别的群，你可以自己开一个。</div>
            ) : (
              others.map((g) => (
                <div className="card group-row" key={g.id}>
                  <div className="group-avatar">{g.name.slice(0, 1)}</div>
                  <div className="group-info">
                    <div className="group-name">{g.name}</div>
                    <div className="group-sub">
                      群主 {g.owner_name} · {g.member_count} 人
                    </div>
                  </div>
                  {g.request_status === 'pending' ? (
                    <span className="group-pending">等待群主同意</span>
                  ) : (
                    <button
                      className="btn btn-ghost btn-mini"
                      disabled={busyId === g.id}
                      onClick={() => join(g)}
                    >
                      {g.request_status === 'rejected' ? '重新申请' : '申请加入'}
                    </button>
                  )}
                </div>
              ))
            )}
          </>
        )}
      </main>
    </>
  );
}
