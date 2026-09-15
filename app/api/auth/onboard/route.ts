import { NextRequest, NextResponse } from 'next/server';
import sql from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { userId, fullName, familyName } = await request.json();

    if (!userId || !fullName) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Execute onboarding atomically in a transaction
    const result = await sql.begin(async sqlTx => {
      // Check if user is already onboarded
      const existingAnggota = await sqlTx`
        SELECT id, keluarga_id FROM anggota WHERE user_id = ${userId} LIMIT 1
      `;

      if (existingAnggota.length > 0) {
        return { ok: true, keluarga_id: existingAnggota[0].keluarga_id };
      }

      // 1. Create new Keluarga
      const newKeluarga = await sqlTx`
        INSERT INTO keluarga (name) 
        VALUES (${familyName || `Keluarga ${fullName}`}) 
        RETURNING id
      `;
      const keluargaId = newKeluarga[0].id;

      // 2. Create default wallet
      await sqlTx`
        INSERT INTO rekening (keluarga_id, name, balance, type) 
        VALUES (${keluargaId}, 'Dompet Utama', 0::numeric, 'cash'::rekeningtypeenum)
      `;

      // 3. Create Admin Member linked to user_id
      await sqlTx`
        INSERT INTO anggota (keluarga_id, name, user_id, role) 
        VALUES (${keluargaId}, ${fullName}, ${userId}, 'admin'::roleenum)
      `;

      // 4. Insert or update profiles table if exists
      try {
        await sqlTx`
          INSERT INTO profiles (id, full_name, role)
          VALUES (${userId}, ${fullName}, 'admin')
          ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name
        `;
      } catch {
        // profiles table optional
      }

      return { ok: true, keluarga_id: keluargaId };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Onboarding error:', error);
    return NextResponse.json({ error: 'Gagal inisialisasi akun keluarga' }, { status: 500 });
  }
}
