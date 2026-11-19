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

/** 根据用户名生成稳定的黑白头像（极简风格，不带彩色） */
export function avatarStyle(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) {
    h = (h * 31 + name.charCodeAt(i)) % 360;
  }
  const light = 12 + (h % 26); // 12% - 38% 的深灰，保证白字可读
  const light2 = light + 10;
  return {
    background: `linear-gradient(135deg, hsl(0 0% ${light}%), hsl(0 0% ${light2}%))`
  };
}
