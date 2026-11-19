import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { relationship } from '@/lib/social';

/** 按用户名搜索用户，附带与我的关注/好友关系 */
export async function GET(request) {
  try {
    const me = await getSessionUser(request);
    if (!me?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();

    const supabase = getSupabase();
    let query = supabase
      .from('users')
      .select('id, username, role, avatar_url, created_at')
      .neq('id', me.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (q) query = query.ilike('username', `%${q}%`);

    const { data: users, error } = await query;
    if (error) throw new Error(error.message);

    const list = [];
    for (const u of users || []) {
      const rel = await relationship(supabase, me.id, u.id);
      list.push({ ...u, ...rel });
    }

    // 如果没有关键词，顺带推荐一些「还没关注的人」
    return NextResponse.json({ users: list });
  } catch (e) {
    return NextResponse.json({ error: '搜索失败：' + e.message }, { status: 500 });
  }
}
