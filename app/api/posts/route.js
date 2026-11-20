import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';

const PAGE_SIZE = 20;
const MAX_LEN = 1000;

/** 帖子列表（按时间倒序，支持 cursor 翻页） */
export async function GET(request) {
  try {
    const supabase = getSupabase();
    const user = await getSessionUser(request);
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor');
    const author = searchParams.get('author');

    let query = supabase
      .from('posts')
      .select('id, author_id, author_name, content, image_url, like_count, comment_count, created_at')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (author) query = query.eq('author_id', author);
    if (cursor) query = query.lt('created_at', cursor);

    const { data: posts, error } = await query;
    if (error) throw new Error(error.message);

    const rows = posts || [];

    // 回填作者角色，用于昵称后的「管理员」标记
    try {
      const ids = Array.from(new Set(rows.map((p) => p.author_id).filter(Boolean)));
      if (ids.length) {
        const { data: authors } = await supabase.from('users').select('id, role, avatar_url').in('id', ids);
        const infoMap = {};
        for (const a of authors || []) infoMap[a.id] = a;
        for (const p of rows) {
          const a = infoMap[p.author_id];
          p.author_role = a?.role || 'user';
          p.author_avatar = a?.avatar_url || null;
        }
      }
    } catch {
      /* 角色回填失败不影响帖子列表 */
    }

    // 当前用户点赞过哪些帖子
    let likedIds = [];
    if (user?.id && rows.length) {
      const { data: likes } = await supabase
        .from('likes')
        .select('post_id')
        .eq('user_id', user.id)
        .in('post_id', rows.map((p) => p.id));
      likedIds = (likes || []).map((l) => l.post_id);
    }

    return NextResponse.json({
      posts: rows,
      likedIds,
      nextCursor: rows.length === PAGE_SIZE ? rows[rows.length - 1].created_at : null
    });
  } catch (e) {
    return NextResponse.json({ error: '加载帖子失败：' + e.message }, { status: 500 });
  }
}

/** 发帖 */
export async function POST(request) {
  try {
    const supabase = getSupabase();
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: '请先登录再发帖' }, { status: 401 });
    }

    const body = await request.json();
    const content = String(body.content || '').trim();
    const imageUrl = body.imageUrl ? String(body.imageUrl).trim() : null;

    if (!content && !imageUrl) {
      return NextResponse.json({ error: '说点什么再发吧' }, { status: 400 });
    }
    if (content.length > MAX_LEN) {
      return NextResponse.json({ error: `内容最多 ${MAX_LEN} 字` }, { status: 400 });
    }

    let authorName = user.username || '同学';
    let authorRole = user.role === 'admin' ? 'admin' : 'user';
    if (user.id) {
      const { data: me } = await supabase
        .from('users')
        .select('is_muted, username, role')
        .eq('id', user.id)
        .maybeSingle();
      if (!me) {
        return NextResponse.json({ error: '账号不存在，请重新登录' }, { status: 401 });
      }
      if (me.role === 'user' && me.is_muted) {
        return NextResponse.json({ error: '你已被管理员禁言，暂时不能发帖' }, { status: 403 });
      }
      authorName = me.username;
      authorRole = me.role === 'admin' ? 'admin' : 'user';
    } else {
      authorName = '管理员';
      authorRole = 'admin';
    }

    const { data: created, error } = await supabase
      .from('posts')
      .insert({
        author_id: user.id || null,
        author_name: authorName,
        content: content || '',
        image_url: imageUrl
      })
      .select('id, author_id, author_name, content, image_url, like_count, comment_count, created_at')
      .single();

    if (error) throw new Error(error.message);

    // @ 提醒：写进消息表（kind=mention），被提到的人在消息页面能看到
    const mentionIds = Array.isArray(body.mentions) ? body.mentions : [];
    const targets = mentionIds
      .map((m) => (typeof m === 'string' ? m : m?.id))
      .filter((id) => id && id !== user.id)
      .slice(0, 10);
    if (targets.length) {
      const snippet = (content || '[图片]').slice(0, 120);
      await supabase.from('dm_messages').insert(
        targets.map((tid) => ({
          sender_id: user.id || null,
          receiver_id: tid,
          kind: 'mention',
          content: snippet,
          image_url: `/#post-${created.id}`
        }))
      );
    }

    return NextResponse.json({
      post: { ...created, author_role: authorRole, liked: false },
      mentions: targets.length
    });
  } catch (e) {
    return NextResponse.json({ error: '发布失败：' + e.message }, { status: 500 });
  }
}
