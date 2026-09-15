import { NextRequest, NextResponse } from 'next/server';
import sql from '../../../../lib/db';
import { getAuthenticatedUser } from '../../../../lib/auth';
import { AcceptInvitationSchema } from '../../../../lib/validations';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Autentikasi diperlukan. Silakan login atau daftar terlebih dahulu.' },
        { status: 401 }
      );
    }

    const rawBody = await request.json().catch(() => ({}));
    const parsed = AcceptInvitationSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validasi gagal', details: parsed.error.issues.map(i => i.message) },
        { status: 400 }
      );
    }

    const cleanCode = parsed.data.code.trim().toUpperCase();

    const result = await sql.begin(async sqlTx => {
      // 1. Lock and validate invitation
      const [invitation] = await sqlTx`
        SELECT fi.*, k.name as keluarga_name
        FROM family_invitations fi
        JOIN keluarga k ON fi.keluarga_id = k.id
        WHERE fi.invitation_code = ${cleanCode}
        FOR UPDATE
      `;

      if (!invitation) {
        return { error: 'Kode undangan tidak valid atau tidak ditemukan.', status: 404 };
      }

      if (invitation.used_at) {
        return { error: 'Kode undangan ini sudah pernah digunakan.', status: 400 };
      }

      if (new Date(invitation.expires_at) < new Date()) {
        return { error: 'Kode undangan sudah kedaluwarsa.', status: 400 };
      }

      // 2. Check if user is already a member of any family
      const existingMembership = await sqlTx`
        SELECT a.id, a.keluarga_id, k.name as keluarga_name
        FROM anggota a
        JOIN keluarga k ON a.keluarga_id = k.id
        WHERE a.user_id = ${user.id}
        LIMIT 1
      `;

      if (existingMembership.length > 0) {
        const mem = existingMembership[0];
        if (mem.keluarga_id === invitation.keluarga_id) {
          return { error: 'Anda sudah terdaftar sebagai anggota dalam keluarga ini.', status: 400 };
        }
        return {
          error: 'Akun Anda sudah terdaftar dalam keluarga lain. Satu akun hanya dapat tergabung dalam satu keluarga.',
          status: 403,
        };
      }

      // 3. Resolve user's full name from profiles if exists
      const profiles = await sqlTx`
        SELECT full_name FROM profiles WHERE id = ${user.id} LIMIT 1
      `;
      const profileName = profiles.length > 0 && profiles[0].full_name ? profiles[0].full_name : 'Anggota Keluarga';

      let memberId: number;
      let memberName = profileName;

      // 4. If target_anggota_id specified, bind user_id to that existing slot (preserving transaction history)
      if (invitation.target_anggota_id) {
        const [targetSlot] = await sqlTx`
          SELECT id, name, user_id, keluarga_id
          FROM anggota
          WHERE id = ${invitation.target_anggota_id} AND keluarga_id = ${invitation.keluarga_id}
          FOR UPDATE
        `;

        if (targetSlot && !targetSlot.user_id) {
          await sqlTx`
            UPDATE anggota
            SET user_id = ${user.id},
                role = ${invitation.target_role}::roleenum
            WHERE id = ${targetSlot.id}
          `;
          memberId = targetSlot.id;
          memberName = targetSlot.name;
        } else {
          // Slot was claimed or missing; create new anggota
          const [newAnggota] = await sqlTx`
            INSERT INTO anggota (keluarga_id, user_id, name, role)
            VALUES (${invitation.keluarga_id}, ${user.id}, ${profileName}, ${invitation.target_role}::roleenum)
            RETURNING id, name
          `;
          memberId = newAnggota.id;
          memberName = newAnggota.name;
        }
      } else {
        // No specific slot targeted; create new member
        const [newAnggota] = await sqlTx`
          INSERT INTO anggota (keluarga_id, user_id, name, role)
          VALUES (${invitation.keluarga_id}, ${user.id}, ${profileName}, ${invitation.target_role}::roleenum)
          RETURNING id, name
        `;
        memberId = newAnggota.id;
        memberName = newAnggota.name;
      }

      // 5. Mark invitation as used
      await sqlTx`
        UPDATE family_invitations
        SET used_at = NOW(),
            used_by = ${user.id}
        WHERE id = ${invitation.id}
      `;

      // 6. Record in immutable audit log
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
          ${user.id},
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

      return {
        ok: true,
        keluarga_id: invitation.keluarga_id,
        keluarga_name: invitation.keluarga_name,
        anggota_id: memberId,
        role: invitation.target_role,
      };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json(
      { error: 'Gagal memproses kode undangan keluarga' },
      { status: 500 }
    );
  }
}
