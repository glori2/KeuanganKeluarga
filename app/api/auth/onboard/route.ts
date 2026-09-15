import { NextRequest, NextResponse } from 'next/server';
import sql from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { userId, fullName, familyName } = await request.json();

    if (!userId || !fullName) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Check if user is already onboarded
    const existingAnggota = await sql`
      SELECT id, keluarga_id FROM anggota WHERE user_id = ${userId} LIMIT 1
    `;

    if (existingAnggota.length > 0) {
      return NextResponse.json({ ok: true, keluarga_id: existingAnggota[0].keluarga_id });
    }

    // Create new Keluarga
    const newKeluarga = await sql`
      INSERT INTO keluarga (name) 
      VALUES (${familyName || `Keluarga ${fullName}`}) 
      RETURNING id
    `;
    const keluargaId = newKeluarga[0].id;

    // Create default wallet
    await sql`
      INSERT INTO rekening (keluarga_id, name, balance, type) 
      VALUES (${keluargaId}, 'Dompet Utama', 0, 'cash')
    `;

    // Create Admin Member linked to user_id
    await sql`
      INSERT INTO anggota (keluarga_id, name, user_id, role) 
      VALUES (${keluargaId}, ${fullName}, ${userId}, 'admin')
    `;

    // Insert or update profiles table if exists
    try {
      await sql`
        INSERT INTO profiles (id, full_name, role)
        VALUES (${userId}, ${fullName}, 'admin')
        ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name
      `;
    } catch {
      // profiles table might be created in next migration step
    }

    return NextResponse.json({ ok: true, keluarga_id: keluargaId });
  } catch (error: any) {
    console.error('Onboarding error:', error);
    return NextResponse.json({ error: 'Gagal inisialisasi akun keluarga' }, { status: 500 });
  }
}
