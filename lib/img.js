/** Supabase Storage 图片走同域代理，手机端（尤其国内网络）加载更稳 */
const SB_HOST = 'https://mkbqmgvkdreireobvodr.supabase.co';

export function imgSrc(url) {
  if (!url) return url;
  if (typeof url !== 'string') return url;
  if (url.startsWith(SB_HOST)) return '/sb' + url.slice(SB_HOST.length);
  return url;
}
