import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { getAllPoints, levelOf, LEVELS } from '@/lib/points';
import { writeJson } from '@/lib/store';

/** 管理员设置用户积分（用于发放等级奖励 / 内部调整） */
export async function POST(request) {
  try {
    const user = await getSessionUser(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: '只有管理员可以调整积分' }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : (body.id ? [body.id] : []);
    const points = Number(body.points);
    if (!ids.length) return NextResponse.json({ error: '缺少用户 id' }, { status: 400 });
    if (!Number.isFinite(points) || points < 0) return NextResponse.json({ error: '积分不合法' }, { status: 400 });

    const supabase = getSupabase();
    const all = await getAllPoints(supabase);
    const result = [];
    for (const uid of ids) {
      const rec = all[uid] || { points: 0, checkin: { last: '', streak: 0, total: 0 } };
      rec.points = Math.round(points);
      all[uid] = rec;
      const score = levelOf(rec.points);
      result.push({ id: uid, points: score.points, level: score.level, name: score.name });
    }
    await writeJson(supabase, 'user_points', all);
    return NextResponse.json({ ok: true, levels: LEVELS.map(l => l.name), result });
  } catch (e) {
    return NextResponse.json({ error: '调整积分失败：' + e.message }, { status: 500 });
  }
}
