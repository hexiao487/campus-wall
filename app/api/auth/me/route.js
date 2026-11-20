import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';

/** 当前登录状态 + 是否被禁言 */
export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ user: null });

  let isMuted = false;
  let avatarUrl = null;
  if (user.id) {
    try {
      const { data } = await getSupabase()
        .from('users')
        .select('is_muted, avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      isMuted = !!data?.is_muted;
      avatarUrl = data?.avatar_url || null;
    } catch {
      isMuted = false;
    }
  }

  return NextResponse.json({ user: { ...user, isMuted, avatar_url: avatarUrl } });
}
