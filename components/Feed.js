'use client';

import { useState } from 'react';
import PostCard from '@/components/PostCard';

/** 帖子流：统一处理点赞 / 收藏 / 举报 / 置顶 / 删除 */
export default function Feed({
  posts,
  setPosts,
  me,
  likedIds = [],
  setLikedIds,
  savedIds = [],
  setSavedIds,
  pinnedIds = [],
  setPinned,
  onNotice
  }) {
  const [notice, setNotice] = useState('');
  const say = (msg) => {
    setNotice(msg);
    onNotice?.(msg);
  };

  async function like(post) {
    if (!me) {
      window.location.href = '/login';
      return;
    }
    try {
      const res = await fetch(`/api/posts/${post.id}/like`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '点赞失败');
      setLikedIds?.((prev) => (data.liked ? [...prev, post.id] : prev.filter((x) => x !== post.id)));
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, like_count: Math.max(0, (p.like_count || 0) + (data.liked ? 1 : -1)) } : p))
      );
    } catch (e) {
      say(e.message);
    }
  }

  async function save(post) {
    if (!me) {
      window.location.href = '/login';
      return;
    }
    try {
      const res = await fetch('/api/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '收藏失败');
      setSavedIds?.((prev) => data.ids || []);
    } catch (e) {
      say(e.message);
    }
  }

  async function report(post) {
    if (!me) {
      window.location.href = '/login';
      return;
    }
    const reason = window.prompt('举报理由（可留空）', '');
    if (reason === null) return;
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, reason })
      });
      if (!res.ok) throw new Error((await res.json()).error || '举报失败');
      say('已提交举报');
    } catch (e) {
      say(e.message);
    }
  }

  async function pin(post) {
    try {
      const res = await fetch('/api/pinned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '置顶失败');
      const next = await fetch('/api/pinned', { cache: 'no-store' }).then((r) => r.json());
      setPinned?.((prev) => next.ids || prev);
      say(data.pinned ? '已置顶' : '已取消置顶');
    } catch (e) {
      say(e.message);
    }
  }

  async function remove(post) {
    if (!window.confirm('确定删除这条帖子吗？')) return;
    try {
      const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || '删除失败');
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } catch (e) {
      say(e.message);
    }
  }

  return (
    <>
      {notice && (
        <div className="alert" onClick={() => setNotice('')} style={{ cursor: 'pointer', fontSize: 13 }}>
          {notice}
        </div>
      )}
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          liked={likedIds.includes(post.id)}
          saved={savedIds.includes(post.id)}
          pinned={(pinnedIds || []).includes(post.id)}
          me={me}
          onLike={like}
          onToggleSave={save}
          onReport={report}
          onTogglePin={pin}
          onDelete={remove}
          onDeleteComment={(id) =>
            setPosts((prev) =>
              prev.map((p) => (p.id === id ? { ...p, comment_count: Math.max(0, (p.comment_count || 0) - 1) } : p))
            )
          }
          onCommentAdded={(id) =>
            setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, comment_count: (p.comment_count || 0) + 1 } : p)))
          }
        />
      ))}
      {posts.length === 0 && <div className="empty">这里还空空的～</div>}
    </>
  );
}
