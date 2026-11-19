import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';

const MAX_NAME = 24;
const MAX_GROUPS = 200;

/** 群列表：我的群 + 全部群（带成员数、我是否在群里、我的申请状态） */
export async function GET(request) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: '登录后才能使用群聊' }, { status: 401 });
    }
    const supabase = getSupabase();

    const { data: groups, error } = await supabase
      .from('chat_groups')
      .select('id, name, owner_id, owner_name, created_at')
      .order('created_at', { ascending: false })
      .limit(MAX_GROUPS);
    if (error) throw new Error(error.message);

    const ids = (groups || []).map((g) => g.id);

    const { data: members } = ids.length
      ? await supabase
          .from('chat_group_members')
          .select('group_id, user_id, role')
          .in('group_id', ids)
          .limit(2000)
      : { data: [] };

    const { data: requests } = ids.length
      ? await supabase
          .from('chat_group_requests')
          .select('group_id, status')
          .eq('user_id', user.id)
          .in('group_id', ids)
      : { data: [] };

    const countMap = new Map();
    const myRoles = new Map();
    (members || []).forEach((m) => {
      countMap.set(m.group_id, (countMap.get(m.group_id) || 0) + 1);
      if (m.user_id === user.id) myRoles.set(m.group_id, m.role);
    });

    const statusMap = new Map();
    (requests || []).forEach((r) => statusMap.set(r.group_id, r.status));

    const rows = (groups || []).map((g) => ({
      id: g.id,
      name: g.name,
      owner_id: g.owner_id,
      owner_name: g.owner_name,
      created_at: g.created_at,
      member_count: countMap.get(g.id) || 0,
      is_member: myRoles.has(g.id),
      is_owner: g.owner_id === user.id,
      my_role: myRoles.get(g.id) || null,
      request_status: statusMap.get(g.id) || null
    }));

    return NextResponse.json({
      mine: rows.filter((g) => g.is_member),
      others: rows.filter((g) => !g.is_member)
    });
  } catch (e) {
    return NextResponse.json({ error: '加载群列表失败：' + e.message }, { status: 500 });
  }
}

/** 创建群聊（自定义名字），创建者自动成为群主 + 第一个成员 */
export async function POST(request) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const body = await request.json();
    const name = String(body.name || '').trim();
    if (!name) {
      return NextResponse.json({ error: '给群起个名字吧' }, { status: 400 });
    }
    if (name.length > MAX_NAME) {
      return NextResponse.json({ error: `群名最多 ${MAX_NAME} 个字` }, { status: 400 });
    }

    const supabase = getSupabase();
    const ownerName = user.role === 'admin' ? '管理员' : user.username;

    const { data: group, error } = await supabase
      .from('chat_groups')
      .insert({ name, owner_id: user.id, owner_name: ownerName })
      .select('id, name, owner_id, owner_name, created_at')
      .single();
    if (error) throw new Error(error.message);

    const { error: memberError } = await supabase
      .from('chat_group_members')
      .insert({ group_id: group.id, user_id: user.id, role: 'owner' });
    if (memberError) throw new Error(memberError.message);

    return NextResponse.json({
      group: { ...group, member_count: 1, is_member: true, is_owner: true }
    });
  } catch (e) {
    return NextResponse.json({ error: '创建群失败：' + e.message }, { status: 500 });
  }
}
