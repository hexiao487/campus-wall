import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { usersByIds } from '@/lib/social';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const TICK = 4000;
const LIFE = 52000;

function preview(m) {
  if (m.kind === 'image') return '[图片]';
  if (m.kind === 'audio') return '[语音]';
  if (m.kind === 'ptt_invite') return '[对讲机邀请]';
  return (m.content || '').slice(0, 120);
}

/** 私信实时推送（SSE）：新消息几秒内推到前端，断线由 EventSource 自动重连 */
export async function GET(request) {
  const me = await getSessionUser(request);
  if (!me?.id) return new Response('unauthorized', { status: 401 });

  const supabase = getSupabase();

  let watermark = new Date().toISOString();
  try {
    const { data } = await supabase
      .from('dm_messages')
      .select('created_at')
      .eq('receiver_id', me.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.created_at) watermark = data.created_at;
  } catch {
    /* 用当前时间兜底 */
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event, payload) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
        } catch {
          closed = true;
        }
      };

      send('ready', { ok: true });

      const startedAt = Date.now();
      while (!closed && Date.now() - startedAt < LIFE) {
        if (request.signal?.aborted) break;
        await new Promise((r) => setTimeout(r, TICK));
        if (closed) break;

        try {
          const { data } = await supabase
            .from('dm_messages')
            .select('id, sender_id, kind, content, image_url, audio_url, created_at')
            .eq('receiver_id', me.id)
            .gt('created_at', watermark)
            .neq('kind', 'mention')
            .order('created_at', { ascending: true })
            .limit(20);

          if (data?.length) {
            watermark = data[data.length - 1].created_at;
            const map = await usersByIds(supabase, data.map((m) => m.sender_id));
            for (const m of data) {
              const peer = map[m.sender_id];
              if (!peer) continue;
              send('dm', {
                id: m.id,
                peer: { id: peer.id, username: peer.username, role: peer.role, avatar_url: peer.avatar_url || null },
                content: preview(m),
                kind: m.kind,
                at: m.created_at
              });
            }
          } else {
            send('ping', { t: Date.now() });
          }
        } catch {
          send('ping', { t: Date.now() });
        }
      }

      closed = true;
      try {
        controller.close();
      } catch {
        /* 已关闭 */
      }
    },
    cancel() {
      closed = true;
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
}
