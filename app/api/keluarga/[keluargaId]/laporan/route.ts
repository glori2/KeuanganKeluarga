import { NextRequest, NextResponse } from 'next/server';
import { getLaporanBulanan } from '../../../../lib/queries';

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
  const anggotaId = anggotaIdParam ? Number(anggotaIdParam) : undefined;

  if (!month || !year) {
    return NextResponse.json({ error: 'month and year are required' }, { status: 400 });
  }

  try {
    const data = await getLaporanBulanan(kid, month, year, anggotaId);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching laporan:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
