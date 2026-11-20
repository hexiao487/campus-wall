/** 帖子里视频用 `video::` 前缀存在 posts.image_url 中，和纯图片链接共用一列 */
const PREFIX = 'video::';

export function isVideo(url) {
  return typeof url === 'string' && url.startsWith(PREFIX);
}

export function toVideoTag(url) {
  return PREFIX + String(url || '').trim();
}

export function mediaSrc(url) {
  const s = String(url || '');
  return isVideo(s) ? s.slice(PREFIX.length) : s;
}
