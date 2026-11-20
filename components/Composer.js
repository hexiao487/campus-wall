'use client';

import { imgSrc } from '@/lib/img';

import { useEffect, useRef, useState } from 'react';
import { compressImage } from '@/lib/imageCompress';
import { joinImages } from '@/lib/images';

export default function Composer({
  initialText = '', me, onPublished }) {
  const [content, setContent] = useState(initialText || '');
  const [imageList, setImageList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [mentionAnchor, setMentionAnchor] = useState(-1);
  const [suggestions, setSuggestions] = useState([]);
  const [mentionIds, setMentionIds] = useState([]);
  const fileRef = useRef(null);
  const textRef = useRef(null);
  const timerRef = useRef(null);

  const max = 1000;
  const muted = me?.role === 'user' && me?.isMuted;

  useEffect(() => {
    textRef.current?.focus();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function handleChange(e) {
    const value = e.target.value;
    setContent(value);

    const caret = e.target.selectionStart || 0;
    const before = value.slice(0, caret);
    const at = before.lastIndexOf('@');
    if (at >= 0) {
      const frag = before.slice(at + 1);
      if (!/\s/.test(frag) && !frag.includes('@')) {
        setMentionAnchor(at);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(async () => {
          try {
            const res = await fetch(`/api/users/search?q=${encodeURIComponent(frag)}`, { cache: 'no-store' });
            const data = await res.json();
            setSuggestions((data.users || []).filter((u) => u.id !== me?.id).slice(0, 5));
          } catch {
            setSuggestions([]);
          }
        }, 220);
        return;
      }
    }
    setMentionAnchor(-1);
    setSuggestions([]);
  }

  function pickMention(user) {
    if (mentionAnchor < 0) return;
    const before = content.slice(0, mentionAnchor);
    const after = content.slice(mentionAnchor).replace(/^@[^\s@]*/, '');
    setContent(`${before}@${user.username} ${after}`.slice(0, max));
    setMentionIds((prev) => (prev.some((m) => m.id === user.id) ? prev : [...prev, { id: user.id, username: user.username }]));
    setMentionAnchor(-1);
    setSuggestions([]);
    setTimeout(() => textRef.current?.focus(), 30);
  }

  async function pickImage(e) {
    const files = Array.from(e.target.files || []).slice(0, Math.max(0, 4 - imageList.length));
    if (!files.length) return;
    setErr('');
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        if (file.size > 24 * 1024 * 1024) {
          setErr('有图片超过 24MB，已跳过');
          continue;
        }
        const prepared = await compressImage(file);
        const fd = new FormData();
        fd.append('file', prepared);
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '上传失败');
        uploaded.push(data.url);
      }
      setImageList((prev) => [...prev, ...uploaded].slice(0, 4));
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function publish() {
    if (sending || uploading) return;
    if (!content.trim() && imageList.length === 0) {
      setErr('说点什么再发吧');
      return;
    }
    setSending(true);
    setErr('');
    try {
      const active = mentionIds.filter((m) => content.includes(`@${m.username}`));
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), imageUrl: joinImages(imageList), mentions: active })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '发布失败');
      setContent('');
      setImageList([]);
      setMentionIds([]);
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
      {muted && <div className="alert">你已被管理员禁言，暂时不能发帖和评论。</div>}
      {err && <div className="alert">{err}</div>}

      <div className="composer-field">
        <textarea
          ref={textRef}
          value={content}
          maxLength={max}
          onChange={handleChange}
          placeholder={muted ? '账号已被禁言' : '今天有什么想说的？用 @ 可以提醒某个同学'}
          disabled={muted}
        />

        {suggestions.length > 0 && mentionAnchor >= 0 && (
          <div className="mention-pop">
            {suggestions.map((u) => (
              <button key={u.id} type="button" className="mention-item" onClick={() => pickMention(u)}>
                <span className="mention-avatar">{u.username.slice(0, 1)}</span>
                {u.username}
                {u.role === 'admin' && <span className="badge-admin">管理员</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {mentionIds.length > 0 && (
        <div className="mention-chips">
          <span className="mention-chips-label">将提醒</span>
          {mentionIds.map((m) => (
            <span key={m.id} className="mention-chip">
              @{m.username}
              <button
                type="button"
                onClick={() => {
                  setMentionIds((prev) => prev.filter((x) => x.id !== m.id));
                  setContent((prev) => prev.split(`@${m.username}`).join(''));
                }}
                aria-label="移除"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {imageList.length > 0 && (
        <div className="composer-images">
          {imageList.map((url, i) => (
            <div className="composer-image" key={url + i}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgSrc(url)} alt={`配图 ${i + 1}`} />
              <button
                type="button"
                className="composer-image-remove"
                onClick={() => setImageList((prev) => prev.filter((x) => x !== url))}
              >
                移除
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="composer-bar">
        <button type="button" className="btn btn-ghost btn-mini" onClick={() => fileRef.current?.click()} disabled={uploading || muted}>
          {uploading ? '上传中…' : `📷 配图 ${imageList.length}/4`}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={pickImage} hidden />
        <span className="composer-count">
          {content.length}/{max}
        </span>
        <button className="btn btn-primary" onClick={publish} disabled={sending || uploading || muted}>
          {sending ? '发布中…' : '发布'}
        </button>
      </div>
    </div>
  );
}
