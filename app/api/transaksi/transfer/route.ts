import { NextRequest, NextResponse } from 'next/server';
import { createTransfer } from '../../../lib/queries';
import { CreateTransferSchema } from '../../../lib/validations';
import { getUserFamily } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

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
    const parsed = CreateTransferSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validasi transfer gagal', details: parsed.error.issues.map(i => i.message) },
        { status: 422 }
      );
    }

    const tx = await createTransfer({
      ...parsed.data,
      actor_user_id: ctx.user.id,
      actor_name: ctx.anggota.name,
      actor_type: 'web',
    });
    return NextResponse.json(tx, { status: 201 });
  } catch (error: any) {
    console.error('Error creating transfer:', error);
    if (error.message?.includes('CROSS_FAMILY_VIOLATION')) {
      return NextResponse.json(
        { error: 'Akses ditolak: Transfer hanya diizinkan antar rekening dalam satu keluarga.' },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memproses transfer.' },
      { status: 500 }
    );
  }
}
