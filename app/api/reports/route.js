import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { readJson, writeJson, } from '@/lib/store';

const KEY = 'reports';

/** 举报：POST 提交；GET（管理员）列表；PATCH 处理结果 */
export async function POST(request) {
  try {
    const me = await getSessionUser(request);
    if (!me?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const postId = String(body.postId || '');
    const reason = String(body.reason || '').trim().slice(0, 120);
    if (!postId) return NextResponse.json({ error: '缺少帖子 id' }, { status: 400 });

    const supabase = getSupabase();
    const list = await readJson(supabase, KEY, []);
    const arr = Array.isArray(list) ? list : [];

    if (arr.some((r) => r.postId === postId && r.by === me.id && !r.done)) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const report = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      postId,
      reason: reason || '未填写理由',
      by: me.id,
      byName: me.username,
      at: new Date().toISOString(),
      done: false
    };
    await writeJson(supabase, KEY, [report, ...arr].slice(0, 300));
    return NextResponse.json({ ok: true, report });
  } catch (e) {
    return NextResponse.json({ error: '举报失败：' + e.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const me = await getSessionUser(request);
    if (!me || me.role !== 'admin') return NextResponse.json({ error: '只有管理员可以查看' }, { status: 403 });

    const supabase = getSupabase();
    const list = await readJson(supabase, KEY, []);
    const arr = Array.isArray(list) ? list : [];

    const ids = Array.from(new Set(arr.filter((r) => !r.done).map((r) => r.postId)));
    let posts = [];
    if (ids.length) {
      const { data } = await supabase
        .from('posts')
        .select('id, author_name, content, image_url')
        .in('id', ids);
      posts = data || [];
    }
    const map = {};
    for (const p of posts) map[p.id] = p;

    return NextResponse.json({
      reports: arr.map((r) => ({ ...r, post: map[r.postId] || null })).slice(0, 100)
    });
  } catch (e) {
    return NextResponse.json({ error: '加载举报失败：' + e.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const me = await getSessionUser(request);
    if (!me || me.role !== 'admin') return NextResponse.json({ error: '只有管理员可以操作' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const id = String(body.id || '');
    const supabase = getSupabase();
    const list = await readJson(supabase, KEY, []);
    const arr = Array.isArray(list) ? list : [];
    const next = arr.map((r) => (r.id === id ? { ...r, done: true, doneAt: new Date().toISOString() } : r));
    await writeJson(supabase, KEY, next);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: '处理失败：' + e.message }, { status: 500 });
  }
}
