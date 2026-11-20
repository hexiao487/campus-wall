/**
 * 手机端视频压缩：用 canvas + MediaRecorder 实时重编码，把 >50MB 的视频压到 50MB 以内。
 * 只在浏览器里跑，不依赖服务端 ffmpeg。
 */
import fixWebmDuration from 'fix-webm-duration';

const MB = 1024 * 1024;

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

export async function compressVideo(file, { maxBytes = 50 * MB, maxSide = 1280, onProgress } = {}) {
  if (typeof MediaRecorder === 'undefined' || typeof document === 'undefined') {
    throw new Error('当前浏览器不支持视频压缩，请先在相册里压缩后再发');
  }

  const objUrl = URL.createObjectURL(file);
  const el = document.createElement('video');
  el.src = objUrl;
  el.muted = true;
  el.playsInline = true;
  el.preload = 'auto';

  await new Promise((resolve, reject) => {
    el.onloadedmetadata = resolve;
    el.onerror = () => reject(new Error('视频读取失败，换一个格式试试'));
    setTimeout(() => reject(new Error('视频读取超时，换一个格式试试')), 15000);
  });

  const duration = el.duration || 0;
  if (!duration) throw new Error('视频时长读取失败，换一个再试');
  if (duration > 180) throw new Error('视频超过 3 分钟，先剪短一点再发');

  const mime = pickMime();
  if (!mime) throw new Error('当前浏览器不支持视频压缩，请先在相册里压缩后再发');

  const audioKbps = 96;
  const budgetKbps = Math.floor((maxBytes * 8 * 0.92) / duration / 1000);
  const videoKbps = Math.max(420, Math.min(2400, budgetKbps - audioKbps));

  let scale = Math.min(1, maxSide / Math.max(el.videoWidth || 720, el.videoHeight || 720));
  if (videoKbps < 900) scale = Math.min(scale, 720 / Math.max(el.videoWidth || 720, el.videoHeight || 720));
  const w = Math.max(2, Math.round((el.videoWidth * scale) / 2) * 2);
  const h = Math.max(2, Math.round((el.videoHeight * scale) / 2) * 2);

  const canvas = document.createElement('canvas');
  if (!canvas.captureStream) throw new Error('当前浏览器不支持视频压缩，请先在相册里压缩后再发');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  const stream = canvas.captureStream(30);
  let audioCtx = null;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      audioCtx = new AC();
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      const srcNode = audioCtx.createMediaElementSource(el);
      const dest = audioCtx.createMediaStreamDestination();
      srcNode.connect(dest);
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    }
  } catch {
    /* 没声音也能压 */
  }

  const rec = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: videoKbps * 1000,
    audioBitsPerSecond: audioKbps * 1000
  });
  const chunks = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise((resolve) => {
    rec.onstop = resolve;
  });

  rec.start(1000);
  try {
    await el.play();
  } catch {
    rec.stop();
    throw new Error('视频压缩失败，请重试');
  }

  let raf = 0;
  const draw = () => {
    if (el.ended) return;
    try {
      ctx.drawImage(el, 0, 0, w, h);
    } catch {
      /* 忽略单帧失败 */
    }
    if (onProgress) onProgress(Math.min(99, Math.round((el.currentTime / duration) * 100)));
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);

  await new Promise((resolve) => {
    el.onended = resolve;
    el.onerror = resolve;
    setTimeout(resolve, (duration + 5) * 1000);
  });

  cancelAnimationFrame(raf);
  try {
    rec.stop();
  } catch {
    /* 已经停了 */
  }
  stream.getTracks().forEach((t) => t.stop());
  await stopped;
  if (audioCtx) audioCtx.close().catch?.(() => {});
  URL.revokeObjectURL(objUrl);

  const type = mime.split(';')[0] || 'video/webm';
  let blob = new Blob(chunks, { type });
  // MediaRecorder 录出来的 webm 没有时长信息，播放器会显示 0:00 且不能拖动，补一下
  if (type.includes('webm')) {
    try {
      blob = await fixWebmDuration(blob, Math.max(1, duration) * 1000);
    } catch {
      /* 补时长失败不影响播放 */
    }
  }
  if (blob.size > maxBytes) {
    throw new Error('压缩后仍超过 50MB，先在相册里剪短一点再发');
  }
  const ext = type.includes('mp4') ? 'mp4' : 'webm';
  const base = String(file.name || 'video').replace(/\.[^.]+$/, '');
  if (onProgress) onProgress(100);
  return new File([blob], `${base}.${ext}`, { type });
}

export const VIDEO_MAX_BYTES = 50 * MB;
