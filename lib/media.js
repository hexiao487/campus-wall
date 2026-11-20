/** 帖子里视频用 `video::` 前缀存在 posts.image_url 中，和纯图片链接共用一列。
 * 形如 video::<视频地址>#poster=<封面地址>，封面用于手机端未播放时显示第一帧。 */
const PREFIX = 'video::';
const POSTER = '#poster=';
const SB_HOST = 'https://mkbqmgvkdreireobvodr.supabase.co';

export function isVideo(url) {
  return typeof url === 'string' && url.startsWith(PREFIX);
}

/** 拆出视频地址和封面地址 */
export function splitVideo(url) {
  const s = String(url || '');
  const body = isVideo(s) ? s.slice(PREFIX.length) : s;
  const at = body.indexOf(POSTER);
  if (at < 0) return { src: body, poster: null };
  return { src: body.slice(0, at), poster: body.slice(at + POSTER.length) || null };
}

export function toVideoTag(url, poster) {
  const tag = PREFIX + String(url || '').trim();
  return poster ? tag + POSTER + String(poster).trim() : tag;
}

function proxy(url) {
  const s = String(url || '');
  if (s.startsWith(SB_HOST)) return '/sb' + s.slice(SB_HOST.length);
  return s;
}

/** Supabase 的视频也走同域 /sb 代理，手机端（国内网络）才打得开 */
export function mediaSrc(url) {
  return proxy(splitVideo(url).src);
}

export function posterSrc(url) {
  const p = splitVideo(url).poster;
  return p ? proxy(p) : null;
}

/** 根据后缀给出 video 的 MIME，移动端 <source type> 缺失时常直接放不出来 */
export function videoMime(url) {
  const s = String(url || '').split('?')[0].toLowerCase();
  if (s.endsWith('.webm')) return 'video/webm';
  if (s.endsWith('.mov')) return 'video/quicktime';
  return 'video/mp4';
}
