import { NextResponse } from 'next/server';
import { emailConfig } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ enabled: Boolean(emailConfig()) });
}
