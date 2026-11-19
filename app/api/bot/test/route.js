import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { BOT_ID, generateBotReply, loadBotConfig } from '@/lib/bot';

/** 诊断用：直接跑一遍机器人回复逻辑，把错误暴露出来 */
export async function GET(request) {
  const steps = [];
  try {
    const me = await getSessionUser(request);
    steps.push({ step: 'session', ok: Boolean(me?.id), username: me?.username || null });
    if (!me?.id) return NextResponse.json({ error: '请先登录', steps }, { status: 401 });

    steps.push({ step: 'botId', bot: BOT_ID, hasKey: Boolean(process.env.ARK_API_KEY), model: process.env.ARK_MODEL || null });

    const supabase = getSupabase();
    const { data: recent, error: qErr } = await supabase
      .from('dm_messages')
      .select('sender_id, content, kind')
      .eq('kind', 'text')
      .or(`and(sender_id.eq.${me.id},receiver_id.eq.${BOT_ID}),and(sender_id.eq.${BOT_ID},receiver_id.eq.${me.id})`)
      .order('created_at', { ascending: false })
      .limit(6);
    steps.push({ step: 'history', ok: !qErr, error: qErr?.message || null, count: (recent || []).length });

    const cfg = await loadBotConfig(supabase);
    steps.push({ step: 'config', hasKey: Boolean(cfg.key), model: cfg.model || null, url: cfg.url || null });
    const reply = await generateBotReply({ username: me.username || '同学', text: '你好在吗', history: [], cfg });
    steps.push({ step: 'reply', ok: Boolean(reply), preview: reply?.slice(0, 80) });

    return NextResponse.json({ ok: true, steps });
  } catch (e) {
    return NextResponse.json({ error: e.message, steps }, { status: 500 });
  }
}
