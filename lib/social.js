import { getSupabase } from '@/lib/supabase';

/**
 * 计算「我」与目标用户的关系：是否关注、是否好友、是否有待处理申请。
 * 统一在这里处理，避免各接口重复写查询。
 */
export async function relationship(supabase, meId, targetId) {
  if (!meId || !targetId || meId === targetId) {
    return { following: false, followedBy: false, friend: false, pendingOut: false, pendingIn: false };
  }

  const [followA, followB, friendA, friendB] = await Promise.all([
    supabase.from('follows').select('follower_id').eq('follower_id', meId).eq('following_id', targetId).maybeSingle(),
    supabase.from('follows').select('follower_id').eq('follower_id', targetId).eq('following_id', meId).maybeSingle(),
    supabase.from('friend_requests').select('id, status').eq('from_id', meId).eq('to_id', targetId).maybeSingle(),
    supabase.from('friend_requests').select('id, status').eq('from_id', targetId).eq('to_id', meId).maybeSingle()
  ]);

  const out = friendA.data;
  const inn = friendB.data;

  return {
    following: !!followA.data,
    followedBy: !!followB.data,
    friend: out?.status === 'accepted' || inn?.status === 'accepted',
    pendingOut: out?.status === 'pending',
    pendingIn: inn?.status === 'pending'
  };
}

/** 判断两人是否好友 */
export async function areFriends(supabase, a, b) {
  if (!a || !b) return false;
  const { data } = await supabase
    .from('friend_requests')
    .select('status')
    .or(`and(from_id.eq.${a},to_id.eq.${b}),and(from_id.eq.${b},to_id.eq.${a})`)
    .eq('status', 'accepted')
    .limit(1);
  return !!(data && data.length);
}

/** 对讲机频道名（两人 id 排序后拼接，双方算出的频道一致） */
export function channelOf(a, b) {
  return [a, b].sort().join('_');
}

/** 解析频道名，返回两端用户 id */
export function parseChannel(channel) {
  const parts = String(channel || '').split('_');
  if (parts.length !== 2) return null;
  const [a, b] = parts;
  if (!a || !b) return null;
  return [a, b];
}

/** 批量取用户资料，用于会话列表/消息列表友好显示 */
export async function usersByIds(supabase, ids) {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (!uniq.length) return {};
  const { data } = await supabase.from('users').select('id, username, role, avatar_url').in('id', uniq);
  const map = {};
  for (const u of data || []) map[u.id] = u;
  return map;
}
