import { NextRequest, NextResponse } from 'next/server';
import { voidTransaksi } from '../../../../lib/queries';
import { getUserFamily } from '../../../../lib/auth';
import sql from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function POST(
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

    // Verify ownership
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

    let reason = 'Dibatalkan oleh pengguna';
    try {
      const body = await request.json();
      if (body?.reason && typeof body.reason === 'string') {
        reason = body.reason.trim();
      }
    } catch {
      // Empty body is acceptable
    }

    const voided = await voidTransaksi(txId, reason, {
      actor_user_id: ctx.user.id,
      actor_name: ctx.anggota.name,
      actor_type: 'web',
    });

    return NextResponse.json({
      success: true,
      message: 'Transaksi berhasil dibatalkan (voided)',
      transaction: voided,
    });
  } catch (error: any) {
    console.error('Error voiding transaction:', error);
    if (error.message?.includes('ALREADY_VOIDED')) {
      return NextResponse.json(
        { error: 'Transaksi ini sudah dibatalkan sebelumnya (tidak dapat dibatalkan ulang).' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat membatalkan transaksi.' },
      { status: 500 }
    );
  }
}
