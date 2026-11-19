'use client';

import { useRef, useState } from 'react';

export default function Composer({ me, onPublished }) {
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef(null);

  const max = 1000;
  const muted = me?.role === 'user' && me?.isMuted;

  async function pickImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr('');
    if (file.size > 4 * 1024 * 1024) {
      setErr('图片不能超过 4MB，先压缩一下吧');
      e.target.value = '';
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '上传失败');
      setImageUrl(data.url);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function publish() {
    if (sending || uploading) return;
    if (!content.trim() && !imageUrl) {
      setErr('说点什么再发吧');
      return;
    }
    setSending(true);
    setErr('');
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), imageUrl: imageUrl || null })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '发布失败');
      setContent('');
      setImageUrl('');
      onPublished?.(data.post);
    } catch (e3) {
      setErr(e3.message);
    } finally {
      setSending(false);
    }
  }

  if (!me) {
    return (
      <div className="card composer">
        <div className="notice" style={{ marginBottom: 0 }}>
          登录后就能在墙上发帖、点赞和评论啦。
        </div>
        <div className="composer-bar">
          <a className="btn btn-primary" href="/login">
            去登录 / 注册
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="card composer">
      {muted && (
        <div className="alert">你已被管理员禁言，暂时不能发帖和评论。</div>
      )}
      {err && <div className="alert">{err}</div>}

      <textarea
        value={content}
        maxLength={max}
        onChange={(e) => setContent(e.target.value)}
        placeholder={muted ? '账号已被禁言' : '今天有什么想说的？匿名也可以哦～'}
        disabled={muted}
      />

      {imageUrl && (
        <div style={{ position: 'relative', marginTop: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="预览"
            style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 12 }}
          />
          <button
            className="btn btn-ghost btn-mini"
            style={{ position: 'absolute', top: 8, right: 8 }}
            onClick={() => setImageUrl('')}
          >
            移除
          </button>
        </div>
      )}

      <div className="composer-bar">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={pickImage}
          style={{ display: 'none' }}
        />
        <button
          className="btn btn-ghost btn-mini"
          onClick={() => fileRef.current?.click()}
          disabled={muted || uploading}
        >
          {uploading ? '上传中…' : '📷 配图'}
        </button>

        <span className={`char-count ${content.length > max - 50 ? 'warn' : ''}`}>
          {content.length}/{max}
        </span>

        <button
          className="btn btn-primary"
          onClick={publish}
          disabled={muted || sending || uploading || (!content.trim() && !imageUrl)}
        >
          {sending ? '发布中…' : '发布'}
        </button>
      </div>
    </div>
  );
}
