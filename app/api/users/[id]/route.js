import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { relationship } from '@/lib/social';

/** 单个用户主页信息：资料 + 关注/粉丝/帖子数 + 与我的关系 */
export async function GET(request, { params }) {
  try {
    const id = params.id;
    if (!id) return NextResponse.json({ error: '用户不存在' }, { status: 400 });

    const supabase = getSupabase();
    const me = await getSessionUser(request);

    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, role, avatar_url, created_at')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!user) return NextResponse.json({ error: '这个用户不存在' }, { status: 404 });

    const [posts, followers, following, rel] = await Promise.all([
      supabase.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', id),
      supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', id),
      supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', id),
      relationship(supabase, me?.id || null, id)
    ]);

    return NextResponse.json({
      user,
      stats: {
        posts: posts.count || 0,
        followers: followers.count || 0,
        following: following.count || 0
      },
      relation: { ...rel, isMe: me?.id === id }
    });
  } catch (e) {
    return NextResponse.json({ error: '加载主页失败：' + e.message }, { status: 500 });
  }
}
