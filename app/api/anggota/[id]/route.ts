import { NextRequest, NextResponse } from 'next/server';
import { updateAnggota, deleteAnggota } from '../../../lib/queries';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const aId = Number(id);
    if (!aId) {
      return NextResponse.json({ error: 'ID anggota tidak valid' }, { status: 400 });
    }

    const body = await request.json();
    const { name, telegram_id, role } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Nama anggota wajib diisi' }, { status: 400 });
    }

    const updated = await updateAnggota(aId, name.trim(), telegram_id, role);
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating anggota:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const aId = Number(id);
    if (!aId) {
      return NextResponse.json({ error: 'ID anggota tidak valid' }, { status: 400 });
    }

    const res = await deleteAnggota(aId);
    return NextResponse.json(res);
  } catch (error: any) {
    console.error('Error deleting anggota:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
