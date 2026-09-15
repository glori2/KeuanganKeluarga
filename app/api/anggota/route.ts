import { NextRequest, NextResponse } from 'next/server';
import { createAnggota, getAnggotaByKeluarga } from '../../lib/queries';
import { CreateAnggotaSchema } from '../../lib/validations';
import { getUserFamily } from '../../lib/auth';
import sql from '../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ctx = await getUserFamily();
    if (!ctx) {
      return NextResponse.json(
        { error: 'Autentikasi diperlukan. Silakan masuk terlebih dahulu.' },
        { status: 401 }
      );
    }

    const list = await getAnggotaByKeluarga(ctx.keluarga.id);
    return NextResponse.json(list);
  } catch (error: any) {
    console.error('Error fetching anggota list:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil data anggota.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getUserFamily();
    if (!ctx) {
      return NextResponse.json(
        { error: 'Autentikasi diperlukan. Silakan masuk terlebih dahulu.' },
        { status: 401 }
      );
    }

    const rawBody = await request.json();
    const parsed = CreateAnggotaSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validasi anggota gagal', details: parsed.error.issues.map(i => i.message) },
        { status: 422 }
      );
    }

    const { name, telegram_id, role, confirm_duplicate } = parsed.data;

    // Check if member with identical name already exists in this family
    if (!confirm_duplicate) {
      const existingSameName = await sql`
        SELECT id, name, role, telegram_id, user_id FROM anggota
        WHERE keluarga_id = ${ctx.keluarga.id}
          AND LOWER(TRIM(name)) = ${name.trim().toLowerCase()}
      `;

      if (existingSameName.length > 0) {
        return NextResponse.json(
          {
            warning: 'duplicate_member_name',
            message: `Anggota dengan nama serupa ("${existingSameName[0].name}") sudah ada dalam keluarga ini.`,
            existing_members: existingSameName.map(m => ({
              id: m.id,
              name: m.name,
              role: m.role,
              has_user_account: !!m.user_id,
            })),
            requires_confirmation: true,
          },
          { status: 409 }
        );
      }
    }

    // Never trust client family ID - inject from session
    const created = await createAnggota(ctx.keluarga.id, name, telegram_id, role);
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    console.error('Error creating anggota:', error);
    return NextResponse.json(
      { error: 'Gagal menambahkan anggota.' },
      { status: 500 }
    );
  }
}
