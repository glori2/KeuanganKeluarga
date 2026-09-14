import { NextRequest, NextResponse } from 'next/server';
import { createAnggota, getAnggotaByKeluarga } from '../../lib/queries';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keluargaId = Number(searchParams.get('keluarga_id') || 1);
    const list = await getAnggotaByKeluarga(keluargaId);
    return NextResponse.json(list);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keluarga_id = 1, name, telegram_id, role = 'member' } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Nama anggota wajib diisi' }, { status: 400 });
    }

    const created = await createAnggota(Number(keluarga_id), name.trim(), telegram_id, role);
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    console.error('Error creating anggota:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
