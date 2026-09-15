import { NextRequest, NextResponse } from 'next/server';
import sql from '../../../../lib/db';
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
        { error: 'Keluarga tidak ditemukan atau Anda tidak memiliki akses.' },
        { status: 404 }
      );
    }

    const anggotaList = await sql`
      SELECT id, name, role, telegram_id 
      FROM anggota 
      WHERE keluarga_id = ${kid} 
      ORDER BY name
    `;

    return NextResponse.json(anggotaList);
  } catch (error: any) {
    console.error('Error fetching family members:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil data anggota keluarga.' },
      { status: 500 }
    );
  }
}
