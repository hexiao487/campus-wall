import { NextResponse } from 'next/server';
import { smsConfig } from '@/lib/sms';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ enabled: Boolean(smsConfig()) });
}
