import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser, clearSessionCookie } from '@/lib/auth';

/** 注销账号：需要密码确认，删除账号本身（帖子保留） */
export async function DELETE(request) {
  try {
    const me = await getSessionUser(request);
    if (!me) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    if (!me.id) {
      return NextResponse.json({ error: '管理员账号不能注销' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const password = String(body.password || '');
    if (!password) return NextResponse.json({ error: '请输入密码确认' }, { status: 400 });

    const supabase = getSupabase();
    const { data: user } = await supabase
      .from('users')
      .select('id, password_hash')
      .eq('id', me.id)
      .maybeSingle();
    if (!user) return NextResponse.json({ error: '账号不存在' }, { status: 404 });

    const ok = await bcrypt.compare(password, user.password_hash || '');
    if (!ok) return NextResponse.json({ error: '密码不正确' }, { status: 403 });

    // 清理个人关联数据，失败不影响注销
    for (const [table, col] of [
      ['likes', 'user_id'],
      ['follows', 'follower_id'],
      ['follows', 'following_id'],
      ['comments', 'author_id'],
      ['dm_messages', 'sender_id']
    ]) {
      try {
        await supabase.from(table).delete().eq(col, me.id);
      } catch {
        /* 忽略 */
      }
    }

    const { error } = await supabase.from('users').delete().eq('id', me.id);
    if (error) throw new Error(error.message);

    return clearSessionCookie(NextResponse.json({ ok: true }));
  } catch (e) {
    return NextResponse.json({ error: '注销失败：' + e.message }, { status: 500 });
  }
}
