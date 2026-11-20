'use client';

import { imgSrc } from '@/lib/img';

import { useEffect, useRef, useState } from 'react';
import { compressImage } from '@/lib/imageCompress';
import { joinImages } from '@/lib/images';
import { toVideoTag, mediaSrc } from '@/lib/media';

export default function Composer({
  initialText = '', me, onPublished }) {
  const [content, setContent] = useState(initialText || '');
  const [imageList, setImageList] = useState([]);
  const [video, setVideo] = useState(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [mentionAnchor, setMentionAnchor] = useState(-1);
  const [suggestions, setSuggestions] = useState([]);
  const [mentionIds, setMentionIds] = useState([]);
  const fileRef = useRef(null);
  const videoRef = useRef(null);
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
    if (video) {
      setErr('一次只能发一个视频或一组图片，视频已移除');
      setVideo(null);
    }
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

  /** 从视频里抽第一帧当封面，手机端没播放时也能看到画面 */
  async function grabPoster(file) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        resolve(v);
      };
      const objUrl = URL.createObjectURL(file);
      const el = document.createElement('video');
      el.preload = 'auto';
      el.muted = true;
      el.playsInline = true;
      el.src = objUrl;
      el.onloadeddata = () => {
        try {
          el.currentTime = Math.min(0.2, (el.duration || 1) / 5);
        } catch {
          /* 忽略 */
        }
      };
      el.onseeked = () => {
        try {
          const w = Math.min(720, el.videoWidth || 720);
          const h = Math.round(((el.videoHeight || 720) * w) / (el.videoWidth || 720));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(el, 0, 0, w, h);
          canvas.toBlob(async (blob) => {
            URL.revokeObjectURL(objUrl);
            if (!blob) return finish(null);
            try {
              const fd = new FormData();
              fd.append('file', new File([blob], 'poster.jpg', { type: 'image/jpeg' }));
              const res = await fetch('/api/upload', { method: 'POST', body: fd });
              const data = await res.json();
              finish(res.ok ? data.url : null);
            } catch {
              finish(null);
            }
          }, 'image/jpeg', 0.82);
        } catch {
          URL.revokeObjectURL(objUrl);
          finish(null);
        }
      };
      el.onerror = () => {
        URL.revokeObjectURL(objUrl);
        finish(null);
      };
      setTimeout(() => {
        URL.revokeObjectURL(objUrl);
        finish(null);
      }, 8000);
    });
  }

  async function pickVideo(e) {
    const file = (e.target.files || [])[0];
    e.target.value = '';
    if (!file) return;
    setErr('');
    if (file.size > 50 * 1024 * 1024) {
      setErr('视频不能超过 50MB，先用相册/剪辑 App 压一下再传');
      return;
    }
    if (imageList.length) setImageList([]);
    setVideoUploading(true);
    setVideoProgress(0);
    try {
      const signRes = await fetch('/api/upload/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: file.type || 'video/mp4', size: file.size })
      });
      const sign = await signRes.json();
      if (!signRes.ok) throw new Error(sign.error || '申请上传失败');

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', sign.signedUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
        xhr.setRequestHeader('x-upsert', 'true');
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setVideoProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('上传失败，请重试')));
        xhr.onerror = () => reject(new Error('上传失败，请检查网络'));
        xhr.send(file);
      });

      let poster = null;
      try {
        poster = await grabPoster(file);
      } catch {
        poster = null;
      }
      setVideo({ url: sign.url, poster, type: file.type, name: file.name });
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setVideoUploading(false);
      setVideoProgress(0);
    }
  }

  async function publish() {
    if (sending || uploading || videoUploading) return;
    if (!content.trim() && imageList.length === 0 && !video) {
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
        body: JSON.stringify({
          content: content.trim(),
          imageUrl: video ? toVideoTag(video.url, video.poster) : joinImages(imageList),
          mentions: active
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '发布失败');
      setContent('');
      setImageList([]);
      setVideo(null);
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
                {u.role === 'admin' && u.username !== '管理员' && <span className="badge-admin">管理员</span>}
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

      {video && (
        <div className="composer-video">
          <video src={mediaSrc(video.url)} controls playsInline preload="metadata" poster={video.poster ? mediaSrc(video.poster) : undefined} />
          <button type="button" className="composer-image-remove" onClick={() => setVideo(null)}>
            移除
          </button>
        </div>
      )}
      {videoUploading && <div className="composer-video-bar">视频上传中… {videoProgress}%</div>}

      <div className="composer-bar">
        <button type="button" className="btn btn-ghost btn-mini" onClick={() => fileRef.current?.click()} disabled={uploading || muted}>
          {uploading ? '上传中…' : `📷 配图 ${imageList.length}/4`}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-mini"
          onClick={() => videoRef.current?.click()}
          disabled={videoUploading || muted}
        >
          {videoUploading ? '上传中…' : '🎬 视频'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={pickImage} hidden />
        <input ref={videoRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/*" onChange={pickVideo} hidden />
        <span className="composer-count">
          {content.length}/{max}
        </span>
        <button className="btn btn-primary" onClick={publish} disabled={sending || uploading || videoUploading || muted}>
          {sending ? '发布中…' : '发布'}
        </button>
      </div>
    </div>
  );
}
