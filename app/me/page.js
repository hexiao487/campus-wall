'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import Feed from '@/components/Feed';
import { initial, avatarStyle } from '@/lib/format';

const TABS = [
  { key: 'mine', label: '我的帖子' },
  { key: 'saved', label: '收藏' },
  { key: 'liked', label: '点赞' }
];

export default function MePage() {
  const [me, setMe] = useState(null);
  const [booted, setBooted] = useState(false);
  const [tab, setTab] = useState('mine');
  const [cache, setCache] = useState({ mine: null, saved: null, liked: null });
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState([]);
  const [likedIds, setLikedIds] = useState([]);
  const [score, setScore] = useState(null);
  const [checking, setChecking] = useState(false);
  const [checkMsg, setCheckMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        const user = (await res.json()).user || null;
        setMe(user);
        if (!user) return;
        load('mine');
        preload();
        loadScore();
      } catch {
        /* 忽略 */
      } finally {
        setBooted(true);
      }
    })();
  }, []);

  async function loadScore() {
    try {
      const res = await fetch('/api/points', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data.level) setScore(data);
    } catch {
      /* 忽略 */
    }
  }

  async function doCheckin() {
    if (checking || !score) return;
    setChecking(true);
    setCheckMsg('');
    try {
      const res = await fetch('/api/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'checkin' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '签到失败');
      setCheckMsg(data.already ? '今天已经签到过啦' : `签到成功 +${data.earned} 积分`);
      await loadScore();
    } catch (e) {
      setCheckMsg(e.message);
    } finally {
      setChecking(false);
    }
  }

  async function preload() {
    try {
      const [sv, lk] = await Promise.all([
        fetch('/api/saved', { cache: 'no-store' }),
        fetch('/api/me/posts?type=liked', { cache: 'no-store' })
      ]);
      const sd = await sv.json().catch(() => ({}));
      const ld = await lk.json().catch(() => ({}));
      setSavedIds(sd.ids || []);
      setLikedIds((ld.posts || []).map((p) => p.id));
      setCache((c) => ({
        mine: c.mine,
        saved: c.saved || sd.posts || [],
        liked: c.liked || ld.posts || []
      }));
    } catch {
      /* 忽略 */
    }
  }

  async function load(which) {
    setLoading(true);
    try {
      if (which === 'saved') {
        const sv = await fetch('/api/saved', { cache: 'no-store' });
        const data = await sv.json();
        setSavedIds(data.ids || []);
        setCache((c) => ({ ...c, saved: data.posts || [] }));
      } else {
        const res = await fetch(`/api/me/posts?type=${which}`, { cache: 'no-store' });
        const data = await res.json();
        const posts = data.posts || [];
        setCache((c) => ({ ...c, [which]: posts }));
        if (which === 'liked') setLikedIds(posts.map((p) => p.id));
      }
    } catch {
      /* 忽略 */
    } finally {
      setLoading(false);
    }
  }

  function switchTab(key) {
    setTab(key);
    if (!cache[key]) load(key);
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setMe(null);
    setCache({ mine: null, saved: null, liked: null });
  }

  const posts = cache[tab] || [];

  return (
    <>
      <SiteHeader me={me} onLogout={logout} />
      <main className="shell">
        {!me && booted && (
          <div className="card">
            <div className="empty">登录后才能看自己的页面</div>
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <Link className="btn btn-primary btn-mini" href="/login">去登录</Link>
            </div>
          </div>
        )}

        {me && (
          <>
            <div className="me-card">
              <Link className="me-avatar" href={`/u/${me.id}`} style={avatarStyle(me.username, me.avatar_url)}>
                {!me.avatar_url && initial(me.username)}
              </Link>
              <div className="me-info">
                <h1>
                  {me.username}
                  {me.role === 'admin' && <span className="badge-admin">管理员</span>}
                </h1>
                <p>{me.id ? '我的个人页面' : ''} <span className="ver-badge">V5.4beta</span></p>
                <Link className="me-hot" href="/hot">🔥 热榜 ›</Link>
                <div className="me-stats">
                  <span><b>{cache.mine ? cache.mine.length : '—'}</b> 帖子</span>
                  <span><b>{cache.saved ? cache.saved.length : '—'}</b> 收藏</span>
                  <span><b>{cache.liked ? cache.liked.length : '—'}</b> 点赞</span>
                </div>
              </div>
              <Link className="me-go" href={`/u/${me.id}`}>主页 ›</Link>
            </div>

            {score && (
              <div className="lv-card">
                <div className="lv-head">
                  <span className={`lv-orb lv-${score.level}`}>Lv{score.level}</span>
                  <div className="lv-main">
                    <div className="lv-name">
                      {score.name}
                      <span className="lv-points">{score.points} 积分</span>
                    </div>
                    <div className="lv-bar">
                      <i style={{ width: `${score.progress}%` }} />
                    </div>
                    <div className="lv-sub">
                      {score.next ? `再 ${score.need} 积分升到 Lv${score.level + 1}` : '已到最高等级'}
                    </div>
                  </div>
                  <button
                    className={`lv-check ${score.checkin?.todayDone ? 'done' : ''}`}
                    onClick={doCheckin}
                    disabled={checking || score.checkin?.todayDone}
                  >
                    {score.checkin?.todayDone ? '今日已签' : checking ? '签到中…' : '签到 +3'}
                  </button>
                </div>
                <div className="lv-foot">
                  <span>连续签到 <b>{score.checkin?.streak || 0}</b> 天</span>
                  <span>累计 <b>{score.checkin?.total || 0}</b> 次</span>
                  <span className="lv-rule">发帖 +5 · 评论 +2 · 获赞 +2 · 连签 7 天额外 +10</span>
                </div>
                {checkMsg && <div className="lv-msg">{checkMsg}</div>}
              </div>
            )}

            <div className="me-tabs">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  className={`me-tab ${tab === t.key ? 'on' : ''}`}
                  onClick={() => switchTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {loading && !posts.length ? (
              <div className="empty">加载中…</div>
            ) : posts.length === 0 ? (
              <div className="card">
                <div className="empty">
                  {tab === 'mine' && '还没发过帖子，去发一条吧。'}
                  {tab === 'saved' && '还没有收藏，点帖子上的 ☆ 试试。'}
                  {tab === 'liked' && '还没有点赞过，点 ♡ 试试。'}
                </div>
              </div>
            ) : (
              <Feed
                posts={posts}
                setPosts={(fn) =>
                  setCache((c) => {
                    const prev = c[tab] || [];
                    const next = typeof fn === 'function' ? fn(prev) : fn;
                    if (tab === 'saved') {
                      setSavedIds((ids) => ids.filter((id) => next.some((p) => p.id === id)));
                    }
                    return { ...c, [tab]: next };
                  })
                }
                me={me}
                likedIds={likedIds}
                setLikedIds={setLikedIds}
                savedIds={savedIds}
                setSavedIds={setSavedIds}
                onNotice={() => {}}
              />
            )}
          </>
        )}

        <div className="page-foot">
          <Link href="/">← 回首页</Link>
          <a className="header-link" href="/downloads/campus-wall-v3.apk" download style={{ marginLeft: 14 }}>
            下载 App
          </a>
        </div>
      </main>
    </>
  );
}
