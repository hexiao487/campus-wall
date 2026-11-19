import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';

/** 撤回群聊消息：管理员可撤回任意消息，作者可撤回自己的 */
export async function DELETE(request, { params }) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabase();

    const { data: msg } = await supabase
      .from('chat_messages')
      .select('id, author_id')
      .eq('id', id)
      .maybeSingle();

    if (!msg) {
      return NextResponse.json({ error: '消息不存在或已被撤回' }, { status: 404 });
    }

    const isAdmin = user.role === 'admin';
    const isAuthor = Boolean(user.id) && msg.author_id === user.id;
    if (!isAdmin && !isAuthor) {
      return NextResponse.json({ error: '只能撤回自己的消息' }, { status: 403 });
    }

    const { error } = await supabase.from('chat_messages').delete().eq('id', id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: '撤回失败：' + e.message }, { status: 500 });
  }
}
