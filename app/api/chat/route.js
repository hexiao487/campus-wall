import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';

const MAX_LEN = 500;
const PAGE_LIMIT = 100;

/** 群聊最近 100 条消息（按时间正序返回，方便前端直接渲染） */
export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, author_id, author_name, content, created_at')
      .order('created_at', { ascending: false })
      .limit(PAGE_LIMIT);

    if (error) throw new Error(error.message);
    const rows = (data || []).slice().reverse();
    return NextResponse.json({ messages: rows });
  } catch (e) {
    return NextResponse.json({ error: '加载群聊失败：' + e.message }, { status: 500 });
  }
}

/** 发群聊消息 */
export async function POST(request) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: '登录后才能发言' }, { status: 401 });
    }

    const body = await request.json();
    const content = String(body.content || '').trim();
    if (!content) {
      return NextResponse.json({ error: '说点什么再发吧' }, { status: 400 });
    }
    if (content.length > MAX_LEN) {
      return NextResponse.json({ error: `单条最多 ${MAX_LEN} 字` }, { status: 400 });
    }

    const supabase = getSupabase();

    let authorName = user.username;
    if (user.role === 'user') {
      const { data: me } = await supabase
        .from('users')
        .select('is_muted, username')
        .eq('id', user.id)
        .maybeSingle();
      if (!me) {
        return NextResponse.json({ error: '账号不存在，请重新登录' }, { status: 401 });
      }
      if (me.is_muted) {
        return NextResponse.json({ error: '你已被管理员禁言，暂时不能发言' }, { status: 403 });
      }
      authorName = me.username;
    }

    const { data: created, error } = await supabase
      .from('chat_messages')
      .insert({ author_id: user.id || null, author_name: authorName, content })
      .select('id, author_id, author_name, content, created_at')
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ message: created });
  } catch (e) {
    return NextResponse.json({ error: '发送失败：' + e.message }, { status: 500 });
  }
}
