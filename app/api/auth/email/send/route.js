import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import {
  emailConfig,
  hashCode,
  isValidEmail,
  normalizeEmail,
  randomCode,
  sendCodeEmail
} from '@/lib/email';

export const dynamic = 'force-dynamic';

const COOLDOWN_SEC = 60;
const DAILY_MAX = 8;
const TTL_MIN = 10;

export async function POST(request) {
  try {
    const cfg = emailConfig();
    if (!cfg) {
      return NextResponse.json(
        { error: '邮件服务还没配置：需要 Resend 的 API Key 和发件地址' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const email = normalizeEmail(body.email);
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: '邮箱格式不对' }, { status: 400 });
    }

    const supabase = getSupabase();
    const now = Date.now();

    const { data: recent } = await supabase
      .from('email_codes')
      .select('created_at')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recent) {
      const gap = (now - new Date(recent.created_at).getTime()) / 1000;
      if (gap < COOLDOWN_SEC) {
        return NextResponse.json(
          { error: `发得太快了，${Math.ceil(COOLDOWN_SEC - gap)} 秒后再试` },
          { status: 429 }
        );
      }
    }

    const { count } = await supabase
      .from('email_codes')
      .select('id', { count: 'exact', head: true })
      .eq('email', email)
      .gte('created_at', new Date(now - 24 * 60 * 60 * 1000).toISOString());

    if ((count || 0) >= DAILY_MAX) {
      return NextResponse.json({ error: '今天这个邮箱收码次数太多了，明天再试' }, { status: 429 });
    }

    const code = randomCode();
    const { error: insErr } = await supabase.from('email_codes').insert({
      email,
      code_hash: hashCode(email, code),
      expires_at: new Date(now + TTL_MIN * 60 * 1000).toISOString()
    });
    if (insErr) throw new Error(insErr.message);

    await sendCodeEmail({ cfg, email, code, ttl: TTL_MIN });

    return NextResponse.json({ ok: true, ttl: TTL_MIN });
  } catch (e) {
    return NextResponse.json({ error: '验证码发送失败：' + e.message }, { status: 500 });
  }
}
