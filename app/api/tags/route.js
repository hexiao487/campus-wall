import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { extractTags } from '@/lib/tags';

/** 热门话题：按最近 300 条帖子统计出现次数 */
export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('posts')
      .select('content, created_at')
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);

    const counts = {};
    for (const p of data || []) {
      for (const t of extractTags(p.content)) counts[t] = (counts[t] || 0) + 1;
    }
    const tags = Object.entries(counts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    return NextResponse.json({ tags });
  } catch (e) {
    return NextResponse.json({ error: '加载话题失败：' + e.message }, { status: 500 });
  }
}
