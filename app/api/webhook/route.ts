import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Forward webhook to Python API if it's running
  // For now, return OK to acknowledge Telegram
  try {
    const data = await request.json();
    console.log('Telegram webhook received:', JSON.stringify(data).substring(0, 200));
    
    // TODO: Process telegram updates directly in Next.js
    // For now, just acknowledge
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
