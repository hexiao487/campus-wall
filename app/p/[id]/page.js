'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import { imgSrc } from '@/lib/img';
import { parseImages } from '@/lib/images';
import { isVideo, mediaSrc, posterSrc, videoMime } from '@/lib/media';
import { timeAgo, initial, avatarStyle } from '@/lib/format';

export default function PostDetailPage() {
  const params = useParams();
  const id = params?.id;
  const [me, setMe] = useState(null);
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [viewer, setViewer] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/auth/me', { cache: 'no-store' });
        const u = (await r.json()).user || null;
        setMe(u);
      } catch {
        /* 忽略 */
      }
      try {
        const res = await fetch(`/api/posts/${id}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '帖子加载失败');
        setPost({ ...data.post, comment_count: (data.comments || []).length });
        setComments(data.comments || []);
        setLiked(Boolean(data.liked));
        setSaved(Boolean(data.saved));
      } catch (e) {
        setNotice(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function toggleLike() {
    if (!me) return (window.location.href = '/login');
    try {
      const res = await fetch(`/api/posts/${id}/like`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '点赞失败');
      setLiked(Boolean(data.liked));
      setPost((p) => ({ ...p, like_count: Math.max(0, (p.like_count || 0) + (data.liked ? 1 : -1)) }));
    } catch (e) {
      setNotice(e.message);
    }
  }

  async function toggleSave() {
    if (!me) return (window.location.href = '/login');
    try {
      const res = await fetch('/api/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '收藏失败');
      setSaved(Boolean(data.saved));
    } catch (e) {
      setNotice(e.message);
    }
  }

  async function submitComment(e) {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    if (!me) return (window.location.href = '/login');
    setSending(true);
    setNotice('');
    try {
      const res = await fetch(`/api/posts/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '评论失败');
      setComments((prev) => [...prev, data.comment]);
      setPost((p) => ({ ...p, comment_count: (p.comment_count || 0) + 1 }));
      setText('');
    } catch (e2) {
      setNotice(e2.message);
    } finally {
      setSending(false);
    }
  }

  async function removeComment(c) {
    if (!window.confirm('删除这条评论？')) return;
    try {
      const res = await fetch(`/api/posts/${id}/comments/${c.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || '删除失败');
      }
      setComments((prev) => prev.filter((x) => x.id !== c.id));
      setPost((p) => ({ ...p, comment_count: Math.max(0, (p.comment_count || 1) - 1) }));
    } catch (e) {
      setNotice(e.message);
    }
  }

  async function removePost() {
    if (!window.confirm('确定删除这条帖子吗？')) return;
    try {
      const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '删除失败');
      window.location.href = '/';
    } catch (e) {
      setNotice(e.message);
    }
  }

  const images = post ? parseImages(post.image_url) : [];
  const video = images.find(isVideo);
  const isAdminAuthor = post && (post.author_role === 'admin' || !post.author_id);
  const showBadge = isAdminAuthor && post.author_name !== '管理员';
  const canDelete = post && (me?.role === 'admin' || (me?.id && post.author_id === me.id));

  return (
    <>
      <SiteHeader me={me} onLogout={async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
      }} />

      <main className="shell">
        <div className="detail-top">
          <Link href="/" className="detail-back">‹ 返回</Link>
          <span className="detail-top-title">帖子</span>
        </div>

        {loading && <div className="empty">加载中…</div>}
        {notice && <div className="alert">{notice}</div>}

        {post && (
          <>
            <div className="detail-author">
              {post.author_id ? (
                <Link className="avatar avatar-link" href={`/u/${post.author_id}`} style={avatarStyle(post.author_name, post.author_avatar)}>
                  {!post.author_avatar && initial(post.author_name)}
                </Link>
              ) : (
                <div className="avatar" style={avatarStyle(post.author_name)}>{initial(post.author_name)}</div>
              )}
              <div className="detail-author-meta">
                <b>
                  {post.author_name}
                  {showBadge && <span className="badge-admin">管理员</span>}
                </b>
                <span>{timeAgo(post.created_at)}</span>
              </div>
              {canDelete && <button className="detail-del" onClick={removePost}>删除</button>}
            </div>

            {video && (
              <div className="detail-gallery">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  className="detail-cover detail-video"
                  controls
                  autoPlay
                  muted
                  playsInline
                  preload="metadata"
                  poster={posterSrc(video) || undefined}
                >
                  <source src={mediaSrc(video)} type={videoMime(mediaSrc(video))} />
                </video>
                <a className="detail-video-open" href={mediaSrc(video)} target="_blank" rel="noreferrer">
                  打不开？点这里直接播放
                </a>
              </div>
            )}

            {!video && images.length > 0 && (
              <div className="detail-gallery">
                <img className="detail-cover" src={imgSrc(images[viewer] || images[0])} alt="帖子配图" />
                {images.length > 1 && (
                  <div className="detail-thumbs">
                    {images.map((u, i) => (
                      <button
                        key={u + i}
                        className={`detail-thumb ${viewer === i ? 'on' : ''}`}
                        onClick={() => setViewer(i)}
                      >
                        <img src={imgSrc(u)} alt={`配图 ${i + 1}`} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {post.content && <p className="detail-body">{post.content}</p>}

            <div className="detail-actions">
              <button className={`detail-act ${liked ? 'on' : ''}`} onClick={toggleLike}>
                {liked ? '♥' : '♡'} {post.like_count || 0}
              </button>
              <button className={`detail-act ${saved ? 'on' : ''}`} onClick={toggleSave}>
                {saved ? '★ 已收藏' : '☆ 收藏'}
              </button>
              <button className="detail-act" onClick={() => document.getElementById('comment-input')?.focus()}>
                💬 {post.comment_count || 0}
              </button>
            </div>

            <section className="detail-comments">
              <div className="detail-comments-title">共 {comments.length} 条评论</div>
              {comments.length === 0 && <div className="post-time">还没有评论，来做第一个评论的人。</div>}
              {comments.map((c) => (
                <div className="comment-row" key={c.id}>
                  <span className="avatar mini" style={avatarStyle(c.author_name)}>{initial(c.author_name)}</span>
                  <div className="comment-main">
                    <div className="comment-name">{c.author_name}<span className="comment-time">{timeAgo(c.created_at)}</span></div>
                    <div className="comment-body">{c.content}</div>
                    {(me?.role === 'admin' || (me?.id && c.author_id === me.id)) && (
                      <button className="comment-del" onClick={() => removeComment(c)}>删除</button>
                    )}
                  </div>
                </div>
              ))}
            </section>

            <form className="detail-compose" onSubmit={submitComment}>
              <input
                id="comment-input"
                value={text}
                maxLength={300}
                onChange={(e) => setText(e.target.value)}
                placeholder={me ? (me.isMuted ? '你已被禁言' : '说点什么…') : '登录后可以评论'}
                disabled={!me || me.isMuted || sending}
              />
              <button className="glass-btn" disabled={!me || sending || !text.trim()}>发送</button>
            </form>
          </>
        )}

        <div className="page-foot"><Link href="/">← 回首页</Link></div>
      </main>
    </>
  );
}
