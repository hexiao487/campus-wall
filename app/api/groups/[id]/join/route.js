import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';

/** 申请加入群聊（需要群主同意） */
export async function POST(request, { params }) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabase();

    const { data: group } = await supabase
      .from('chat_groups')
      .select('id, owner_id, name')
      .eq('id', id)
      .maybeSingle();
    if (!group) return NextResponse.json({ error: '群不存在或已被解散' }, { status: 404 });

    const { data: membership } = await supabase
      .from('chat_group_members')
      .select('user_id')
      .eq('group_id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (membership) {
      return NextResponse.json({ error: '你已经在这个群里了' }, { status: 400 });
    }

    const userName = user.role === 'admin' ? '管理员' : user.username;

    const { data: existing } = await supabase
      .from('chat_group_requests')
      .select('id, status')
      .eq('group_id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing?.status === 'pending') {
      return NextResponse.json({ error: '已经申请了，等群主同意吧' }, { status: 400 });
    }

    if (existing) {
      const { error } = await supabase
        .from('chat_group_requests')
        .update({ status: 'pending', user_name: userName, created_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from('chat_group_requests')
        .insert({ group_id: id, user_id: user.id, user_name: userName, status: 'pending' });
      if (error) throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, status: 'pending' });
  } catch (e) {
    return NextResponse.json({ error: '申请失败：' + e.message }, { status: 500 });
  }
}
