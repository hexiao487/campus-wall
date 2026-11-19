import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { areFriends, parseChannel } from '@/lib/social';

export const runtime = 'nodejs';

/** 对讲机：拉取频道里新到的语音片（cursor 为上次拿到的最大 id） */
export async function GET(request) {
  try {
    const me = await getSessionUser(request);
    if (!me?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const channel = searchParams.get('channel') || '';
    const cursor = Number(searchParams.get('cursor') || 0);

    const parts = parseChannel(channel);
    if (!parts || !parts.includes(me.id)) {
      return NextResponse.json({ error: '频道不存在' }, { status: 403 });
    }

    const supabase = getSupabase();
    const peerId = parts[0] === me.id ? parts[1] : parts[0];
    if (!(await areFriends(supabase, me.id, peerId))) {
      return NextResponse.json({ error: '只能和好友对讲' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('ptt_chunks')
      .select('id, sender_id, seq, pcm, created_at')
      .eq('channel', channel)
      .gt('id', cursor)
      .order('id', { ascending: true })
      .limit(80);

    if (error) throw new Error(error.message);

    const rows = data || [];
    return NextResponse.json({
      chunks: rows.filter((r) => r.sender_id !== me.id),
      cursor: rows.length ? rows[rows.length - 1].id : cursor,
      peerId
    });
  } catch (e) {
    return NextResponse.json({ error: '接收语音失败：' + e.message }, { status: 500 });
  }
}
