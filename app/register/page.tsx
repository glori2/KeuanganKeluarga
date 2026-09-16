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
  const [hasInvitationCode, setHasInvitationCode] = useState(false);
  const [invitationCode, setInvitationCode] = useState('');
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleRegister = async (e?: React.FormEvent, forceNewFamily = false) => {
    if (e) e.preventDefault();
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
      // Step A: If creating a new family and not yet checked/confirmed, check duplicate
      if (!hasInvitationCode && !duplicateConfirmed && !forceNewFamily) {
        const targetFamilyName = familyName.trim() || `Keluarga ${fullName.trim()}`;
        try {
          const checkRes = await fetch('/api/auth/check-duplicate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ familyName: targetFamilyName }),
          });
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            if (checkData.possible_match) {
              setShowDuplicateWarning(true);
              setLoading(false);
              return;
            }
          }
        } catch {
          // If check fails, allow proceeding without blocking
        }
      }

      // Step B: Sign up user via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            family_name: hasInvitationCode ? 'Anggota Keluarga' : (familyName || `Keluarga ${fullName}`),
          },
        },
      });

      if (authError) {
        throw authError;
      }

      if (!authData.user) {
        throw new Error('Pendaftaran gagal. Silakan coba lagi.');
      }

      // Step C: Setup family profile or join via onboard API
      const onboardBody: { userId: string; fullName: string; familyName?: string; invitationCode?: string } = {
        userId: authData.user.id,
        fullName,
      };

      if (hasInvitationCode && invitationCode.trim()) {
        onboardBody.invitationCode = invitationCode.trim().toUpperCase();
      } else {
        onboardBody.familyName = familyName || `Keluarga ${fullName}`;
      }

      const res = await fetch('/api/auth/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(onboardBody),
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
          // Ignore
        }
        throw new Error(errorMsg);
      }

      router.replace('/');
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

  const confirmCreateNewFamily = () => {
    setShowDuplicateWarning(false);
    setDuplicateConfirmed(true);
    handleRegister(undefined, true);
  };

  const switchToInvitation = () => {
    setShowDuplicateWarning(false);
    setHasInvitationCode(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative">
        <div className="text-center mb-8">
          <span className="text-4xl">✨</span>
          <h2 className="text-2xl font-bold text-gray-900 mt-2">
            {hasInvitationCode ? 'Gabung ke Keluarga' : 'Daftar Akun Keluarga Baru'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {hasInvitationCode
              ? 'Masukkan kode undangan untuk bergabung dengan kas keluarga Anda.'
              : 'Buat ruang kas keluarga pribadi yang aman & terisolasi.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">
            {error}
          </div>
        )}

        {/* Toggle Invitation Mode */}
        <div className="mb-6 flex p-1 bg-gray-100 rounded-xl">
          <button
            type="button"
            onClick={() => setHasInvitationCode(false)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
              !hasInvitationCode ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            🏠 Buat Keluarga Baru
          </button>
          <button
            type="button"
            onClick={() => setHasInvitationCode(true)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
              hasInvitationCode ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            ✉️ Punya Kode Undangan
          </button>
        </div>

        <form onSubmit={(e) => handleRegister(e)} className="space-y-4">
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

          {hasInvitationCode ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kode Undangan Keluarga <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={invitationCode}
                onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                required
                placeholder="Contoh: INV-A1B2-C3D4"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-mono tracking-wider uppercase"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Minta Admin keluarga Anda untuk menerbitkan kode undangan dari halaman Anggota.
              </p>
            </div>
          ) : (
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
          )}

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
              <span>{hasInvitationCode ? 'Gabung Sekarang' : 'Daftar Sekarang'}</span>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-gray-500">
          Sudah memiliki akun?{' '}
          <Link href="/login" className="text-blue-600 font-semibold hover:underline">
            Masuk di sini
          </Link>
        </div>

        {/* Modal Konfirmasi Peringatan Duplikasi Nama Keluarga */}
        {showDuplicateWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-gray-100 p-6 space-y-4">
              <div className="text-center">
                <span className="text-3xl">⚠️</span>
                <h3 className="font-bold text-gray-900 text-base mt-2">
                  Kemungkinan Keluarga Sudah Ada
                </h3>
                <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                  Kami menemukan kemungkinan data yang mirip dengan nama keluarga yang sudah ada di sistem.
                </p>
                <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 mt-2 leading-relaxed">
                  Jika Anda sebenarnya bermaksud bergabung dengan keluarga tersebut, minta Admin keluarga Anda untuk mengundang dengan <strong>Kode Undangan</strong>.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={confirmCreateNewFamily}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition shadow-sm"
                >
                  Gunakan Nama Ini &amp; Buat Keluarga Baru
                </button>
                <button
                  type="button"
                  onClick={switchToInvitation}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition shadow-sm"
                >
                  ✉️ Saya Punya Kode Undangan
                </button>
                <button
                  type="button"
                  onClick={() => setShowDuplicateWarning(false)}
                  className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs transition"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
