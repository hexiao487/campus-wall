'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import { avatarStyle, initial } from '@/lib/format';

/** Float32 PCM -> Int16 -> base64 */
function encodePcm(float32) {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let bin = '';
  const step = 8192;
  for (let i = 0; i < bytes.length; i += step) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
  }
  return btoa(bin);
}

/** base64 -> Int16 -> Float32 */
function decodePcm(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer);
  const out = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) out[i] = int16[i] / 32768;
  return out;
}

const RATE = 16000;

export default function PttPage() {
  const search = useSearchParams();
  const withId = search.get('with') || '';

  const [me, setMe] = useState(null);
  const [peer, setPeer] = useState(null);
  const [friends, setFriends] = useState([]);
  const [status, setStatus] = useState('未连接');
  const [talking, setTalking] = useState(false);
  const [peerTalking, setPeerTalking] = useState(false);
  const [err, setErr] = useState('');
  const [ready, setReady] = useState(false);

  const cursorRef = useRef(0);
  const pollRef = useRef(null);
  const talkCtxRef = useRef(null);
  const playCtxRef = useRef(null);
  const procRef = useRef(null);
  const streamRef = useRef(null);
  const sampleBufRef = useRef([]);
  const sampleLenRef = useRef(0);
  const seqRef = useRef(0);
  const nextTimeRef = useRef(0);
  const peerTimerRef = useRef(null);

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = await res.json();
      setMe(data.user || null);
      return data.user || null;
    } catch {
      setMe(null);
      return null;
    }
  }, []);

  // 确认好友关系 + 拿到对端资料
  useEffect(() => {
    (async () => {
      const user = await loadMe();
      if (!user) return;
      try {
        const r1 = await fetch('/api/friends', { cache: 'no-store' });
        const d1 = await r1.json();
        setFriends(d1.friends || []);
        if (withId) {
          const found = (d1.friends || []).find((f) => f.id === withId);
          if (!found) {
            setErr('只能和好友对讲，先去好友页加上 TA');
            setStatus('未连接');
            return;
          }
          setPeer(found);
          setStatus('已进入频道，按住按钮开始说话');
          setReady(true);
        }
      } catch (e) {
        setErr(e.message);
      }
    })();
  }, [loadMe, withId]);

  const channel = me?.id && withId ? [me.id, withId].sort().join('_') : '';

  const pushChunk = useCallback(
    async (pcm) => {
      const res = await fetch('/api/ptt/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, seq: seqRef.current++, pcm })
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error || '语音发送失败');
      }
    },
    [channel]
  );


  // 接收循环
  useEffect(() => {
    if (!ready || !channel) return;
    let stopped = false;

    async function tick() {
      if (stopped) return;
      try {
        const res = await fetch(`/api/ptt/pull?channel=${encodeURIComponent(channel)}&cursor=${cursorRef.current}`, {
          cache: 'no-store'
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '接收失败');
        cursorRef.current = data.cursor || cursorRef.current;
        if (data.chunks?.length) {
          setPeerTalking(true);
          clearTimeout(peerTimerRef.current);
          peerTimerRef.current = setTimeout(() => setPeerTalking(false), 900);
          for (const c of data.chunks) playPcm(decodePcm(c.pcm));
        }
      } catch (e) {
        setErr(e.message);
      }
    }

    pollRef.current = setInterval(tick, 320);
    return () => {
      stopped = true;
      clearInterval(pollRef.current);
      clearTimeout(peerTimerRef.current);
    };
  }, [ready, channel]);

  function playPcm(samples) {
    if (!samples.length) return;
    if (!playCtxRef.current) playCtxRef.current = new AudioContext();
    const ctx = playCtxRef.current;
    const buffer = ctx.createBuffer(1, samples.length, RATE);
    buffer.copyToChannel(samples, 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const now = ctx.currentTime;
    if (nextTimeRef.current < now + 0.02) nextTimeRef.current = now + 0.12; // 留一点抖动缓冲
    src.connect(ctx.destination);
    src.start(nextTimeRef.current);
    nextTimeRef.current += buffer.duration;
  }

  async function startTalk() {
    if (!ready || talking) return;
    setErr('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: RATE });
      talkCtxRef.current = ctx;
      if (ctx.state === 'suspended') await ctx.resume();

      const source = ctx.createMediaStreamSource(stream);
      const proc = ctx.createScriptProcessor(2048, 1, 1);
      procRef.current = proc;
      sampleBufRef.current = [];
      sampleLenRef.current = 0;

      proc.onaudioprocess = (ev) => {
        const input = ev.inputBuffer.getChannelData(0);
        // 拷贝一份，避免缓冲区被复用
        sampleBufRef.current.push(new Float32Array(input));
        sampleLenRef.current += input.length;
        if (sampleLenRef.current >= 4096) {
          const total = sampleLenRef.current;
          const merged = new Float32Array(total);
          let off = 0;
          for (const part of sampleBufRef.current) {
            merged.set(part, off);
            off += part.length;
          }
          sampleBufRef.current = [];
          sampleLenRef.current = 0;
          pushChunk(encodePcm(merged));
        }
      };

      const sink = ctx.createGain();
      sink.gain.value = 0;
      source.connect(proc);
      proc.connect(sink);
      sink.connect(ctx.destination);

      setTalking(true);
      setStatus('正在说话…松手即停');
    } catch (e) {
      setErr('麦克风打不开：' + (e.message || ''));
    }
  }

  function stopTalk() {
    if (!talking) return;
    setTalking(false);
    setStatus('已进入频道，按住按钮开始说话');
    try {
      procRef.current?.disconnect();
      procRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (talkCtxRef.current) {
        talkCtxRef.current.close();
        talkCtxRef.current = null;
      }
      // 把剩下的碎片发出去
      if (sampleLenRef.current >= 512) {
        const total = sampleLenRef.current;
        const merged = new Float32Array(total);
        let off = 0;
        for (const part of sampleBufRef.current) {
          merged.set(part, off);
          off += part.length;
        }
        sampleBufRef.current = [];
        sampleLenRef.current = 0;
        pushChunk(encodePcm(merged));
      }
    } catch {
      // 忽略收尾异常
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setMe(null);
  }

  return (
    <>
      <SiteHeader me={me} onLogout={handleLogout} />
      <div className="shell">
        <div className="room-head">
          <Link className="room-back" href="/friends">← 好友</Link>
          <div>
            <div className="room-title">对讲机</div>
            <div className="room-sub">按住说话，松开就停；对方声音会实时从喇叭里出来</div>
          </div>
        </div>

        {err && <div className="alert">{err}</div>}

        {!me ? (
          <div className="card">
            <div className="section-title">登录后才能用对讲机</div>
            <div style={{ marginTop: 12 }}>
              <Link className="btn btn-primary" href="/login">登录 / 注册</Link>
            </div>
          </div>
        ) : !withId ? (
          <div className="card">
            <div className="group-section-title">选一位好友开频道</div>
            {friends.length === 0 && <div className="empty">还没有好友，先去好友页加人</div>}
            {friends.map((f) => (
              <Link className="row" href={`/ptt?with=${f.id}`} key={f.id}>
                <span className="avatar" style={{ ...avatarStyle(f.username, f.avatar_url), width: 38, height: 38, borderRadius: 12 }}>
                  {initial(f.username)}
                </span>
                <div className="row-main">
                  <div className="row-title">{f.username}</div>
                  <div className="row-sub">和 TA 开对讲机频道</div>
                </div>
                <span className="tag-ok">开始</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card ptt-card">
            <div className="ptt-head">
              <span className="avatar" style={{ ...avatarStyle(peer?.username || '?', peer?.avatar_url), width: 44, height: 44, borderRadius: 14 }}>
                {initial(peer?.username)}
              </span>
              <div>
                <div className="room-title" style={{ fontSize: 18 }}>{peer?.username || '好友'}</div>
                <div className="room-sub">{status}</div>
              </div>
              {peerTalking && <span className="ptt-live">对方讲话中</span>}
            </div>

            <button
              className={`ptt-button ${talking ? 'talking' : ''}`}
              onMouseDown={startTalk}
              onMouseUp={stopTalk}
              onMouseLeave={stopTalk}
              onTouchStart={(e) => {
                e.preventDefault();
                startTalk();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                stopTalk();
              }}
              disabled={!ready}
            >
              <span className="ptt-icon">🎙</span>
              {talking ? '说话中，松手结束' : '按住说话'}
            </button>

            <div className="hint-line">
              说话时对方能实时听到；戴耳机可以避免回声。频道只对你们两个人开放。
            </div>
          </div>
        )}
      </div>
    </>
  );
}
