import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';

/** 群详情：成员才能看消息；群主额外拿到待审批的加入申请 */
export async function GET(request, { params }) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: '登录后才能查看群聊' }, { status: 401 });
    }
    const { id } = await params;
    const supabase = getSupabase();

    const { data: group, error } = await supabase
      .from('chat_groups')
      .select('id, name, owner_id, owner_name, created_at')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!group) return NextResponse.json({ error: '群不存在或已被解散' }, { status: 404 });

    const { data: membership } = await supabase
      .from('chat_group_members')
      .select('role')
      .eq('group_id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    const { count: memberCount } = await supabase
      .from('chat_group_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('group_id', id);

    const isOwner = group.owner_id === user.id;
    const isMember = Boolean(membership) || isOwner;

    if (!isMember) {
      return NextResponse.json(
        { error: '加入这个群之后才能查看聊天', group: { ...group, member_count: memberCount || 0 }, is_member: false },
        { status: 403 }
      );
    }

    const { data: messages } = await supabase
      .from('chat_group_messages')
      .select('id, author_id, author_name, content, image_url, created_at')
      .eq('group_id', id)
      .order('created_at', { ascending: false })
      .limit(100);

    const rows = (messages || []).slice().reverse();

    let requests = [];
    if (isOwner) {
      const { data } = await supabase
        .from('chat_group_requests')
        .select('id, user_id, user_name, created_at')
        .eq('group_id', id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(50);
      requests = data || [];
    }

    return NextResponse.json({
      group: { ...group, member_count: memberCount || 0 },
      is_owner: isOwner,
      is_member: true,
      messages: rows,
      requests
    });
  } catch (e) {
    return NextResponse.json({ error: '加载群失败：' + e.message }, { status: 500 });
  }
}
