import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';

const MAX_LEN = 500;

/** 在群里发消息（文字或图片，二者至少有一个） */
export async function POST(request, { params }) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: '登录后才能发言' }, { status: 401 });
    }

    const { id: groupId } = await params;
    const body = await request.json().catch(() => ({}));
    const content = String(body.content || '').trim();
    const imageUrl = body.imageUrl ? String(body.imageUrl).trim() : null;

    if (!content && !imageUrl) {
      return NextResponse.json({ error: '说点什么或者发张图吧' }, { status: 400 });
    }
    if (content.length > MAX_LEN) {
      return NextResponse.json({ error: `单条文字最多 ${MAX_LEN} 字` }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data: membership } = await supabase
      .from('chat_group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!membership) {
      return NextResponse.json({ error: '你还不在这个群里，先申请加入' }, { status: 403 });
    }

    if (user.role === 'user') {
      const { data: me } = await supabase
        .from('users')
        .select('is_muted')
        .eq('id', user.id)
        .maybeSingle();
      if (!me) return NextResponse.json({ error: '账号不存在，请重新登录' }, { status: 401 });
      if (me.is_muted) {
        return NextResponse.json({ error: '你已被管理员禁言，暂时不能发言' }, { status: 403 });
      }
    }

    const { data: created, error } = await supabase
      .from('chat_group_messages')
      .insert({
        group_id: groupId,
        author_id: user.id || null,
        author_name: user.role === 'admin' ? '管理员' : user.username,
        content: content || null,
        image_url: imageUrl
      })
      .select('id, author_id, author_name, content, image_url, created_at')
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ message: created });
  } catch (e) {
    return NextResponse.json({ error: '发送失败：' + e.message }, { status: 500 });
  }
}
