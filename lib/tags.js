/** 从正文里提取 #话题（中文、字母、数字、下划线，2-20 字） */
export function extractTags(content) {
  const text = String(content || '');
  const re = /#([\p{L}\p{N}_]{1,20})/gu;
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    const t = m[1].toLowerCase();
    if (t && !out.includes(t)) out.push(t);
  }
  return out.slice(0, 5);
}
