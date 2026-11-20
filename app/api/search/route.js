import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

/** 全站搜索：帖子正文 + 用户名 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    if (!q) return NextResponse.json({ posts: [], users: [] });

    const supabase = getSupabase();
    const like = `%${q.replace(/[%_]/g, '')}%`;

    const [postsRes, usersRes] = await Promise.all([
      supabase
        .from('posts')
        .select('id, author_id, author_name, content, image_url, like_count, comment_count, created_at')
        .ilike('content', like)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('users')
        .select('id, username, role')
        .ilike('username', like)
        .limit(20)
    ]);

    const posts = postsRes.data || [];
    const users = usersRes.data || [];

    if (posts.length) {
      try {
        const ids = Array.from(new Set(posts.map((p) => p.author_id).filter(Boolean)));
        const { data: authors } = await supabase.from('users').select('id, role').in('id', ids);
        const map = {};
        for (const a of authors || []) map[a.id] = a.role;
        for (const p of posts) p.author_role = map[p.author_id] || 'user';
      } catch {
        /* 忽略角色回填失败 */
      }
    }

    return NextResponse.json({ posts, users, q });
  } catch (e) {
    return NextResponse.json({ error: '搜索失败：' + e.message }, { status: 500 });
  }
}
