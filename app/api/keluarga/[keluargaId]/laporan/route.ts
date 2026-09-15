import { NextRequest, NextResponse } from 'next/server';
import { getLaporanBulanan } from '../../../../lib/queries';
import { getUserFamily } from '../../../../lib/auth';

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

    const data = await getLaporanBulanan(kid, month, year, anggotaId);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in laporan route:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil data laporan bulanan.' },
      { status: 500 }
    );
  }
}
