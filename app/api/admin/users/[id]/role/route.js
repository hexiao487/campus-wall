import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';

/** 设为管理员 / 取消管理员（管理员） */
export async function POST(request, { params }) {
  try {
    const me = await getSessionUser(request);
    if (!me || me.role !== 'admin') {
      return NextResponse.json({ error: '只有管理员可以操作' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const role = body.role === 'admin' ? 'admin' : 'user';

    if (role === 'user' && id === me.id) {
      return NextResponse.json({ error: '不能取消自己的管理员身份' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', id)
      .select('id, username, role, is_muted')
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: '用户不存在' }, { status: 404 });

    return NextResponse.json({ user: data });
  } catch (e) {
    return NextResponse.json({ error: '操作失败：' + e.message }, { status: 500 });
  }
}
