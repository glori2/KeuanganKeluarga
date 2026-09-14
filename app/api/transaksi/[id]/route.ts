import { NextRequest, NextResponse } from 'next/server';
import { updateTransaksi, deleteTransaksi } from '../../../lib/queries';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const txId = Number(id);
    if (!txId) {
      return NextResponse.json({ error: 'ID transaksi tidak valid' }, { status: 400 });
    }

    const body = await request.json();
    const { rekening_id, anggota_id, amount, type, category, description, date } = body;

    const updated = await updateTransaksi(txId, {
      rekening_id: rekening_id ? Number(rekening_id) : undefined,
      anggota_id: anggota_id ? Number(anggota_id) : undefined,
      amount: amount !== undefined ? Number(amount) : undefined,
      type,
      category,
      description,
      date,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating transaction:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const txId = Number(id);
    if (!txId) {
      return NextResponse.json({ error: 'ID transaksi tidak valid' }, { status: 400 });
    }

    const res = await deleteTransaksi(txId);
    return NextResponse.json(res);
  } catch (error: any) {
    console.error('Error deleting transaction:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
