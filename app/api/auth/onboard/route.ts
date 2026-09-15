import { NextRequest, NextResponse } from 'next/server';
import sql from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { userId, fullName, familyName, invitationCode } = await request.json();

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

      // Case A: User is joining an existing family via invitation code
      if (invitationCode && typeof invitationCode === 'string' && invitationCode.trim()) {
        const cleanCode = invitationCode.trim().toUpperCase();
        const [invitation] = await sqlTx`
          SELECT fi.*, k.name as keluarga_name
          FROM family_invitations fi
          JOIN keluarga k ON fi.keluarga_id = k.id
          WHERE fi.invitation_code = ${cleanCode}
          FOR UPDATE
        `;

        if (!invitation) {
          throw new Error('INVITATION_INVALID: Kode undangan tidak ditemukan.');
        }

        if (invitation.used_at) {
          throw new Error('INVITATION_USED: Kode undangan sudah pernah digunakan.');
        }

        if (new Date(invitation.expires_at) < new Date()) {
          throw new Error('INVITATION_EXPIRED: Kode undangan sudah kedaluwarsa.');
        }

        let memberId: number;
        let memberName = fullName;

        // Check if there is a target member slot to bind to
        if (invitation.target_anggota_id) {
          const [targetSlot] = await sqlTx`
            SELECT id, name, user_id
            FROM anggota
            WHERE id = ${invitation.target_anggota_id} AND keluarga_id = ${invitation.keluarga_id}
            FOR UPDATE
          `;

          if (targetSlot && !targetSlot.user_id) {
            await sqlTx`
              UPDATE anggota
              SET user_id = ${userId},
                  role = ${invitation.target_role}::roleenum
              WHERE id = ${targetSlot.id}
            `;
            memberId = targetSlot.id;
            memberName = targetSlot.name;
          } else {
            const [newAnggota] = await sqlTx`
              INSERT INTO anggota (keluarga_id, name, user_id, role)
              VALUES (${invitation.keluarga_id}, ${fullName}, ${userId}, ${invitation.target_role}::roleenum)
              RETURNING id, name
            `;
            memberId = newAnggota.id;
            memberName = newAnggota.name;
          }
        } else {
          const [newAnggota] = await sqlTx`
            INSERT INTO anggota (keluarga_id, name, user_id, role)
            VALUES (${invitation.keluarga_id}, ${fullName}, ${userId}, ${invitation.target_role}::roleenum)
            RETURNING id, name
          `;
          memberId = newAnggota.id;
          memberName = newAnggota.name;
        }

        // Mark invitation used
        await sqlTx`
          UPDATE family_invitations
          SET used_at = NOW(),
              used_by = ${userId}
          WHERE id = ${invitation.id}
        `;

        // Audit log
        await sqlTx`
          INSERT INTO audit_log (
            keluarga_id,
            actor_user_id,
            actor_type,
            actor_name,
            action,
            new_data
          ) VALUES (
            ${invitation.keluarga_id},
            ${userId},
            'web',
            ${memberName},
            'INVITATION_ACCEPT',
            ${JSON.stringify({
              invitation_id: invitation.id,
              anggota_id: memberId,
              role: invitation.target_role,
            })}::jsonb
          )
        `;

        // Upsert profiles
        try {
          await sqlTx`
            INSERT INTO profiles (id, full_name, role)
            VALUES (${userId}, ${fullName}, ${invitation.target_role})
            ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name
          `;
        } catch {
          // profiles optional
        }

        return { ok: true, keluarga_id: invitation.keluarga_id, joined_via_invitation: true };
      }

      // Case B: Create new Keluarga
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
