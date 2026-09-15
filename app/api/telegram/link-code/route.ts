import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getUserFamily } from '../../../lib/auth';
import { generateTelegramLinkCode } from '../../../lib/telegram';
import sql from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const family = await getUserFamily();
  if (!family) {
    return NextResponse.json({ error: 'Forbidden: No family associated' }, { status: 403 });
  }

  try {
    let targetAnggotaId = family.anggota.id;

    // Check if body specifies a particular anggota_id
    try {
      const body = await request.json();
      if (body?.anggota_id) {
        targetAnggotaId = Number(body.anggota_id);
      }
    } catch {
      // Empty body is acceptable, defaults to current user's anggota
    }

    // Verify target anggota belongs to this user's family
    const [targetAnggota] = await sql`
      SELECT id, name, keluarga_id 
      FROM anggota 
      WHERE id = ${targetAnggotaId} AND keluarga_id = ${family.keluarga.id}
    `;

    if (!targetAnggota) {
      return NextResponse.json(
        { error: 'Forbidden: Anggota not found or does not belong to your family' },
        { status: 403 }
      );
    }

    const { code, expires_at } = await generateTelegramLinkCode(targetAnggota.id);

    return NextResponse.json({
      success: true,
      anggota_id: targetAnggota.id,
      anggota_name: targetAnggota.name,
      code,
      expires_at: expires_at.toISOString(),
      instructions: `Kirimkan pesan "/link ${code}" ke bot Telegram KeuanganKeluarga dalam waktu 10 menit.`,
    });
  } catch (error: any) {
    console.error('Error generating telegram link code:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate linking code' },
      { status: 500 }
    );
  }
}

