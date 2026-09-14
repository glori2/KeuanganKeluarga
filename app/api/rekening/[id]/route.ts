import { NextRequest, NextResponse } from 'next/server';
import { updateRekening, deleteRekening } from '../../../lib/queries';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rId = Number(id);
    if (!rId) {
      return NextResponse.json({ error: 'ID rekening tidak valid' }, { status: 400 });
    }

    const body = await request.json();
    const { name, type = 'cash' } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Nama dompet/rekening wajib diisi' }, { status: 400 });
    }

    const updated = await updateRekening(rId, name.trim(), type);
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating rekening:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rId = Number(id);
    if (!rId) {
      return NextResponse.json({ error: 'ID rekening tidak valid' }, { status: 400 });
    }

    const res = await deleteRekening(rId);
    return NextResponse.json(res);
  } catch (error: any) {
    console.error('Error deleting rekening:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
