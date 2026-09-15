import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getUserFamily } from '../../../lib/auth';
import { generateTelegramLinkCode } from '../../../lib/telegram';
import { TelegramLinkCodeSchema } from '../../../lib/validations';
import sql from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized: Autentikasi diperlukan.' }, { status: 401 });
  }

  const family = await getUserFamily();
  if (!family) {
    return NextResponse.json({ error: 'Forbidden: Tidak ada keluarga terhubung.' }, { status: 403 });
  }

  try {
    let rawBody;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Format request body tidak valid. Wajib menyertakan JSON dengan anggota_id.' },
        { status: 400 }
      );
    }

    const parsed = TelegramLinkCodeSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validasi anggota_id gagal',
          details: parsed.error.issues.map(i => i.message),
        },
        { status: 400 }
      );
    }

    const targetAnggotaId = parsed.data.anggota_id;

    // Verify target anggota belongs strictly to this user's family
    const [targetAnggota] = await sql`
      SELECT id, name, keluarga_id 
      FROM anggota 
      WHERE id = ${targetAnggotaId} AND keluarga_id = ${family.keluarga.id}
    `;

    if (!targetAnggota) {
      return NextResponse.json(
        { error: 'Forbidden: Anggota tidak ditemukan atau bukan bagian dari keluarga Anda.' },
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
      { error: error?.message || 'Gagal membuat kode tautan Telegram' },
      { status: 500 }
    );
  }
}


