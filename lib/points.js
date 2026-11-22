/** 用户等级 / 积分 / 签到（存 app_config，避免建表） */
import { readJson, writeJson } from '@/lib/store';

const KEY = 'user_points';

export const LEVELS = [
  { level: 1, name: '新芽', min: 0 },
  { level: 2, name: '常驻', min: 30 },
  { level: 3, name: '活跃', min: 100 },
  { level: 4, name: '达人', min: 300 },
  { level: 5, name: '元老', min: 800 },
  { level: 6, name: '传奇', min: 2000 }
];

export function levelOf(points = 0) {
  const p = Math.max(0, Number(points) || 0);
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i += 1) if (p >= LEVELS[i].min) idx = i;
  const cur = LEVELS[idx];
  const next = LEVELS[idx + 1] || null;
  const progress = next ? Math.min(100, Math.round(((p - cur.min) / (next.min - cur.min)) * 100)) : 100;
  return { points: p, level: cur.level, name: cur.name, next: next?.min ?? null, need: next ? next.min - p : 0, progress };
}

export function scoreOf(record) {
  const points = Number(record?.points) || 0;
  return levelOf(points);
}

/** 中国时区 YYYY-MM-DD */
export function todayCN(offsetDays = 0) {
  const now = new Date(Date.now() + 8 * 3600 * 1000 + offsetDays * 86400 * 1000);
  return now.toISOString().slice(0, 10);
}

export async function getAllPoints(supabase) {
  const raw = await readJson(supabase, KEY, {});
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

export async function getUserRecord(supabase, uid) {
  if (!uid) return { points: 0, checkin: { last: '', streak: 0, total: 0 } };
  const all = await getAllPoints(supabase);
  const rec = all[uid] || {};
  return {
    points: Number(rec.points) || 0,
    checkin: {
      last: rec.checkin?.last || '',
      streak: Number(rec.checkin?.streak) || 0,
      total: Number(rec.checkin?.total) || 0
    }
  };
}

export async function addPoints(supabase, uid, delta = 1) {
  if (!uid || !delta) return null;
  try {
    const all = await getAllPoints(supabase);
    const rec = all[uid] || { points: 0, checkin: { last: '', streak: 0, total: 0 } };
    rec.points = Math.max(0, (Number(rec.points) || 0) + delta);
    all[uid] = rec;
    await writeJson(supabase, KEY, all);
    return levelOf(rec.points);
  } catch {
    return null;
  }
}

/** 每日签到：同一天只能一次；连续 7 天额外奖励 */
export async function doCheckin(supabase, uid) {
  const all = await getAllPoints(supabase);
  const rec = all[uid] || { points: 0, checkin: { last: '', streak: 0, total: 0 } };
  const today = todayCN();
  const yesterday = todayCN(-1);

  if (rec.checkin?.last === today) {
    return { ok: false, already: true, earned: 0, streak: rec.checkin?.streak || 0, score: levelOf(rec.points) };
  }

  const streak = rec.checkin?.last === yesterday ? (Number(rec.checkin.streak) || 0) + 1 : 1;
  const earned = 3 + (streak % 7 === 0 ? 10 : 0);
  rec.points = Math.max(0, (Number(rec.points) || 0) + earned);
  rec.checkin = {
    last: today,
    streak,
    total: (Number(rec.checkin?.total) || 0) + 1,
    best: Math.max(Number(rec.checkin?.best) || 0, streak)
  };
  all[uid] = rec;
  await writeJson(supabase, KEY, all);
  return { ok: true, earned, streak, score: levelOf(rec.points) };
}
