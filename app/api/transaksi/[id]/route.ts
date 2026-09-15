import { NextRequest, NextResponse } from 'next/server';
import { updateTransaksi, deleteTransaksi } from '../../../lib/queries';
import { UpdateTransaksiSchema } from '../../../lib/validations';
import { getUserFamily } from '../../../lib/auth';
import sql from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getUserFamily();
    if (!ctx) {
      return NextResponse.json(
        { error: 'Autentikasi diperlukan. Silakan masuk terlebih dahulu.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const txId = Number(id);
    if (!txId || isNaN(txId)) {
      return NextResponse.json({ error: 'ID transaksi tidak valid' }, { status: 400 });
    }

    // Verify ownership: Transaksi must belong to user's family
    const [txOwnership] = await sql`
      SELECT t.id 
      FROM transaksi t
      JOIN rekening r ON t.rekening_id = r.id
      WHERE t.id = ${txId} AND r.keluarga_id = ${ctx.keluarga.id}
    `;

    if (!txOwnership) {
      return NextResponse.json(
        { error: 'Transaksi tidak ditemukan atau Anda tidak memiliki akses.' },
        { status: 404 }
      );
    }

    const rawBody = await request.json();
    const parsed = UpdateTransaksiSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validasi data gagal', details: parsed.error.issues.map(i => i.message) },
        { status: 422 }
      );
    }

    const updated = await updateTransaksi(txId, parsed.data, {
      actor_user_id: ctx.user.id,
      actor_name: ctx.anggota.name,
      actor_type: 'web',
    });
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating transaction:', error);
    if (error.message?.includes('INVALID_MUTATION')) {
      return NextResponse.json(
        { error: 'Transaksi yang sudah dibatalkan (voided) tidak dapat diubah.' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memperbarui transaksi.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getUserFamily();
    if (!ctx) {
      return NextResponse.json(
        { error: 'Autentikasi diperlukan. Silakan masuk terlebih dahulu.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const txId = Number(id);
    if (!txId || isNaN(txId)) {
      return NextResponse.json({ error: 'ID transaksi tidak valid' }, { status: 400 });
    }

    // Verify ownership: Transaksi must belong to user's family
    const [txOwnership] = await sql`
      SELECT t.id 
      FROM transaksi t
      JOIN rekening r ON t.rekening_id = r.id
      WHERE t.id = ${txId} AND r.keluarga_id = ${ctx.keluarga.id}
    `;

    if (!txOwnership) {
      return NextResponse.json(
        { error: 'Transaksi tidak ditemukan atau Anda tidak memiliki akses.' },
        { status: 404 }
      );
    }

    const res = await deleteTransaksi(txId, {
      actor_user_id: ctx.user.id,
      actor_name: ctx.anggota.name,
      actor_type: 'web',
    });
    return NextResponse.json(res);
  } catch (error: any) {
    console.error('Error deleting/voiding transaction:', error);
    if (error.message?.includes('ALREADY_VOIDED')) {
      return NextResponse.json(
        { error: 'Transaksi ini sudah dibatalkan sebelumnya.' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat membatalkan transaksi.' },
      { status: 500 }
    );
  }
}

