import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import sql from '../../../lib/db';
import { getUserFamily } from '../../../lib/auth';
import { CreateInvitationSchema } from '../../../lib/validations';

export const dynamic = 'force-dynamic';

function generateInvitationCode(): string {
  // Generates e.g. INV-A1B2-C3D4
  const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `INV-${part1}-${part2}`;
}

export async function GET() {
  try {
    const ctx = await getUserFamily();
    if (!ctx) {
      return NextResponse.json(
        { error: 'Autentikasi diperlukan. Silakan login terlebih dahulu.' },
        { status: 401 }
      );
    }

    if (ctx.anggota.role !== 'admin') {
      return NextResponse.json(
        { error: 'Hanya admin keluarga yang dapat melihat daftar undangan.' },
        { status: 403 }
      );
    }

    const invitations = await sql`
      SELECT 
        fi.id,
        fi.keluarga_id,
        fi.invitation_code,
        fi.target_role,
        fi.target_anggota_id,
        a.name as target_anggota_name,
        fi.expires_at,
        fi.used_at,
        fi.created_at
      FROM family_invitations fi
      LEFT JOIN anggota a ON fi.target_anggota_id = a.id
      WHERE fi.keluarga_id = ${ctx.keluarga.id}
      ORDER BY fi.created_at DESC
    `;

    return NextResponse.json(invitations);
  } catch (error) {
    console.error('Error fetching invitations:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil daftar undangan' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getUserFamily();
    if (!ctx) {
      return NextResponse.json(
        { error: 'Autentikasi diperlukan. Silakan login terlebih dahulu.' },
        { status: 401 }
      );
    }

    if (ctx.anggota.role !== 'admin') {
      return NextResponse.json(
        { error: 'Hanya admin keluarga yang dapat membuat undangan baru.' },
        { status: 403 }
      );
    }

    const rawBody = await request.json().catch(() => ({}));
    const parsed = CreateInvitationSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validasi undangan gagal', details: parsed.error.issues.map(i => i.message) },
        { status: 400 }
      );
    }

    const { target_role, target_anggota_id } = parsed.data;

    // If target_anggota_id provided, verify it belongs to this family and has no user_id yet
    if (target_anggota_id) {
      const targetMember = await sql`
        SELECT id, name, keluarga_id, user_id FROM anggota
        WHERE id = ${target_anggota_id} AND keluarga_id = ${ctx.keluarga.id}
        LIMIT 1
      `;

      if (targetMember.length === 0) {
        return NextResponse.json(
          { error: 'Anggota target tidak ditemukan dalam keluarga Anda.' },
          { status: 403 }
        );
      }

      if (targetMember[0].user_id) {
        return NextResponse.json(
          { error: 'Anggota ini sudah memiliki akun pengguna yang terhubung.' },
          { status: 400 }
        );
      }
    }

    const invitationCode = generateInvitationCode();
    const codeHash = crypto.createHash('sha256').update(invitationCode).digest('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    const result = await sql.begin(async sqlTx => {
      const [invitation] = await sqlTx`
        INSERT INTO family_invitations (
          keluarga_id,
          invited_by,
          target_role,
          target_anggota_id,
          invitation_code,
          code_hash,
          expires_at
        ) VALUES (
          ${ctx.keluarga.id},
          ${ctx.user.id},
          ${target_role},
          ${target_anggota_id || null},
          ${invitationCode},
          ${codeHash},
          ${expiresAt}
        )
        RETURNING id, keluarga_id, invitation_code, target_role, target_anggota_id, expires_at, created_at
      `;

      // Log in immutable audit_log
      await sqlTx`
        INSERT INTO audit_log (
          keluarga_id,
          actor_user_id,
          actor_type,
          actor_name,
          action,
          new_data
        ) VALUES (
          ${ctx.keluarga.id},
          ${ctx.user.id},
          'web',
          ${ctx.anggota.name},
          'INVITATION_CREATE',
          ${JSON.stringify({
            invitation_id: invitation.id,
            target_role,
            target_anggota_id: target_anggota_id || null,
            expires_at: expiresAt.toISOString(),
          })}::jsonb
        )
      `;

      return invitation;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating invitation:', error);
    return NextResponse.json(
      { error: 'Gagal membuat kode undangan keluarga' },
      { status: 500 }
    );
  }
}
