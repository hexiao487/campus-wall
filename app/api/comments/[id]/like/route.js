import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { readJson, writeJson } from '@/lib/store';

const keyOf = (postId) => `comment_likes:${postId}`;

/** 评论点赞 / 取消点赞（点赞记录存 app_config，按帖子聚合） */
export async function POST(request, { params }) {
  try {
    const me = await getSessionUser(request);
    if (!me?.id) return NextResponse.json({ error: '登录后才能点赞' }, { status: 401 });

    const { id } = await params;
    const supabase = getSupabase();

    const { data: comment } = await supabase
      .from('comments')
      .select('id, post_id')
      .eq('id', id)
      .maybeSingle();

    if (!comment) return NextResponse.json({ error: '评论不存在或已删除' }, { status: 404 });

    const map = await readJson(supabase, keyOf(comment.post_id), {});
    const list = Array.isArray(map?.[id]) ? map[id] : [];
    const liked = list.includes(me.id);
    const next = liked ? list.filter((u) => u !== me.id) : [...list, me.id];

    const nextMap = { ...(map || {}), [id]: next };
    await writeJson(supabase, keyOf(comment.post_id), nextMap);

    return NextResponse.json({ liked: !liked, likeCount: next.length });
  } catch (e) {
    return NextResponse.json({ error: '点赞失败：' + e.message }, { status: 500 });
  }
}
