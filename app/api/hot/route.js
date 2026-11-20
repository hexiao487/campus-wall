import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

/** 热榜：全部 / 今日 / 本周，按点赞数 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || 'all';
    const supabase = getSupabase();

    let query = supabase
      .from('posts')
      .select('id, author_id, author_name, content, image_url, like_count, comment_count, created_at')
      .order('like_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20);

    if (range === 'day' || range === 'week') {
      const days = range === 'day' ? 1 : 7;
      const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
      query = query.gte('created_at', since);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const rows = data || [];
    try {
      const ids = Array.from(new Set(rows.map((p) => p.author_id).filter(Boolean)));
      const { data: authors } = await supabase.from('users').select('id, role').in('id', ids);
      const map = {};
      for (const a of authors || []) map[a.id] = a.role;
      for (const p of rows) p.author_role = map[p.author_id] || 'user';
    } catch {
      /* ignore */
    }

    return NextResponse.json({ posts: rows, range });
  } catch (e) {
    return NextResponse.json({ error: '加载热榜失败：' + e.message }, { status: 500 });
  }
}
