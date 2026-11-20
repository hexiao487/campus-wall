'use client';

import { useState } from 'react';
import Link from 'next/link';
import { timeAgo, initial, avatarStyle } from '@/lib/format';

export default function PostCard({ post, liked, me, onLike, onDelete, onDeleteComment, onCommentAdded }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState(null);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');

  const isAdminAuthor = post.author_name === '管理员';
  const isAdmin = me?.role === 'admin';
  const canDeletePost = isAdmin || (Boolean(me?.id) && post.author_id === me.id);

  function canDeleteComment(c) {
    return isAdmin || (Boolean(me?.id) && c.author_id === me.id);
  }

  async function removeComment(c) {
    if (!window.confirm('确定删除这条评论吗？')) return;
    setErr('');
    const backup = comments || [];
    setComments((prev) => (prev || []).filter((x) => x.id !== c.id));
    try {
      const res = await fetch(`/api/posts/${post.id}/comments/${c.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '删除评论失败');
      onDeleteComment?.(post.id);
    } catch (e) {
      setComments(backup);
      setErr(e.message);
    }
  }

  async function toggleComments() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (comments) return;
    setLoading(true);
    setErr('');
    try {
      const res = await fetch(`/api/posts/${post.id}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) setComments(data.comments || []);
      else setErr(data.error || '评论加载失败');
    } catch {
      setErr('网络异常，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  async function submitComment(e) {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setErr('');
    try {
      const res = await fetch(`/api/posts/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '评论失败');
      setComments((prev) => [...(prev || []), data.comment]);
      setText('');
      onCommentAdded?.(post.id);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <article className="card post" id={`post-${post.id}`}>
      <div className="post-head">
        {post.author_id ? (
          <Link className="avatar avatar-link" href={`/u/${post.author_id}`} style={avatarStyle(post.author_name)} title="看主页">
            {initial(post.author_name)}
          </Link>
        ) : (
          <div className="avatar" style={avatarStyle(post.author_name)}>
            {initial(post.author_name)}
          </div>
        )}
        <div className="post-meta">
          <div className="post-author">
            {post.author_id ? (
              <Link className="author-link" href={`/u/${post.author_id}`}>{post.author_name}</Link>
            ) : (
              post.author_name
            )}{' '}
            {isAdminAuthor && <span className="badge-admin">官方</span>}
          </div>
          <div className="post-time">{timeAgo(post.created_at)}</div>
        </div>
      </div>

      {post.content && <p className="post-body">{post.content}</p>}
      {post.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="post-image" src={post.image_url} alt="帖子配图" loading="lazy" />
      )}

      <div className="post-actions">
        <button
          className={`act ${liked ? 'liked' : ''}`}
          onClick={() => onLike(post)}
          aria-label="点赞"
        >
          <span>{liked ? '♥' : '♡'}</span>
          <span>{post.like_count || 0}</span>
        </button>

        <button className="act" onClick={toggleComments}>
          <span>💬</span>
          <span>{post.comment_count || 0}</span>
        </button>

        {canDeletePost && (
          <button className="act act-danger" onClick={() => onDelete(post)}>
            {isAdmin ? '删帖' : '删除'}
          </button>
        )}
      </div>

      {open && (
        <div className="comments">
          {loading && <div className="post-time">评论加载中…</div>}
          {err && <div className="alert" style={{ marginBottom: 8 }}>{err}</div>}
          {!loading && comments && comments.length === 0 && (
            <div className="post-time">还没有人评论，来坐第一排 👀</div>
          )}
          {(comments || []).map((c) => (
            <div className="comment" key={c.id}>
              <span className="comment-author">{c.author_name}：</span>
              <span className="comment-text">{c.content}</span>
              {canDeleteComment(c) && (
                <button className="comment-del" onClick={() => removeComment(c)} title="删除这条评论">
                  删除
                </button>
              )}
            </div>
          ))}

          {me ? (
            <form className="comment-form" onSubmit={submitComment}>
              <input
                value={text}
                maxLength={300}
                onChange={(e) => setText(e.target.value)}
                placeholder={me.isMuted ? '你已被禁言，暂时不能评论' : '说点什么…'}
                disabled={me.isMuted || sending}
              />
              <button className="btn btn-primary btn-mini" disabled={sending || !text.trim()}>
                {sending ? '发送中' : '发送'}
              </button>
            </form>
          ) : (
            <div className="post-time" style={{ marginTop: 8 }}>
              登录后即可评论
            </div>
          )}
        </div>
      )}
    </article>
  );
}
