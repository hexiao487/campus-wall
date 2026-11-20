/** 帖子里视频用 `video::` 前缀存在 posts.image_url 中，和纯图片链接共用一列 */
const PREFIX = 'video::';

export function isVideo(url) {
  return typeof url === 'string' && url.startsWith(PREFIX);
}

export function toVideoTag(url) {
  return PREFIX + String(url || '').trim();
}

const SB_HOST = 'https://mkbqmgvkdreireobvodr.supabase.co';

/** Supabase 的视频也走同域 /sb 代理，手机端（国内网络）才打得开 */
export function mediaSrc(url) {
  const s = String(url || '');
  const raw = isVideo(s) ? s.slice(PREFIX.length) : s;
  if (raw.startsWith(SB_HOST)) return '/sb' + raw.slice(SB_HOST.length);
  return raw;
}

/** 根据后缀给出 video 的 MIME，移动端 <source type> 缺失时常直接放不出来 */
export function videoMime(url) {
  const s = String(url || '').split('?')[0].toLowerCase();
  if (s.endsWith('.webm')) return 'video/webm';
  if (s.endsWith('.mov')) return 'video/quicktime';
  return 'video/mp4';
}
