import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** 我的页面数据：type=mine 我发的 / liked 我点赞的 / saved 我收藏的 */
export async function GET(request) {
  try {
    const me = await getSessionUser(request);
    if (!me?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const supabase = getSupabase();
    const type = new URL(request.url).searchParams.get('type') || 'mine';
    const fields = 'id, author_id, author_name, content, image_url, like_count, comment_count, created_at';

    let posts = [];

    if (type === 'liked') {
      const { data: likes } = await supabase
        .from('likes')
        .select('post_id, created_at')
        .eq('user_id', me.id)
        .order('created_at', { ascending: false })
        .limit(100);
      const ids = (likes || []).map((l) => l.post_id).filter(Boolean);
      if (ids.length) {
        const { data } = await supabase.from('posts').select(fields).in('id', ids);
        const map = {};
        for (const p of data || []) map[p.id] = p;
        posts = ids.map((id) => map[id]).filter(Boolean);
      }
    } else {
      const { data } = await supabase
        .from('posts')
        .select(fields)
        .eq('author_id', me.id)
        .order('created_at', { ascending: false })
        .limit(50);
      posts = data || [];
    }

    try {
      const authorIds = Array.from(new Set(posts.map((p) => p.author_id).filter(Boolean)));
      if (authorIds.length) {
        const { data: authors } = await supabase.from('users').select('id, role').in('id', authorIds);
        const rm = {};
        for (const a of authors || []) rm[a.id] = a.role;
        for (const p of posts) p.author_role = rm[p.author_id] || 'user';
      }
    } catch {
      /* 忽略 */
    }

    return NextResponse.json({ posts, count: posts.length });
  } catch (e) {
    return NextResponse.json({ error: '加载失败：' + e.message }, { status: 500 });
  }
}
