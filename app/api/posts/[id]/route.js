import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { readJson } from '@/lib/store';

/** 单条帖子 + 全部评论 */
export async function GET(request, { params }) {
  try {
    const supabase = getSupabase();
    const { id } = await params;

    const { data: post, error } = await supabase
      .from('posts')
      .select('id, author_id, author_name, content, image_url, like_count, comment_count, created_at')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!post) return NextResponse.json({ error: '帖子不存在或已被删除' }, { status: 404 });

    try {
      if (post.author_id) {
        const { data: author } = await supabase
          .from('users')
          .select('id, role, avatar_url')
          .eq('id', post.author_id)
          .maybeSingle();
        post.author_role = author?.role || 'user';
        post.author_avatar = author?.avatar_url || null;
      }
    } catch {
      /* 忽略 */
    }

    const { data: comments } = await supabase
      .from('comments')
      .select('id, post_id, author_id, author_name, content, created_at')
      .eq('post_id', id)
      .order('created_at', { ascending: true })
      .limit(200);

    let liked = false;
    let saved = false;
    try {
      const me = await getSessionUser(request);
      if (me?.id) {
        const [likeRow, savedRaw] = await Promise.all([
          supabase.from('likes').select('post_id').eq('post_id', id).eq('user_id', me.id).maybeSingle(),
          readJson(supabase, `saved:${me.id}`, [])
        ]);
        liked = Boolean(likeRow?.data);
        saved = Array.isArray(savedRaw) && savedRaw.includes(id);
      }
    } catch {
      /* 忽略 */
    }

    let commentLikes = {};
    try {
      commentLikes = await readJson(supabase, `comment_likes:${id}`, {});
    } catch {
      /* 忽略 */
    }

    let viewerId = null;
    try {
      const viewer = await getSessionUser(request);
      viewerId = viewer?.id || null;
    } catch {
      /* 忽略 */
    }

    const withLikes = (comments || []).map((c) => {
      const list = Array.isArray(commentLikes?.[c.id]) ? commentLikes[c.id] : [];
      return { ...c, like_count: list.length, liked_me: Boolean(viewerId) && list.includes(viewerId) };
    });

    return NextResponse.json({ post, comments: withLikes, liked, saved });
  } catch (e) {
    return NextResponse.json({ error: '加载失败：' + e.message }, { status: 500 });
  }
}


/** 编辑帖子：作者或管理员可改正文 */
export async function PATCH(request, { params }) {
  try {
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const supabase = getSupabase();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const content = String(body.content || '').trim();

    if (content.length > 1000) return NextResponse.json({ error: '内容最多 1000 字' }, { status: 400 });

    const { data: post } = await supabase
      .from('posts')
      .select('id, author_id, image_url')
      .eq('id', id)
      .maybeSingle();

    if (!post) return NextResponse.json({ error: '帖子不存在或已被删除' }, { status: 404 });

    const isAdmin = user.role === 'admin';
    const isAuthor = Boolean(user.id) && post.author_id === user.id;
    if (!isAdmin && !isAuthor) return NextResponse.json({ error: '只能编辑自己的帖子' }, { status: 403 });
    if (!content && !post.image_url) return NextResponse.json({ error: '正文不能为空' }, { status: 400 });

    const { data: updated, error } = await supabase
      .from('posts')
      .update({ content })
      .eq('id', id)
      .select('id, author_id, author_name, content, image_url, like_count, comment_count, created_at')
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ post: updated });
  } catch (e) {
    return NextResponse.json({ error: '编辑失败：' + e.message }, { status: 500 });
  }
}

/** 删帖：管理员可删任意帖，作者可删自己的帖子（连带评论和点赞） */
export async function DELETE(request, { params }) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const supabase = getSupabase();
    const { id } = await params;

    const { data: post } = await supabase
      .from('posts')
      .select('id, author_id')
      .eq('id', id)
      .maybeSingle();

    if (!post) {
      return NextResponse.json({ error: '帖子不存在或已被删除' }, { status: 404 });
    }

    const isAdmin = user.role === 'admin';
    const isAuthor = Boolean(user.id) && post.author_id === user.id;

    if (!isAdmin && !isAuthor) {
      return NextResponse.json({ error: '只能删除自己的帖子' }, { status: 403 });
    }

    const { error } = await supabase.from('posts').delete().eq('id', id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: '删除失败：' + e.message }, { status: 500 });
  }
}
