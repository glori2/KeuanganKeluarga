import { NextRequest, NextResponse } from 'next/server';
import { createRekening, getRekeningList } from '../../lib/queries';
import { CreateRekeningSchema } from '../../lib/validations';
import { getUserFamily } from '../../lib/auth';

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

    const list = await getRekeningList(ctx.keluarga.id);
    return NextResponse.json(list);
  } catch (error: any) {
    console.error('Error fetching rekening list:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil data rekening.' },
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
    const parsed = CreateRekeningSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validasi rekening gagal', details: parsed.error.issues.map(i => i.message) },
        { status: 422 }
      );
    }

    const { name, initial_balance, type } = parsed.data;

    // Never trust client family ID - inject from session
    const created = await createRekening(
      ctx.keluarga.id,
      name,
      initial_balance,
      type
    );

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    console.error('Error creating rekening:', error);
    return NextResponse.json(
      { error: 'Gagal membuat rekening.' },
      { status: 500 }
    );
  }
}
