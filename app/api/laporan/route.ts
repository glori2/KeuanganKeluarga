import { NextRequest, NextResponse } from 'next/server';
import { getLaporanBulanan } from '../../lib/queries';
import { getUserFamily } from '../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const ctx = await getUserFamily();
    if (!ctx) {
      return NextResponse.json(
        { error: 'Autentikasi diperlukan. Silakan masuk terlebih dahulu.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const month = Number(searchParams.get('month') || new Date().getMonth() + 1);
    const year = Number(searchParams.get('year') || new Date().getFullYear());
    const anggotaId = searchParams.get('anggota_id') ? Number(searchParams.get('anggota_id')) : undefined;

    const data = await getLaporanBulanan(ctx.keluarga.id, month, year, anggotaId);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in laporan route:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil data laporan bulanan.' },
      { status: 500 }
    );
  }
}
