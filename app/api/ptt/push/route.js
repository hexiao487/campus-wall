import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { areFriends, parseChannel } from '@/lib/social';

export const runtime = 'nodejs';

/** 对讲机：推一片录音（PCM16 单声道 16kHz 的 base64） */
export async function POST(request) {
  try {
    const me = await getSessionUser(request);
    if (!me?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const body = await request.json();
    const channel = String(body.channel || '');
    const pcm = String(body.pcm || '');
    const seq = Number(body.seq) || 0;

    const parts = parseChannel(channel);
    if (!parts || !parts.includes(me.id)) {
      return NextResponse.json({ error: '频道不存在' }, { status: 403 });
    }
    if (!pcm || pcm.length > 40000) {
      return NextResponse.json({ error: '语音片太小或太大' }, { status: 400 });
    }

    const supabase = getSupabase();
    const peerId = parts[0] === me.id ? parts[1] : parts[0];
    if (!(await areFriends(supabase, me.id, peerId))) {
      return NextResponse.json({ error: '只能和好友对讲' }, { status: 403 });
    }

    const { error } = await supabase.from('ptt_chunks').insert({ channel, sender_id: me.id, seq, pcm });
    if (error) throw new Error(error.message);

    // 顺手清理 2 分钟前的分片，避免表无限增长
    await supabase
      .from('ptt_chunks')
      .delete()
      .eq('channel', channel)
      .lt('created_at', new Date(Date.now() - 120000).toISOString());

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: '发送语音失败：' + e.message }, { status: 500 });
  }
}
