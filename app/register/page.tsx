'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../lib/supabase/client';
import Link from 'next/link';

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    if (!supabaseUrl || supabaseUrl.includes('placeholder.supabase.co')) {
      setError(
        'Konfigurasi server belum lengkap: NEXT_PUBLIC_SUPABASE_URL belum disetel di Vercel. Silakan tambahkan Environment Variable di Vercel Dashboard lalu Redeploy.'
      );
      setLoading(false);
      return;
    }

    try {
      // 1. Sign up user via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            family_name: familyName || `Keluarga ${fullName}`,
          },
        },
      });

      if (authError) {
        throw authError;
      }

      if (!authData.user) {
        throw new Error('Pendaftaran gagal. Silakan coba lagi.');
      }

      // 2. Setup family profile via onboard API
      const res = await fetch('/api/auth/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: authData.user.id,
          fullName,
          familyName: familyName || `Keluarga ${fullName}`,
        }),
      });

      if (!res.ok) {
        let errorMsg = 'Gagal inisialisasi akun keluarga.';
        try {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const d = await res.json();
            if (d?.error) errorMsg = d.error;
          } else {
            const text = await res.text();
            if (text) console.warn('Non-JSON onboarding response:', text);
          }
        } catch {
          // Ignore parsing errors for non-blocking note
        }
        console.warn('Onboarding note:', errorMsg);
      }

      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      let message = err instanceof Error ? err.message : 'Terjadi kesalahan saat pendaftaran.';
      if (message === 'Failed to fetch' || message.toLowerCase().includes('fetch')) {
        message =
          'Registrasi gagal. Server autentikasi tidak dapat dihubungi (Failed to fetch). Pastikan koneksi internet stabil dan variabel NEXT_PUBLIC_SUPABASE_URL sudah aktif di Vercel.';
      } else if (message.includes('Unexpected end of JSON input') || message.includes('Failed to execute \'json\'')) {
        message = 'Registrasi gagal. Server mengembalikan response yang tidak valid.';
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="text-center mb-8">
          <span className="text-4xl">✨</span>
          <h2 className="text-2xl font-bold text-gray-900 mt-2">Daftar Akun Keluarga Baru</h2>
          <p className="text-sm text-gray-500 mt-1">
            Buat ruang kas keluarga pribadi yang aman & terisolasi.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap Anda</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="Contoh: Budi Santoso"
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Keluarga</label>
            <input
              type="text"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              placeholder="Contoh: Keluarga Santoso (Opsional)"
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="nama@email.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Minimal 6 karakter"
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                <span>Mendaftarkan...</span>
              </>
            ) : (
              <span>Daftar Sekarang</span>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-gray-500">
          Sudah memiliki akun?{' '}
          <Link href="/login" className="text-blue-600 font-semibold hover:underline">
            Masuk di sini
          </Link>
        </div>
      </div>
    </div>
  );
}
