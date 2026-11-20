import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { usersByIds } from '@/lib/social';

/** 提到我的（@提醒）：列表 GET，标记已读 POST */
export async function GET(request) {
  try {
    const me = await getSessionUser(request);
    if (!me?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('dm_messages')
      .select('id, sender_id, content, image_url, read_at, created_at')
      .eq('receiver_id', me.id)
      .eq('kind', 'mention')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    const rows = data || [];
    const map = await usersByIds(supabase, [...new Set(rows.map((r) => r.sender_id).filter(Boolean))]);

    return NextResponse.json({
      mentions: rows.map((r) => ({
        id: r.id,
        from: map[r.sender_id] || { id: r.sender_id, username: '有人' },
        snippet: r.content || '',
        link: r.image_url || '/',
        read: Boolean(r.read_at),
        createdAt: r.created_at
      })),
      unread: rows.filter((r) => !r.read_at).length
    });
  } catch (e) {
    return NextResponse.json({ error: '加载提醒失败：' + e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const me = await getSessionUser(request);
    if (!me?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const supabase = getSupabase();
    const { error } = await supabase
      .from('dm_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('receiver_id', me.id)
      .eq('kind', 'mention')
      .is('read_at', null);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: '操作失败：' + e.message }, { status: 500 });
  }
}
