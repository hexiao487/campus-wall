import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { areFriends, usersByIds } from '@/lib/social';

const PAGE = 30;

/** 会话列表（不带 with 参数） / 与某人的聊天记录（带 with 参数） */
export async function GET(request) {
  try {
    const me = await getSessionUser(request);
    if (!me?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const withId = searchParams.get('with');
    const cursor = searchParams.get('cursor');
    const supabase = getSupabase();

    if (!withId) {
      const { data: rows, error } = await supabase
        .from('dm_messages')
        .select('id, sender_id, receiver_id, kind, content, image_url, audio_url, audio_seconds, read_at, created_at')
        .or(`sender_id.eq.${me.id},receiver_id.eq.${me.id}`)
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw new Error(error.message);

      const convMap = {};
      const unread = {};
      for (const m of rows || []) {
        const peer = m.sender_id === me.id ? m.receiver_id : m.sender_id;
        if (!convMap[peer]) convMap[peer] = m;
        if (m.receiver_id === me.id && !m.read_at) unread[peer] = (unread[peer] || 0) + 1;
      }

      const peers = Object.keys(convMap);
      const map = await usersByIds(supabase, peers);
      const preview = (m) => {
        if (m.kind === 'image') return '[图片]';
        if (m.kind === 'audio') return `[语音 ${m.audio_seconds || 1}" ]`;
        if (m.kind === 'ptt_invite') return '[对讲机邀请]';
        return m.content || '';
      };

      return NextResponse.json({
        conversations: peers
          .map((p) => ({
            peer: map[p] || { id: p, username: '未知用户' },
            lastMessage: preview(convMap[p]),
            lastAt: convMap[p].created_at,
            lastFromMe: convMap[p].sender_id === me.id,
            unread: unread[p] || 0
          }))
          .sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt))
      });
    }

    if (withId === me.id) return NextResponse.json({ messages: [], peer: null });

    let query = supabase
      .from('dm_messages')
      .select('id, sender_id, receiver_id, kind, content, image_url, audio_url, audio_seconds, read_at, created_at')
      .or(
        `and(sender_id.eq.${me.id},receiver_id.eq.${withId}),and(sender_id.eq.${withId},receiver_id.eq.${me.id})`
      )
      .order('created_at', { ascending: false })
      .limit(PAGE);
    if (cursor) query = query.lt('created_at', cursor);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    // 把对方发来的未读消息标记为已读
    const unreadIds = (rows || []).filter((m) => m.receiver_id === me.id && !m.read_at).map((m) => m.id);
    if (unreadIds.length) {
      await supabase.from('dm_messages').update({ read_at: new Date().toISOString() }).in('id', unreadIds);
    }

    const map = await usersByIds(supabase, [withId]);
    const list = (rows || []).slice().reverse();
    return NextResponse.json({
      messages: list,
      peer: map[withId] || null,
      nextCursor: rows?.length === PAGE ? rows[rows.length - 1].created_at : null
    });
  } catch (e) {
    return NextResponse.json({ error: '加载私信失败：' + e.message }, { status: 500 });
  }
}

/** 发送私信 */
export async function POST(request) {
  try {
    const me = await getSessionUser(request);
    if (!me?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const body = await request.json();
    const to = String(body.to || '');
    const kind = ['text', 'image', 'audio', 'ptt_invite'].includes(body.kind) ? body.kind : 'text';
    const content = body.content == null ? null : String(body.content).slice(0, 1000);
    const imageUrl = body.imageUrl ? String(body.imageUrl) : null;
    const audioUrl = body.audioUrl ? String(body.audioUrl) : null;
    const audioSeconds = body.audioSeconds ? Math.max(1, Math.min(300, Number(body.audioSeconds) || 1)) : null;

    if (!to || to === me.id) return NextResponse.json({ error: '参数不对' }, { status: 400 });
    if (kind === 'text' && !content?.trim()) return NextResponse.json({ error: '说点什么再发吧' }, { status: 400 });
    if (kind === 'image' && !imageUrl) return NextResponse.json({ error: '图片没上传成功' }, { status: 400 });
    if (kind === 'audio' && !audioUrl) return NextResponse.json({ error: '语音没上传成功' }, { status: 400 });

    const supabase = getSupabase();
    if (!(await areFriends(supabase, me.id, to))) {
      return NextResponse.json({ error: '加为好友之后才能私信哦' }, { status: 403 });
    }

    const { data: muted } = await supabase.from('users').select('is_muted').eq('id', me.id).maybeSingle();
    if (muted?.is_muted) {
      return NextResponse.json({ error: '你已被禁言，暂时不能发消息' }, { status: 403 });
    }

    const { data: created, error } = await supabase
      .from('dm_messages')
      .insert({
        sender_id: me.id,
        receiver_id: to,
        kind,
        content: content?.trim() || null,
        image_url: imageUrl,
        audio_url: audioUrl,
        audio_seconds: audioSeconds
      })
      .select('id, sender_id, receiver_id, kind, content, image_url, audio_url, audio_seconds, created_at')
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ message: created });
  } catch (e) {
    return NextResponse.json({ error: '发送失败：' + e.message }, { status: 500 });
  }
}
