'use client';

import { imgSrc } from '@/lib/img';
import { parseImages } from '@/lib/images';

import Link from 'next/link';
import { timeAgo, initial, avatarStyle } from '@/lib/format';

export default function PostCard({
  post,
  liked,
  me,
  saved = false,
  pinned = false,
  onLike,
  onDelete,
  onToggleSave,
  onTogglePin,
  onReport
}) {
  const images = parseImages(post.image_url);
  const isAdminAuthor = post.author_role === 'admin' || !post.author_id;
  const showAuthorBadge = isAdminAuthor && post.author_name !== '管理员';
  const isAdmin = me?.role === 'admin';
  const canDeletePost = isAdmin || (Boolean(me?.id) && post.author_id === me.id);
  const href = `/p/${post.id}`;

  return (
    <article className="card post" id={`post-${post.id}`}>
      <div className="post-head">
        {post.author_id ? (
          <Link
            className="avatar avatar-link"
            href={`/u/${post.author_id}`}
            style={avatarStyle(post.author_name, post.author_avatar)}
            title="看主页"
          >
            {!post.author_avatar && initial(post.author_name)}
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
            {showAuthorBadge && <span className="badge-admin">管理员</span>}
          </div>
          <div className="post-time">{timeAgo(post.created_at)}</div>
        </div>
      </div>

      <Link className="post-open" href={href}>
        {post.content && <p className="post-body">{post.content}</p>}
        {images.length > 0 && (
          <div className={`post-images grid-${Math.min(images.length, 3)}`}>
            {images.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url + i}
                className="post-image"
                src={imgSrc(url)}
                alt={`帖子配图 ${i + 1}`}
                loading="lazy"
              />
            ))}
          </div>
        )}
      </Link>

      <div className="post-actions">
        <button
          className={`act ${liked ? 'liked' : ''}`}
          onClick={() => onLike(post)}
          aria-label="点赞"
        >
          <span>{liked ? '♥' : '♡'}</span>
          <span>{post.like_count || 0}</span>
        </button>

        <Link className="act" href={href} aria-label="看评论">
          <span>💬</span>
          <span>{post.comment_count || 0}</span>
        </Link>

        <button className={`act ${saved ? 'saved' : ''}`} onClick={() => onToggleSave?.(post)} aria-label="收藏">
          <span>{saved ? '★' : '☆'}</span>
          <span>{saved ? '已收藏' : '收藏'}</span>
        </button>

        <button className="act" onClick={() => onReport?.(post)} aria-label="举报">
          <span>⚑</span>
          <span>举报</span>
        </button>

        {isAdmin && (
          <button className={`act ${pinned ? 'pinned' : ''}`} onClick={() => onTogglePin?.(post)}>
            {pinned ? '取消置顶' : '置顶'}
          </button>
        )}

        {canDeletePost && (
          <button className="act act-danger" onClick={() => onDelete(post)}>
            {isAdmin ? '删帖' : '删除'}
          </button>
        )}
      </div>
    </article>
  );
}
