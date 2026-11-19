import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';

/** 撤回群消息：群主、站内管理员或作者本人可撤回 */
export async function DELETE(request, { params }) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { id: groupId, messageId } = await params;
    const supabase = getSupabase();

    const { data: msg } = await supabase
      .from('chat_group_messages')
      .select('id, author_id')
      .eq('id', messageId)
      .eq('group_id', groupId)
      .maybeSingle();
    if (!msg) return NextResponse.json({ error: '消息不存在或已被撤回' }, { status: 404 });

    const { data: group } = await supabase
      .from('chat_groups')
      .select('owner_id')
      .eq('id', groupId)
      .maybeSingle();

    const isSiteAdmin = user.role === 'admin';
    const isOwner = group?.owner_id === user.id;
    const isAuthor = Boolean(user.id) && msg.author_id === user.id;

    if (!isSiteAdmin && !isOwner && !isAuthor) {
      return NextResponse.json({ error: '只能撤回自己的消息' }, { status: 403 });
    }

    const { error } = await supabase.from('chat_group_messages').delete().eq('id', messageId);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: '撤回失败：' + e.message }, { status: 500 });
  }
}
