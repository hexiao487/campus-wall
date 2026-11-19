import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';

/** 单条帖子 + 全部评论 */
export async function GET(request, { params }) {
  try {
    const supabase = getSupabase();
    const { id } = await params;

    const { data: post, error } = await supabase
      .from('posts')
      .select('id, author_name, content, image_url, like_count, comment_count, created_at')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!post) return NextResponse.json({ error: '帖子不存在或已被删除' }, { status: 404 });

    const { data: comments } = await supabase
      .from('comments')
      .select('id, author_name, content, created_at')
      .eq('post_id', id)
      .order('created_at', { ascending: true })
      .limit(200);

    return NextResponse.json({ post, comments: comments || [] });
  } catch (e) {
    return NextResponse.json({ error: '加载失败：' + e.message }, { status: 500 });
  }
}

/** 删帖（仅管理员，连带删除评论和点赞） */
export async function DELETE(request, { params }) {
  try {
    const user = await getSessionUser(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: '只有管理员可以删帖' }, { status: 403 });
    }

    const supabase = getSupabase();
    const { id } = await params;

    const { error } = await supabase.from('posts').delete().eq('id', id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: '删除失败：' + e.message }, { status: 500 });
  }
}
