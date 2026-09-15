import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { handleTelegramUpdate } from '../../lib/telegram';

export const dynamic = 'force-dynamic';

function verifyTelegramSecret(request: NextRequest): boolean {
  const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  // If no secret configured in environment, allow for development/testing but log warning
  if (!configuredSecret) {
    return true;
  }

  const headerSecret = request.headers.get('x-telegram-bot-api-secret-token') || '';
  if (!headerSecret) {
    return false;
  }

  const expectedBuffer = Buffer.from(configuredSecret, 'utf-8');
  const actualBuffer = Buffer.from(headerSecret, 'utf-8');

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    service: 'Keuangan Keluarga Telegram Webhook Handler',
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  // 1. Verify Webhook Secret Token
  if (!verifyTelegramSecret(request)) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid Telegram webhook secret token' },
      { status: 401 }
    );
  }

  // 2. Process Telegram Update
  try {
    const data = await request.json();
    await handleTelegramUpdate(data);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    // Return OK with error note so Telegram stops retry storm on bad payload format
    return NextResponse.json({ ok: false, error: error?.message || 'Processing error' }, { status: 400 });
  }
}

