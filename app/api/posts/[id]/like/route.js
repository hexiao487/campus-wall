import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';

/** 点赞 / 取消点赞 */
export async function POST(request, { params }) {
  try {
    const user = await getSessionUser(request);
    if (!user || !user.id) {
      return NextResponse.json({ error: '登录后才能点赞' }, { status: 401 });
    }

    const supabase = getSupabase();
    const { id } = await params;

    const { data: existing } = await supabase
      .from('likes')
      .select('post_id')
      .eq('post_id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    let liked;
    if (existing) {
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('post_id', id)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
      liked = false;
    } else {
      const { error } = await supabase.from('likes').insert({ post_id: id, user_id: user.id });
      if (error) throw new Error(error.message);
      liked = true;
    }

    const { data: post } = await supabase
      .from('posts')
      .select('like_count')
      .eq('id', id)
      .maybeSingle();

    return NextResponse.json({ liked, likeCount: post?.like_count ?? 0 });
  } catch (e) {
    return NextResponse.json({ error: '点赞失败：' + e.message }, { status: 500 });
  }
}
