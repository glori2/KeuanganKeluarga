import { NextRequest, NextResponse } from 'next/server';
import { handleTelegramUpdate } from '../../lib/telegram';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'online',
    service: 'Keuangan Keluarga Telegram Webhook Handler',
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    await handleTelegramUpdate(data);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    // Return OK to Telegram so it doesn't keep hammering retries on syntax mistakes
    return NextResponse.json({ ok: true, error: error.message });
  }
}
