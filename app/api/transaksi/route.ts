import { NextRequest, NextResponse } from 'next/server';
import { createTransaksi, getDashboardData } from '../../lib/queries';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rekening_id, anggota_id, amount, type, category, description, date } = body;

    if (!rekening_id || !anggota_id || !amount || !type || !category) {
      return NextResponse.json(
        { error: 'Field rekening_id, anggota_id, amount, type, dan category wajib diisi' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Nominal transaksi harus lebih dari 0' },
        { status: 400 }
      );
    }

    const tx = await createTransaksi({
      rekening_id: Number(rekening_id),
      anggota_id: Number(anggota_id),
      amount: Number(amount),
      type,
      category,
      description,
      date,
    });

    return NextResponse.json(tx, { status: 201 });
  } catch (error: any) {
    console.error('Error creating transaction:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
