import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { readJson, writeJson } from '@/lib/store';

export const dynamic = 'force-dynamic';

const KEY = 'pinned_posts';

/** 公告置顶：GET 返回置顶帖；POST（管理员）{ postId } 切换置顶 */
export async function GET() {
  try {
    const supabase = getSupabase();
    const ids = await readJson(supabase, KEY, []);
    if (!Array.isArray(ids) || !ids.length) return NextResponse.json({ posts: [], ids: [] });

    const { data } = await supabase
      .from('posts')
      .select('id, author_id, author_name, content, image_url, like_count, comment_count, created_at')
      .in('id', ids);

    const map = {};
    for (const p of data || []) map[p.id] = p;
    const posts = ids.map((id) => map[id]).filter(Boolean);
    for (const p of posts) p.author_role = 'admin';

    return NextResponse.json({ posts, ids });
  } catch (e) {
    return NextResponse.json({ error: '加载公告失败：' + e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const me = await getSessionUser(request);
    if (!me || me.role !== 'admin') return NextResponse.json({ error: '只有管理员可以置顶' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const postId = String(body.postId || '');
    if (!postId) return NextResponse.json({ error: '缺少帖子 id' }, { status: 400 });

    const supabase = getSupabase();
    const ids = await readJson(supabase, KEY, []);
    const list = Array.isArray(ids) ? ids : [];
    const exists = list.includes(postId);
    const next = exists ? list.filter((x) => x !== postId) : [postId, ...list].slice(0, 5);
    await writeJson(supabase, KEY, next);

    return NextResponse.json({ pinned: !exists, ids: next });
  } catch (e) {
    return NextResponse.json({ error: '置顶失败：' + e.message }, { status: 500 });
  }
}
