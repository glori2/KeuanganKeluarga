import { NextRequest, NextResponse } from 'next/server';
import { updateRekening, deleteRekening } from '../../../lib/queries';
import { getUserFamily } from '../../../lib/auth';
import sql from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getUserFamily();
    if (!ctx) {
      return NextResponse.json(
        { error: 'Autentikasi diperlukan. Silakan masuk terlebih dahulu.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const rId = Number(id);
    if (!rId || isNaN(rId)) {
      return NextResponse.json({ error: 'ID rekening tidak valid' }, { status: 400 });
    }

    // Verify ownership
    const [existing] = await sql`
      SELECT id FROM rekening WHERE id = ${rId} AND keluarga_id = ${ctx.keluarga.id}
    `;
    if (!existing) {
      return NextResponse.json(
        { error: 'Rekening tidak ditemukan atau Anda tidak memiliki akses.' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, type = 'cash' } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Nama dompet/rekening wajib diisi' }, { status: 422 });
    }

    const updated = await updateRekening(rId, name.trim(), type);
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating rekening:', error);
    return NextResponse.json(
      { error: 'Gagal memperbarui rekening.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getUserFamily();
    if (!ctx) {
      return NextResponse.json(
        { error: 'Autentikasi diperlukan. Silakan masuk terlebih dahulu.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const rId = Number(id);
    if (!rId || isNaN(rId)) {
      return NextResponse.json({ error: 'ID rekening tidak valid' }, { status: 400 });
    }

    // Verify ownership
    const [existing] = await sql`
      SELECT id FROM rekening WHERE id = ${rId} AND keluarga_id = ${ctx.keluarga.id}
    `;
    if (!existing) {
      return NextResponse.json(
        { error: 'Rekening tidak ditemukan atau Anda tidak memiliki akses.' },
        { status: 404 }
      );
    }

    const res = await deleteRekening(rId);
    return NextResponse.json(res);
  } catch (error: any) {
    console.error('Error deleting rekening:', error);
    return NextResponse.json(
      { error: 'Gagal menghapus rekening.' },
      { status: 500 }
    );
  }
}
