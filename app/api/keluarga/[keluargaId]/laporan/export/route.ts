import { NextRequest, NextResponse } from 'next/server';
import sql from '../../../../../lib/db';
import { getUserFamily } from '../../../../../lib/auth';
import { escapeCsvField } from '../../../../../lib/format';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ keluargaId: string }> }
) {
  try {
    const ctx = await getUserFamily();
    if (!ctx) {
      return NextResponse.json(
        { error: 'Autentikasi diperlukan. Silakan masuk terlebih dahulu.' },
        { status: 401 }
      );
    }

    const { keluargaId } = await params;
    const kid = Number(keluargaId);
    if (!kid || isNaN(kid)) {
      return NextResponse.json({ error: 'ID keluarga tidak valid' }, { status: 400 });
    }

    // Tenant IDOR Protection
    if (kid !== ctx.keluarga.id) {
      return NextResponse.json(
        { error: 'Laporan tidak ditemukan atau Anda tidak memiliki akses.' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const month = Number(searchParams.get('month') || new Date().getMonth() + 1);
    const year = Number(searchParams.get('year') || new Date().getFullYear());
    const anggotaId = searchParams.get('anggota_id') ? Number(searchParams.get('anggota_id')) : undefined;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    let anggotaIds: number[];
    if (anggotaId) {
      const check = await sql`SELECT id FROM anggota WHERE keluarga_id = ${kid} AND id = ${anggotaId}`;
      if (check.length === 0) {
        return new NextResponse('Tanggal;Anggota;Dompet;Tipe;Kategori;Keterangan;Status;Nominal\n', {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="laporan-keuangan-${year}-${month}.csv"`,
          },
        });
      }
      anggotaIds = [anggotaId];
    } else {
      const rows = await sql`SELECT id FROM anggota WHERE keluarga_id = ${kid}`;
      anggotaIds = rows.map((r: Record<string, unknown>) => Number(r.id));
    }

    if (anggotaIds.length === 0) {
      return new NextResponse('Tanggal;Anggota;Dompet;Tipe;Kategori;Keterangan;Status;Nominal\n', {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="laporan-keuangan-${year}-${month}.csv"`,
        },
      });
    }

    const transactions = await sql`
      SELECT t.id, t.amount::numeric, t.type, t.category, t.description, t.date, t.status,
             a.name as anggota_name, r.name as rekening_name
      FROM transaksi t
      JOIN anggota a ON t.anggota_id = a.id
      JOIN rekening r ON t.rekening_id = r.id
      WHERE t.anggota_id = ANY(${anggotaIds})
        AND t.date >= ${startDate}
        AND t.date <= ${endDate}
      ORDER BY t.date DESC
    `;

    const headers = 'Tanggal;Anggota;Dompet;Tipe;Kategori;Keterangan;Status;Nominal\n';
    const rows = transactions.map((t: Record<string, unknown>) => {
      const dateStr = new Date(String(t.date)).toISOString().slice(0, 10);
      const tipeStr = t.type === 'income' ? 'Pemasukan' : t.type === 'expense' ? 'Pengeluaran' : 'Transfer';
      const statusStr = t.status === 'voided' ? 'Dibatalkan (Void)' : 'Posted';
      
      return [
        escapeCsvField(dateStr),
        escapeCsvField(t.anggota_name),
        escapeCsvField(t.rekening_name),
        escapeCsvField(tipeStr),
        escapeCsvField(t.category),
        escapeCsvField(t.description || '-'),
        escapeCsvField(statusStr),
        Number(t.amount).toFixed(2),
      ].join(';');
    });

    const csvContent = headers + rows.join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="laporan-keuangan-${year}-${month}.csv"`,
      },
    });
  } catch (error: unknown) {
    console.error('Error exporting CSV:', error);
    return NextResponse.json(
      { error: 'Gagal mengekspor laporan CSV.' },
      { status: 500 }
    );
  }
}
