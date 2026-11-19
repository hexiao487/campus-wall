import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';

/** 群主审批加入申请：action = approve / reject */
export async function POST(request, { params }) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { id: groupId, requestId } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body.action === 'reject' ? 'reject' : 'approve';

    const supabase = getSupabase();

    const { data: group } = await supabase
      .from('chat_groups')
      .select('id, owner_id')
      .eq('id', groupId)
      .maybeSingle();
    if (!group) return NextResponse.json({ error: '群不存在或已被解散' }, { status: 404 });

    if (group.owner_id !== user.id) {
      return NextResponse.json({ error: '只有群主可以审批加入申请' }, { status: 403 });
    }

    const { data: reqRow } = await supabase
      .from('chat_group_requests')
      .select('id, user_id, status')
      .eq('id', requestId)
      .eq('group_id', groupId)
      .maybeSingle();
    if (!reqRow) return NextResponse.json({ error: '申请不存在' }, { status: 404 });
    if (reqRow.status !== 'pending') {
      return NextResponse.json({ error: '这条申请已经处理过了' }, { status: 400 });
    }

    if (action === 'reject') {
      const { error } = await supabase
        .from('chat_group_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, status: 'rejected' });
    }

    const { error: memberError } = await supabase
      .from('chat_group_members')
      .upsert({ group_id: groupId, user_id: reqRow.user_id, role: 'member' });
    if (memberError) throw new Error(memberError.message);

    const { error } = await supabase
      .from('chat_group_requests')
      .update({ status: 'approved' })
      .eq('id', requestId);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, status: 'approved' });
  } catch (e) {
    return NextResponse.json({ error: '审批失败：' + e.message }, { status: 500 });
  }
}
