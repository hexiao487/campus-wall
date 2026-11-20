/** posts.image_url 兼容：单图字符串 或 多图 JSON 数组 */
export function parseImages(value) {
  if (!value) return [];
  const s = String(value).trim();
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s);
      return Array.isArray(arr) ? arr.filter(Boolean).slice(0, 4) : [];
    } catch {
      return [s];
    }
  }
  return [s];
}

export function joinImages(list) {
  const arr = (list || []).filter(Boolean).slice(0, 4);
  if (!arr.length) return null;
  if (arr.length === 1) return arr[0];
  return JSON.stringify(arr);
}
