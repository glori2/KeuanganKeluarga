import { NextRequest, NextResponse } from 'next/server';
import { updateAnggota, deleteAnggota } from '../../../lib/queries';
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
    const aId = Number(id);
    if (!aId || isNaN(aId)) {
      return NextResponse.json({ error: 'ID anggota tidak valid' }, { status: 400 });
    }

    // Verify ownership
    const [existing] = await sql`
      SELECT id FROM anggota WHERE id = ${aId} AND keluarga_id = ${ctx.keluarga.id}
    `;
    if (!existing) {
      return NextResponse.json(
        { error: 'Anggota tidak ditemukan atau Anda tidak memiliki akses.' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, telegram_id, role } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Nama anggota wajib diisi' }, { status: 422 });
    }

    const updated = await updateAnggota(aId, name.trim(), telegram_id, role);
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating anggota:', error);
    return NextResponse.json(
      { error: 'Gagal memperbarui anggota.' },
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
    const aId = Number(id);
    if (!aId || isNaN(aId)) {
      return NextResponse.json({ error: 'ID anggota tidak valid' }, { status: 400 });
    }

    // Verify ownership
    const [existing] = await sql`
      SELECT id FROM anggota WHERE id = ${aId} AND keluarga_id = ${ctx.keluarga.id}
    `;
    if (!existing) {
      return NextResponse.json(
        { error: 'Anggota tidak ditemukan atau Anda tidak memiliki akses.' },
        { status: 404 }
      );
    }

    const res = await deleteAnggota(aId);
    return NextResponse.json(res);
  } catch (error: any) {
    console.error('Error deleting anggota:', error);
    return NextResponse.json(
      { error: 'Gagal menghapus anggota.' },
      { status: 500 }
    );
  }
}
