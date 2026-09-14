import { NextRequest, NextResponse } from 'next/server';
import { createRekening, getRekeningList } from '../../lib/queries';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keluargaId = Number(searchParams.get('keluarga_id') || 1);
    const list = await getRekeningList(keluargaId);
    return NextResponse.json(list);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keluarga_id = 1, name, initial_balance = 0, type = 'cash' } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Nama dompet/rekening wajib diisi' }, { status: 400 });
    }

    const created = await createRekening(
      Number(keluarga_id),
      name.trim(),
      Number(initial_balance) || 0,
      type
    );
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    console.error('Error creating rekening:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
