import { NextRequest, NextResponse } from 'next/server';
import { getTransaksiAuditLog } from '../../../../lib/queries';
import { getUserFamily } from '../../../../lib/auth';
import sql from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
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

    const logs = await getTransaksiAuditLog(txId, ctx.keluarga.id);
    return NextResponse.json(logs);
  } catch (error: any) {
    console.error('Error fetching transaction audit logs:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memuat audit log.' },
      { status: 500 }
    );
  }
}
