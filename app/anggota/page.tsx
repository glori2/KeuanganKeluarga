'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Anggota, MemberRole } from '../lib/types';
import TelegramLinkModal from '../components/TelegramLinkModal';

export default function AnggotaPage() {
  const [anggotaList, setAnggotaList] = useState<Anggota[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [telegramTargetAnggota, setTelegramTargetAnggota] = useState<Anggota | null>(null);
  const [selectedAnggota, setSelectedAnggota] = useState<Anggota | null>(null);
  const [name, setName] = useState('');
  const [telegramId, setTelegramId] = useState('');
  const [role, setRole] = useState<MemberRole>('member');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const fetchAnggota = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/anggota');
      if (!res.ok) throw new Error('Gagal mengambil data anggota');
      const data = await res.json();
      setAnggotaList(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      console.error('Gagal mengambil data anggota:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnggota();
  }, [fetchAnggota]);

  const openModal = (anggota: Anggota | null = null) => {
    setSelectedAnggota(anggota);
    if (anggota) {
      setName(anggota.name || '');
      setTelegramId(anggota.telegram_id || '');
      setRole(anggota.role || 'member');
    } else {
      setName('');
      setTelegramId('');
      setRole('member');
    }
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nama anggota wajib diisi');
      return;
    }

    if (telegramId.trim() && !/^\d+$/.test(telegramId.trim())) {
      setError('Telegram User ID harus berupa angka saja (contoh: 123456789). Jangan gunakan @username.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const url = selectedAnggota ? `/api/anggota/${selectedAnggota.id}` : '/api/anggota';
      const method = selectedAnggota ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          telegram_id: telegramId.trim() || null,
          role,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Gagal menyimpan anggota');
      }

      setIsModalOpen(false);
      fetchAnggota();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, memberName: string) => {
    if (
      !confirm(
        `Hapus anggota "${memberName}"? Catatan transaksi yang dibuat oleh anggota ini akan tetap dipertahankan untuk kebutuhan audit.`
      )
    ) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/anggota/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Gagal menghapus anggota');
      }
      fetchAnggota();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus anggota';
      alert(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">👥 Kelola Anggota Keluarga</h1>
          <p className="text-sm text-gray-500 mt-1">
            Daftar anggota keluarga dan penautan akun Telegram untuk mencatat kas.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium px-4 py-2 rounded-xl text-sm transition shadow-sm"
          >
            ← Kembali
          </Link>
          <button
            onClick={() => {
              setTelegramTargetAnggota(null);
              setIsTelegramModalOpen(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-xl text-sm transition shadow-sm flex items-center gap-1.5"
          >
            <span>🤖</span> Kode OTP Telegram
          </button>
          <button
            onClick={() => openModal(null)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-xl text-sm transition shadow-sm flex items-center gap-1.5"
          >
            <span>➕</span> Tambah Anggota
          </button>
        </div>
      </div>

      {/* Info Card Penautan Bot */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5 mb-8 text-blue-900 text-sm shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🤖</span>
            <div>
              <h3 className="font-bold">Penautan Bot Telegram Aman (One-Time Password)</h3>
              <p className="text-xs text-blue-800 mt-1">
                Anggota keluarga dapat menghubungkan akun Telegram mereka secara aman menggunakan kode OTP 8 karakter.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setTelegramTargetAnggota(null);
              setIsTelegramModalOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-sm whitespace-nowrap"
          >
            🔑 Buat Kode Link OTP Sekarang
          </button>
        </div>
      </div>

      {/* Tabel Anggota */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent mb-2"></div>
            <p className="text-sm">Memuat data anggota...</p>
          </div>
        ) : anggotaList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-200 text-xs font-semibold uppercase text-gray-500">
                  <th className="py-3.5 px-6">Nama Anggota</th>
                  <th className="py-3.5 px-6">Peran (Role)</th>
                  <th className="py-3.5 px-6">Status Telegram</th>
                  <th className="py-3.5 px-6 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {anggotaList.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50/75 transition">
                    <td className="py-4 px-6 font-semibold text-gray-800">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                          {a.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p>{a.name}</p>
                          <p className="text-[11px] text-gray-400 font-normal">ID #{a.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                          a.role === 'admin'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {a.role}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {a.telegram_id ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span>✅</span> Terhubung (#{a.telegram_id})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                          <span>⏳</span> Belum Tertaut
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setTelegramTargetAnggota(a);
                            setIsTelegramModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition flex items-center gap-1 shadow-xs"
                          title={`Tautkan Telegram untuk ${a.name}`}
                        >
                          <span>🤖</span>
                          <span>{a.telegram_id ? 'Taut Ulang' : 'Tautkan Telegram'}</span>
                        </button>
                        <button
                          onClick={() => openModal(a)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Edit Anggota"
                          aria-label="Edit Anggota"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(a.id, a.name)}
                          disabled={deletingId === a.id}
                          className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition disabled:opacity-50"
                          title="Hapus Anggota"
                          aria-label="Hapus Anggota"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <span className="text-4xl">👥</span>
            <p className="text-gray-500 font-medium mt-2">Belum ada anggota keluarga terdaftar.</p>
            <button
              onClick={() => openModal(null)}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-xs transition shadow-sm"
            >
              ➕ Tambah Anggota Pertama
            </button>
          </div>
        )}
      </div>

      {/* Modal Tambah / Edit Anggota */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/75">
              <h3 className="font-bold text-gray-900">
                {selectedAnggota ? 'Ubah Profil Anggota' : 'Tambah Anggota Keluarga'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">
                  Nama Lengkap / Panggilan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Contoh: Ayah / Budi / Siti"
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">
                  Peran (Role)
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as MemberRole)}
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500"
                >
                  <option value="admin">👑 Admin (Kelola Semua Rekening & Anggota)</option>
                  <option value="member">👤 Member (Catat Transaksi)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">
                  Telegram User ID (Opsional)
                </label>
                <input
                  type="text"
                  value={telegramId}
                  onChange={(e) => setTelegramId(e.target.value)}
                  placeholder="Contoh: 123456789"
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Bisa diisi manual atau anggota dapat menautkannya sendiri lewat bot Telegram.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {saving ? (
                    <>
                      <span className="inline-block animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></span>
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>{selectedAnggota ? 'Simpan Perubahan' : 'Tambah Anggota'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Telegram Link OTP Modal */}
      <TelegramLinkModal
        isOpen={isTelegramModalOpen}
        onClose={() => {
          setIsTelegramModalOpen(false);
          setTelegramTargetAnggota(null);
          fetchAnggota();
        }}
        targetAnggota={telegramTargetAnggota}
        anggotaList={anggotaList}
      />
    </main>
  );
}
