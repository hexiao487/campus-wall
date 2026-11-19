import { NextResponse } from 'next/server';
import { wechatConfig } from '@/lib/wechat';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cfg = wechatConfig();
  return NextResponse.json({ enabled: Boolean(cfg) });
}
