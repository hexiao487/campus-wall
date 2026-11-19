import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';

/** 删除单条评论：管理员可删任意评论，作者可删自己的评论 */
export async function DELETE(request, { params }) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { id: postId, commentId } = await params;
    const supabase = getSupabase();

    const { data: comment } = await supabase
      .from('comments')
      .select('id, post_id, author_id')
      .eq('id', commentId)
      .eq('post_id', postId)
      .maybeSingle();

    if (!comment) {
      return NextResponse.json({ error: '评论不存在或已被删除' }, { status: 404 });
    }

    const isAdmin = user.role === 'admin';
    const isAuthor = Boolean(user.id) && comment.author_id === user.id;

    if (!isAdmin && !isAuthor) {
      return NextResponse.json({ error: '只能删除自己的评论' }, { status: 403 });
    }

    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: '删除评论失败：' + e.message }, { status: 500 });
  }
}
