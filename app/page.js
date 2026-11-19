'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import Composer from '@/components/Composer';
import PostCard from '@/components/PostCard';

export default function HomePage() {
  const [me, setMe] = useState(null);
  const [posts, setPosts] = useState([]);
  const [liked, setLiked] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [notice, setNotice] = useState('');

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = await res.json();
      setMe(data.user || null);
    } catch {
      setMe(null);
    }
  }, []);

  const loadPosts = useCallback(async (nextCursor) => {
    try {
      const url = nextCursor ? `/api/posts?cursor=${encodeURIComponent(nextCursor)}` : '/api/posts';
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '加载失败');
      setPosts((prev) => (nextCursor ? [...prev, ...data.posts] : data.posts));
      setLiked((prev) => (nextCursor ? [...prev, ...(data.likedIds || [])] : data.likedIds || []));
      setCursor(data.nextCursor || null);
    } catch (e) {
      setNotice(e.message);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await loadMe();
      await loadPosts(null);
      setLoading(false);
    })();
  }, [loadMe, loadPosts]);

  async function handleLike(post) {
    if (!me) {
      window.location.href = '/login';
      return;
    }
    const wasLiked = liked.includes(post.id);
    // 乐观更新
    setLiked((prev) => (wasLiked ? prev.filter((id) => id !== post.id) : [...prev, post.id]));
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id ? { ...p, like_count: Math.max(0, (p.like_count || 0) + (wasLiked ? -1 : 1)) } : p
      )
    );

    try {
      const res = await fetch(`/api/posts/${post.id}/like`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '点赞失败');
      setLiked((prev) =>
        data.liked ? [...new Set([...prev, post.id])] : prev.filter((id) => id !== post.id)
      );
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, like_count: data.likeCount } : p))
      );
    } catch (e) {
      // 回滚
      setLiked((prev) => (wasLiked ? [...new Set([...prev, post.id])] : prev.filter((id) => id !== post.id)));
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? { ...p, like_count: Math.max(0, (p.like_count || 0) + (wasLiked ? 1 : -1)) }
            : p
        )
      );
      setNotice(e.message);
    }
  }

  async function handleDelete(post) {
    if (!window.confirm('确定删除这条帖子吗？删除后无法恢复。')) return;
    try {
      const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '删除失败');
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } catch (e) {
      setNotice(e.message);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setMe(null);
    setLiked([]);
    await loadPosts(null);
  }

  function handlePublished(post) {
    setPosts((prev) => [post, ...prev]);
  }

  function handleCommentAdded(postId) {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comment_count: (p.comment_count || 0) + 1 } : p))
    );
  }

  function handleCommentDeleted(postId) {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comment_count: Math.max(0, (p.comment_count || 0) - 1) } : p
      )
    );
  }

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    await loadPosts(cursor);
    setLoadingMore(false);
  }

  return (
    <>
      <SiteHeader me={me} onLogout={handleLogout} />

      <main className="shell">
        <div className="hero">
          <h1>
            校园<span>墙</span>
          </h1>
          <p>把想说的话贴上来，会有人看见的。</p>
        </div>

        {notice && (
          <div className="alert" onClick={() => setNotice('')} style={{ cursor: 'pointer' }}>
            {notice}（点击关闭）
          </div>
        )}

        <Composer me={me} onPublished={handlePublished} />

        {me?.role === 'admin' && (
          <div className="notice">
            你正以管理员身份浏览，可以发帖、评论，也可以删除任意帖子和评论；用户禁言请前往{' '}
            <Link href="/admin" style={{ color: 'var(--blue)', fontWeight: 600 }}>
              管理后台
            </Link>
            。
          </div>
        )}

        {loading ? (
          <div className="empty">正在加载墙上的内容…</div>
        ) : posts.length === 0 ? (
          <div className="empty">墙上还空空的，来做第一个留言的人吧 ✨</div>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              liked={liked.includes(post.id)}
              me={me}
              onLike={handleLike}
              onDelete={handleDelete}
              onDeleteComment={handleCommentDeleted}
              onCommentAdded={handleCommentAdded}
            />
          ))
        )}

        {cursor && (
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <button className="btn btn-ghost" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? '加载中…' : '加载更多'}
            </button>
          </div>
        )}

        {!me && (
          <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--ink-soft)' }}>
            <Link href="/admin">管理员入口</Link>
          </div>
        )}
      </main>
    </>
  );
}
