import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';

/** 禁言 / 解除禁言（管理员） */
export async function POST(request, { params }) {
  try {
    const user = await getSessionUser(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: '只有管理员可以操作' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const muted = !!body.muted;

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('users')
      .update({ is_muted: muted })
      .eq('id', id)
      .select('id, username, is_muted')
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: '用户不存在' }, { status: 404 });

    return NextResponse.json({ user: data });
  } catch (e) {
    return NextResponse.json({ error: '操作失败：' + e.message }, { status: 500 });
  }
}
