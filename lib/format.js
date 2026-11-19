/** 纯函数工具，前后端都能用 */

export function timeAgo(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - t);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return '刚刚';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day} 天前`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function initial(name) {
  if (!name) return '?';
  return name.trim().slice(0, 1).toUpperCase();
}

/** 根据用户名生成稳定的头像渐变色 */
export function avatarStyle(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) {
    h = (h * 31 + name.charCodeAt(i)) % 360;
  }
  const h2 = (h + 40) % 360;
  return {
    background: `linear-gradient(135deg, hsl(${h} 78% 62%), hsl(${h2} 82% 52%))`
  };
}
