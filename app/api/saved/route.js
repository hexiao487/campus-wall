import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { readJson, writeJson } from '@/lib/store';

function keyOf(userId) {
  return `saved:${userId}`;
}

/** 我的收藏：GET 返回帖子列表；POST { postId } 切换收藏 */
export async function GET(request) {
  try {
    const me = await getSessionUser(request);
    if (!me?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const supabase = getSupabase();
    const ids = await readJson(supabase, keyOf(me.id), []);
    if (!Array.isArray(ids) || !ids.length) return NextResponse.json({ posts: [], ids: [] });

    const { data } = await supabase
      .from('posts')
      .select('id, author_id, author_name, content, image_url, like_count, comment_count, created_at')
      .in('id', ids);

    const map = {};
    for (const p of data || []) map[p.id] = p;
    const posts = ids.map((id) => map[id]).filter(Boolean);

    try {
      const authorIds = Array.from(new Set(posts.map((p) => p.author_id).filter(Boolean)));
      const { data: authors } = await supabase.from('users').select('id, role').in('id', authorIds);
      const rm = {};
      for (const a of authors || []) rm[a.id] = a.role;
      for (const p of posts) p.author_role = rm[p.author_id] || 'user';
    } catch {
      /* ignore */
    }

    return NextResponse.json({ posts, ids });
  } catch (e) {
    return NextResponse.json({ error: '加载收藏失败：' + e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const me = await getSessionUser(request);
    if (!me?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const postId = String(body.postId || '');
    if (!postId) return NextResponse.json({ error: '缺少帖子 id' }, { status: 400 });

    const supabase = getSupabase();
    const ids = await readJson(supabase, keyOf(me.id), []);
    const list = Array.isArray(ids) ? ids : [];
    const exists = list.includes(postId);
    const next = exists ? list.filter((x) => x !== postId) : [postId, ...list].slice(0, 200);
    await writeJson(supabase, keyOf(me.id), next);

    return NextResponse.json({ saved: !exists, ids: next });
  } catch (e) {
    return NextResponse.json({ error: '收藏失败：' + e.message }, { status: 500 });
  }
}
