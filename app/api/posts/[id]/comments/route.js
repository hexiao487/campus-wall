import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { addPoints } from '@/lib/points';

const MAX_LEN = 300;

/** 发评论 */
export async function POST(request, { params }) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: '登录后才能评论' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const content = String(body.content || '').trim();

    if (!content) {
      return NextResponse.json({ error: '评论内容不能为空' }, { status: 400 });
    }
    if (content.length > MAX_LEN) {
      return NextResponse.json({ error: `评论最多 ${MAX_LEN} 字` }, { status: 400 });
    }

    const supabase = getSupabase();

    let authorName = '管理员';
    if (user.role === 'user') {
      const { data: me } = await supabase
        .from('users')
        .select('is_muted, username')
        .eq('id', user.id)
        .maybeSingle();
      if (!me) {
        return NextResponse.json({ error: '账号不存在，请重新登录' }, { status: 401 });
      }
      if (me.is_muted) {
        return NextResponse.json({ error: '你已被管理员禁言，暂时不能评论' }, { status: 403 });
      }
      authorName = me.username;
    }

    const { data: created, error } = await supabase
      .from('comments')
      .insert({
        post_id: id,
        author_id: user.id || null,
        author_name: authorName,
        content
      })
      .select('id, post_id, author_id, author_name, content, created_at')
      .single();

    if (error) throw new Error(error.message);

    if (user.id) addPoints(supabase, user.id, 2).catch(() => {});

    return NextResponse.json({ comment: created });
  } catch (e) {
    return NextResponse.json({ error: '评论失败：' + e.message }, { status: 500 });
  }
}
