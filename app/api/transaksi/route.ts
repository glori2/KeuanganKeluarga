import { NextRequest, NextResponse } from 'next/server';
import { createTransaksi } from '../../lib/queries';
import { CreateTransaksiSchema } from '../../lib/validations';
import { getUserFamily } from '../../lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Tenant & Auth Guard
    const ctx = await getUserFamily();
    if (!ctx) {
      return NextResponse.json(
        { error: 'Autentikasi diperlukan. Silakan masuk terlebih dahulu.' },
        { status: 401 }
      );
    }

    // 2. Input Validation via Zod
    const rawBody = await request.json();
    const parsed = CreateTransaksiSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validasi data gagal', details: parsed.error.issues.map(i => i.message) },
        { status: 422 }
      );
    }

    const { rekening_id, anggota_id, amount, type, category, description, date } = parsed.data;

    // 3. Atomic Execution with Server-Enforced Tenant & Actor Tracking
    const tx = await createTransaksi({
      rekening_id,
      anggota_id,
      amount,
      type,
      category,
      description,
      date,
      actor_user_id: ctx.user.id,
      actor_name: ctx.anggota.name,
      actor_type: 'web',
    });

    return NextResponse.json(tx, { status: 201 });
  } catch (error: any) {
    console.error('Error creating transaction:', error);
    if (error.message?.includes('CROSS_FAMILY_VIOLATION')) {
      return NextResponse.json(
        { error: 'Akses ditolak: Rekening atau Anggota tidak valid untuk keluarga Anda.' },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mencatat transaksi.' },
      { status: 500 }
    );
  }
}
