import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { usersByIds } from '@/lib/social';

/** 关注列表：?scope=following 我关注的 / ?scope=followers 关注我的 */
export async function GET(request) {
  try {
    const me = await getSessionUser(request);
    if (!me?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') === 'followers' ? 'followers' : 'following';
    const supabase = getSupabase();

    const key = scope === 'followers' ? 'follower_id' : 'following_id';
    const match = scope === 'followers' ? me.id : me.id;
    const { data: rows, error } = await supabase
      .from('follows')
      .select('follower_id, following_id')
      .eq(scope === 'followers' ? 'following_id' : 'follower_id', match)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw new Error(error.message);

    const ids = (rows || []).map((r) => (scope === 'followers' ? r.follower_id : r.following_id));
    const map = await usersByIds(supabase, ids);

    return NextResponse.json({ users: ids.map((id) => map[id]).filter(Boolean) });
  } catch (e) {
    return NextResponse.json({ error: '加载关注列表失败：' + e.message }, { status: 500 });
  }
}

/** 关注 / 取消关注 */
export async function POST(request) {
  try {
    const me = await getSessionUser(request);
    if (!me?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const body = await request.json();
    const targetId = String(body.targetId || '');
    const follow = body.follow !== false;
    if (!targetId || targetId === me.id) {
      return NextResponse.json({ error: '参数不对' }, { status: 400 });
    }

    const supabase = getSupabase();
    if (follow) {
      const { error } = await supabase
        .from('follows')
        .upsert({ follower_id: me.id, following_id: targetId }, { onConflict: 'follower_id,following_id' });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', me.id)
        .eq('following_id', targetId);
      if (error) throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, following: follow });
  } catch (e) {
    return NextResponse.json({ error: '操作失败：' + e.message }, { status: 500 });
  }
}
