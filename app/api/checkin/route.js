import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { readJson, writeJson } from '@/lib/store';

function dayKey(d = new Date()) {
  const x = new Date(d.getTime() + 8 * 3600 * 1000);
  return x.toISOString().slice(0, 10);
}

function diffDays(a, b) {
  const da = new Date(a + 'T00:00:00Z').getTime();
  const db = new Date(b + 'T00:00:00Z').getTime();
  return Math.round((db - da) / 86400000);
}

/** 每日签到：GET 查状态，POST 签到 */
export async function GET(request) {
  try {
    const me = await getSessionUser(request);
    if (!me?.id) return NextResponse.json({ signed: false, streak: 0, days: 0, loggedIn: false });
    const supabase = getSupabase();
    const state = await readJson(supabase, `checkin:${me.id}`, { last: '', streak: 0, days: 0 });
    const today = dayKey();
    return NextResponse.json({
      loggedIn: true,
      signed: state.last === today,
      streak: state.streak || 0,
      days: state.days || 0,
      today
    });
  } catch (e) {
    return NextResponse.json({ error: '查询失败：' + e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const me = await getSessionUser(request);
    if (!me?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const supabase = getSupabase();
    const state = await readJson(supabase, `checkin:${me.id}`, { last: '', streak: 0, days: 0 });
    const today = dayKey();
    if (state.last === today) {
      return NextResponse.json({ ok: true, already: true, streak: state.streak, days: state.days });
    }

    const streak = state.last && diffDays(state.last, today) === 1 ? (state.streak || 0) + 1 : 1;
    const next = { last: today, streak, days: (state.days || 0) + 1 };
    await writeJson(supabase, `checkin:${me.id}`, next);

    return NextResponse.json({ ok: true, streak, days: next.days });
  } catch (e) {
    return NextResponse.json({ error: '签到失败：' + e.message }, { status: 500 });
  }
}
