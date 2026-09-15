import { createClient } from './supabase/server';
import sql from './db';

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

export interface UserFamilyContext {
  user: AuthenticatedUser;
  anggota: {
    id: number;
    name: string;
    role: string;
    telegram_id: string | null;
    keluarga_id: number;
  };
  keluarga: {
    id: number;
    name: string;
  };
}

/**
 * Server-side helper to get the currently authenticated Supabase user.
 * Returns null if not logged in.
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
    };
  } catch (err) {
    console.error('Error fetching authenticated user:', err);
    return null;
  }
}

/**
 * Server-side helper to get the active user's family and member context.
 * Resolves: auth.uid() -> anggota.user_id -> anggota.keluarga_id -> keluarga
 * Throws error or returns null if user is not associated with a family.
 */
export async function getUserFamily(): Promise<UserFamilyContext | null> {
  const user = await getAuthenticatedUser();
  if (!user) return null;

  try {
    const rows = await sql`
      SELECT 
        a.id as anggota_id,
        a.name as anggota_name,
        a.role as anggota_role,
        a.telegram_id,
        a.keluarga_id,
        k.name as keluarga_name
      FROM anggota a
      JOIN keluarga k ON a.keluarga_id = k.id
      WHERE a.user_id = ${user.id}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      user,
      anggota: {
        id: row.anggota_id,
        name: row.anggota_name,
        role: row.anggota_role,
        telegram_id: row.telegram_id,
        keluarga_id: row.keluarga_id,
      },
      keluarga: {
        id: row.keluarga_id,
        name: row.keluarga_name,
      },
    };
  } catch (err) {
    console.error('Error fetching user family context:', err);
    return null;
  }
}
