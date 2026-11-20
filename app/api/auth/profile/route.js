import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser, signSession, setSessionCookie } from '@/lib/auth';

const NAME_RE = /^[\p{L}\p{N}_\-]{2,20}$/u;

/** 修改昵称 / 头像 */
export async function PATCH(request) {
  try {
    const me = await getSessionUser(request);
    if (!me) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    if (!me.id) {
      return NextResponse.json({ error: '管理员账号不支持在这里改资料' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const supabase = getSupabase();
    const patch = {};

    if (body.username !== undefined) {
      const username = String(body.username || '').trim();
      if (!NAME_RE.test(username)) {
        return NextResponse.json({ error: '昵称需 2-20 位，可用中文、字母、数字、_ 和 -' }, { status: 400 });
      }
      const { data: exists } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .neq('id', me.id)
        .maybeSingle();
      if (exists) return NextResponse.json({ error: '这个昵称已经有人用了' }, { status: 409 });
      patch.username = username;
    }

    if (body.avatar_url !== undefined) {
      const url = String(body.avatar_url || '').trim();
      if (url && !/^https?:\/\//.test(url)) {
        return NextResponse.json({ error: '头像地址不合法' }, { status: 400 });
      }
      patch.avatar_url = url || null;
    }

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: '没有要修改的内容' }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from('users')
      .update(patch)
      .eq('id', me.id)
      .select('id, username, role, avatar_url, is_muted')
      .single();
    if (error) throw new Error(error.message);

    const token = await signSession({ sub: updated.id, username: updated.username, role: updated.role });
    const res = NextResponse.json({
      user: { id: updated.id, username: updated.username, role: updated.role, avatar_url: updated.avatar_url, isMuted: updated.is_muted }
    });
    return setSessionCookie(res, token);
  } catch (e) {
    return NextResponse.json({ error: '修改失败：' + e.message }, { status: 500 });
  }
}
