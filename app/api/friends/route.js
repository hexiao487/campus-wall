import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { usersByIds } from '@/lib/social';

/** 好友中心数据：我的好友 / 收到申请 / 发出申请 */
export async function GET(request) {
  try {
    const me = await getSessionUser(request);
    if (!me?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const supabase = getSupabase();
    const { data: rows, error } = await supabase
      .from('friend_requests')
      .select('id, from_id, to_id, status, created_at')
      .or(`from_id.eq.${me.id},to_id.eq.${me.id}`)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);

    const all = rows || [];
    const accepted = all.filter((r) => r.status === 'accepted');
    const incoming = all.filter((r) => r.status === 'pending' && r.to_id === me.id);
    const outgoing = all.filter((r) => r.status === 'pending' && r.from_id === me.id);

    const map = await usersByIds(supabase, [
      ...accepted.map((r) => (r.from_id === me.id ? r.to_id : r.from_id)),
      ...incoming.map((r) => r.from_id),
      ...outgoing.map((r) => r.to_id)
    ]);

    const friends = accepted
      .map((r) => {
        const id = r.from_id === me.id ? r.to_id : r.from_id;
        const u = map[id];
        return u ? { ...u, since: r.created_at } : null;
      })
      .filter(Boolean);

    return NextResponse.json({
      friends,
      incoming: incoming.map((r) => ({ requestId: r.id, createdAt: r.created_at, user: map[r.from_id] })).filter((x) => x.user),
      outgoing: outgoing.map((r) => ({ requestId: r.id, createdAt: r.created_at, user: map[r.to_id] })).filter((x) => x.user)
    });
  } catch (e) {
    return NextResponse.json({ error: '加载好友失败：' + e.message }, { status: 500 });
  }
}

/** 好友申请相关操作 */
export async function POST(request) {
  try {
    const me = await getSessionUser(request);
    if (!me?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const body = await request.json();
    const action = String(body.action || '');
    const supabase = getSupabase();

    if (action === 'request') {
      const toId = String(body.to || '');
      if (!toId || toId === me.id) return NextResponse.json({ error: '参数不对' }, { status: 400 });

      const { data: existing } = await supabase
        .from('friend_requests')
        .select('id, from_id, to_id, status')
        .or(`and(from_id.eq.${me.id},to_id.eq.${toId}),and(from_id.eq.${toId},to_id.eq.${me.id})`)
        .limit(1)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'accepted') {
          return NextResponse.json({ ok: true, status: 'already_friends' });
        }
        if (existing.status === 'pending' && existing.to_id !== me.id) {
          return NextResponse.json({ error: '对方已经向你发过申请，去「好友申请」里同意就行' }, { status: 409 });
        }
        // 之前被拒或自己重复发：直接改成 pending 重发
        const { error } = await supabase
          .from('friend_requests')
          .update({ status: 'pending', from_id: me.id, to_id: toId, created_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true, status: 'pending' });
      }

      const { error } = await supabase
        .from('friend_requests')
        .insert({ from_id: me.id, to_id: toId, status: 'pending' });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, status: 'pending' });
    }

    if (action === 'accept' || action === 'reject') {
      const requestId = String(body.requestId || '');
      if (!requestId) return NextResponse.json({ error: '参数不对' }, { status: 400 });

      if (action === 'accept') {
        const { error } = await supabase
          .from('friend_requests')
          .update({ status: 'accepted' })
          .eq('id', requestId)
          .eq('to_id', me.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from('friend_requests')
          .delete()
          .eq('id', requestId)
          .eq('to_id', me.id);
        if (error) throw new Error(error.message);
      }
      return NextResponse.json({ ok: true });
    }

    if (action === 'cancel') {
      const toId = String(body.to || '');
      const { error } = await supabase
        .from('friend_requests')
        .delete()
        .eq('from_id', me.id)
        .eq('to_id', toId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }

    if (action === 'remove') {
      const targetId = String(body.to || '');
      if (!targetId) return NextResponse.json({ error: '参数不对' }, { status: 400 });
      const { error } = await supabase
        .from('friend_requests')
        .delete()
        .or(`and(from_id.eq.${me.id},to_id.eq.${targetId}),and(from_id.eq.${targetId},to_id.eq.${me.id})`);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: '操作失败：' + e.message }, { status: 500 });
  }
}
