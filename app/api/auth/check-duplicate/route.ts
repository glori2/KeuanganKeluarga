import { NextRequest, NextResponse } from 'next/server';
import sql from '../../../lib/db';
import { CheckDuplicateFamilySchema } from '../../../lib/validations';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parsed = CheckDuplicateFamilySchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validasi gagal', details: parsed.error.issues.map(i => i.message) },
        { status: 400 }
      );
    }

    const { familyName } = parsed.data;
    const cleanName = familyName.trim().toLowerCase();

    // Check if any family exists with identical normalized name
    const match = await sql`
      SELECT 1 FROM keluarga 
      WHERE LOWER(TRIM(name)) = ${cleanName}
      LIMIT 1
    `;

    if (match.length > 0) {
      // Privacy-safe response: NO ID, NO member lists, NO admin info
      return NextResponse.json({
        possible_match: true,
        confidence: 'strong',
        message: 'Kami menemukan kemungkinan data yang mirip dengan keluarga yang sudah ada.',
      });
    }

    return NextResponse.json({
      possible_match: false,
      confidence: 'none',
      message: 'Nama keluarga tersedia.',
    });
  } catch (error) {
    console.error('Check duplicate family error:', error);
    return NextResponse.json(
      { error: 'Gagal melakukan pengecekan nama keluarga' },
      { status: 500 }
    );
  }
}
