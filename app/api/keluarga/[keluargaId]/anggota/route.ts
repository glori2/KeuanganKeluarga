import { NextRequest, NextResponse } from 'next/server';
import sql from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ keluargaId: string }> }
) {
  const { keluargaId } = await params;
  const kid = Number(keluargaId);

  try {
    const rows = await sql`
      SELECT id, name FROM anggota WHERE keluarga_id = ${kid} ORDER BY name
    `;
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('Error fetching anggota:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
