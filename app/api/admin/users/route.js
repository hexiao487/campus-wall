import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';

function ensureAdmin(user) {
  if (!user || user.role !== 'admin') return false;
  return true;
}

/** 用户列表（管理员） */
export async function GET(request) {
  try {
    const user = await getSessionUser(request);
    if (!ensureAdmin(user)) {
      return NextResponse.json({ error: '只有管理员可以查看' }, { status: 403 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('users')
      .select('id, username, role, is_muted, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);
    return NextResponse.json({ users: data || [] });
  } catch (e) {
    return NextResponse.json({ error: '加载用户失败：' + e.message }, { status: 500 });
  }
}
