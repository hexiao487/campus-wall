import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { doCheckin, getAllPoints, getUserRecord, scoreOf, todayCN } from '@/lib/points';

/** 我的等级 / 积分 / 签到状态，或查某个用户的等级 */
export async function GET(request) {
  try {
    const supabase = getSupabase();
    const me = await getSessionUser(request);
    const url = new URL(request.url);
    const target = url.searchParams.get('id') || me?.id;

    if (!target) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const [rec, all] = await Promise.all([getUserRecord(supabase, target), getAllPoints(supabase)]);
    const score = scoreOf(rec);
    const isMe = Boolean(me?.id) && me.id === target;

    const rank = Object.entries(all)
      .map(([id, r]) => ({ id, points: Number(r?.points) || 0 }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 10)
      .map((r, i) => ({ ...r, rank: i + 1, score: scoreOf(r) }));

    return NextResponse.json({
      ...score,
      isMe,
      checkin: {
        ...rec.checkin,
        todayDone: rec.checkin?.last === todayCN(),
        today: todayCN()
      },
      rank
    });
  } catch (e) {
    return NextResponse.json({ error: '加载积分失败：' + e.message }, { status: 500 });
  }
}

/** 每日签到 */
export async function POST(request) {
  try {
    const me = await getSessionUser(request);
    if (!me?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    if (String(body.action || '') !== 'checkin') {
      return NextResponse.json({ error: '不支持的操作' }, { status: 400 });
    }

    const supabase = getSupabase();
    const result = await doCheckin(supabase, me.id);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: '签到失败：' + e.message }, { status: 500 });
  }
}
