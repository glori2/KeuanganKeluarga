'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AnggotaPage() {
  const [anggotaList, setAnggotaList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAnggota, setSelectedAnggota] = useState<any | null>(null);
  const [name, setName] = useState('');
  const [telegramId, setTelegramId] = useState('');
  const [role, setRole] = useState('member');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchAnggota = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/anggota?keluarga_id=1');
      const data = await res.json();
      setAnggotaList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Gagal mengambil data anggota:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnggota();
  }, []);

  const openModal = (anggota: any = null) => {
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

    setSaving(true);
    setError('');

    try {
      const url = selectedAnggota ? `/api/anggota/${selectedAnggota.id}` : '/api/anggota';
      const method = selectedAnggota ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keluarga_id: 1,
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
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Hapus anggota "${name}"? Semua data transaksi oleh anggota ini juga akan dihapus.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/anggota/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal menghapus anggota');
      fetchAnggota();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus anggota');
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
            onClick={() => openModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-xl text-sm transition shadow-sm flex items-center gap-1.5"
          >
            <span>➕</span> Tambah Anggota
          </button>
        </div>
      </div>

      {/* Info Card Penautan Bot */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-8 text-blue-900 text-sm">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <h3 className="font-bold">Cara Menautkan Bot Telegram ke Anggota:</h3>
            <ol className="list-decimal list-inside space-y-1 text-xs sm:text-sm text-blue-800 mt-1">
              <li>Minta anggota keluarga membuka bot Telegram Anda di HP mereka.</li>
              <li>Anggota cukup mengirim pesan <code className="bg-blue-200/60 px-1 py-0.5 rounded font-mono">/start</code> ke bot.</li>
              <li>Bot akan otomatis mengaitkan akun Telegram mereka dengan profil anggota yang belum terhubung, atau Anda bisa memasukkan ID Telegram manual di sini.</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Tabel Anggota */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <p className="text-center py-12 text-gray-500">Memuat data anggota...</p>
        ) : anggotaList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-200 text-xs font-semibold uppercase text-gray-500">
                  <th className="py-3.5 px-6">Nama Anggota</th>
                  <th className="py-3.5 px-6">Role</th>
                  <th className="py-3.5 px-6">ID Telegram</th>
                  <th className="py-3.5 px-6">Status Bot</th>
                  <th className="py-3.5 px-6 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {anggotaList.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50/50 transition">
                    <td className="py-4 px-6 font-semibold text-gray-800 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                        {a.name.slice(0, 2).toUpperCase()}
                      </div>
                      {a.name}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          a.role === 'admin'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {a.role === 'admin' ? '👑 Admin' : '👤 Member'}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-mono text-xs text-gray-600">
                      {a.telegram_id || <span className="text-gray-400 italic">Belum disetel</span>}
                    </td>
                    <td className="py-4 px-6">
                      {a.telegram_id ? (
                        <span className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 w-fit">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Terhubung
                        </span>
                      ) : (
                        <span className="text-xs bg-amber-50 border border-amber-200 text-amber-700 font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 w-fit">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Belum Terhubung
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openModal(a)}
                          className="px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDelete(a.id, a.name)}
                          className="px-2.5 py-1 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition"
                        >
                          🗑️ Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">Belum ada anggota terdaftar.</div>
        )}
      </div>

      {/* Modal Tambah/Edit Anggota */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-800">
                {selectedAnggota ? '✏️ Edit Anggota' : '➕ Tambah Anggota Baru'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-semibold leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  placeholder="Contoh: Ayah Masruri"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Peran (Role)</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="member">👤 Member (Anggota Keluarga)</option>
                  <option value="admin">👑 Admin (Kepala / Pengelola)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID Telegram (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 884906190"
                  value={telegramId}
                  onChange={(e) => setTelegramId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Bisa dikosongkan jika anggota belum punya ID Telegram.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Anggota'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
