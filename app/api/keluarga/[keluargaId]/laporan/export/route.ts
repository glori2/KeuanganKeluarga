import { NextRequest, NextResponse } from 'next/server';
import sql from '../../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ keluargaId: string }> }
) {
  const { keluargaId } = await params;
  const kid = Number(keluargaId);
  const { searchParams } = new URL(request.url);
  const month = Number(searchParams.get('month'));
  const year = Number(searchParams.get('year'));
  const anggotaIdParam = searchParams.get('anggota_id');

  if (!month || !year) {
    return NextResponse.json({ error: 'month and year are required' }, { status: 400 });
  }

  try {
    // Get anggota
    let anggotaIds: number[];
    if (anggotaIdParam) {
      anggotaIds = [Number(anggotaIdParam)];
    } else {
      const rows = await sql`SELECT id FROM anggota WHERE keluarga_id = ${kid}`;
      anggotaIds = rows.map((r: any) => r.id);
    }

    if (anggotaIds.length === 0) {
      return new NextResponse('Tanggal,Anggota,Jenis,Kategori,Nominal,Keterangan\n', {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="laporan_keuangan_${year}_${String(month).padStart(2, '0')}.csv"`,
        },
      });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const transactions = await sql`
      SELECT t.amount, t.type, t.category, t.description, t.date,
             a.name as anggota_name
      FROM transaksi t
      JOIN anggota a ON t.anggota_id = a.id
      WHERE t.anggota_id = ANY(${anggotaIds})
        AND t.date >= ${startDate}
        AND t.date <= ${endDate}
      ORDER BY t.date DESC
    `;

    // Build CSV with semicolon delimiter for Excel compatibility
    let csv = 'Tanggal;Anggota;Jenis;Kategori;Nominal;Keterangan\n';
    for (const t of transactions) {
      const date = new Date(t.date).toLocaleString('id-ID');
      const jenis = t.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
      csv += `${date};${t.anggota_name};${jenis};${t.category};${t.amount};${t.description || ''}\n`;
    }

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="laporan_keuangan_${year}_${String(month).padStart(2, '0')}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting CSV:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
