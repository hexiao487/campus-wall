import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { usersByIds } from '@/lib/social';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const TICK = 2000;
const HOLD = 24000;

function preview(m) {
  if (m.kind === 'image') return '[图片]';
  if (m.kind === 'audio') return '[语音]';
  if (m.kind === 'ptt_invite') return '[对讲机邀请]';
  return (m.content || '').slice(0, 120);
}

/**
 * 私信长轮询：客户端带上 since，服务器最多挂 24 秒，等不到新消息就返回空。
 * 有新消息立刻返回，客户端收到后马上再发起下一次请求 → 近似实时。
 */
export async function GET(request) {
  try {
    const me = await getSessionUser(request);
    if (!me?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const supabase = getSupabase();
    const url = new URL(request.url);
    let since = url.searchParams.get('since') || '';

    if (url.searchParams.get('debug')) {
      const { data, error } = await supabase
        .from('dm_messages')
        .select('id, created_at, kind')
        .eq('receiver_id', me.id)
        .order('created_at', { ascending: false })
        .limit(3);
      return NextResponse.json({ meId: me.id, count: data?.length || 0, rows: data || [], error: error?.message || null });
    }

    const latest = async () => {
      const { data } = await supabase
        .from('dm_messages')
        .select('created_at')
        .eq('receiver_id', me.id)
        .order('created_at', { ascending: false })
        .limit(1);
      return data?.[0]?.created_at || new Date().toISOString();
    };

    // 桥接请求：只返回数据库里的最新水位，客户端拿到后立刻进入长轮询
    if (url.searchParams.get('bridge')) {
      return NextResponse.json({ messages: [], since: await latest() });
    }

    if (!since || Number.isNaN(new Date(since).getTime())) {
      since = await latest();
    }

    const startedAt = Date.now();
    const sinceMs = new Date(since).getTime();
    let rows = null;

    while (Date.now() - startedAt < HOLD) {
      const { data, error } = await supabase
        .from('dm_messages')
        .select('id, sender_id, kind, content, created_at')
        .eq('receiver_id', me.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw new Error(error.message);

      // 时间比较放在 JS 里做，避免数据库时间精度 / 时区差异导致漏消息
      const fresh = (data || [])
        .filter((m) => m.kind !== 'mention' && new Date(m.created_at).getTime() > sinceMs)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      if (fresh.length) {
        rows = fresh;
        break;
      }
      await new Promise((r) => setTimeout(r, TICK));
    }

    if (!rows) {
      return NextResponse.json({ messages: [], since });
    }

    const map = await usersByIds(supabase, rows.map((m) => m.sender_id));
    const messages = rows
      .filter((m) => map[m.sender_id])
      .map((m) => ({
        id: m.id,
        content: preview(m),
        kind: m.kind,
        at: m.created_at,
        peer: {
          id: map[m.sender_id].id,
          username: map[m.sender_id].username,
          role: map[m.sender_id].role,
          avatar_url: map[m.sender_id].avatar_url || null
        }
      }));

    return NextResponse.json({ messages, since: rows[rows.length - 1].created_at });
  } catch (e) {
    return NextResponse.json({ error: '监听失败：' + e.message }, { status: 500 });
  }
}
