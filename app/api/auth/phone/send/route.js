import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import {
  hashCode,
  isValidPhone,
  normalizePhone,
  randomCode,
  sendSmsCode,
  smsConfig
} from '@/lib/sms';

export const dynamic = 'force-dynamic';

const COOLDOWN_SEC = 60;
const DAILY_MAX = 8;
const TTL_MIN = 5;

export async function POST(request) {
  try {
    const cfg = smsConfig();
    if (!cfg) {
      return NextResponse.json(
        { error: '短信服务还没配置：需要腾讯云短信的 SecretId / SecretKey / 应用ID / 签名 / 模板' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const phone = normalizePhone(body.phone);
    if (!isValidPhone(phone)) {
      return NextResponse.json({ error: '手机号格式不对' }, { status: 400 });
    }

    const supabase = getSupabase();
    const now = Date.now();

    const { data: recent } = await supabase
      .from('phone_codes')
      .select('created_at')
      .eq('phone', phone)
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
      .from('phone_codes')
      .select('id', { count: 'exact', head: true })
      .eq('phone', phone)
      .gte('created_at', new Date(now - 24 * 60 * 60 * 1000).toISOString());

    if ((count || 0) >= DAILY_MAX) {
      return NextResponse.json({ error: '今天这个号码的验证码次数用完了，明天再来' }, { status: 429 });
    }

    const code = randomCode();
    const { error: insErr } = await supabase.from('phone_codes').insert({
      phone,
      code_hash: hashCode(phone, code),
      expires_at: new Date(now + TTL_MIN * 60 * 1000).toISOString()
    });
    if (insErr) throw new Error(insErr.message);

    await sendSmsCode({ cfg, phone, code });

    return NextResponse.json({ ok: true, ttl: TTL_MIN });
  } catch (e) {
    return NextResponse.json({ error: '验证码发送失败：' + e.message }, { status: 500 });
  }
}
