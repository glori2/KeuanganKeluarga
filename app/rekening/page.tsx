'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function RekeningPage() {
  const [rekeningList, setRekeningList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRekening, setSelectedRekening] = useState<any | null>(null);
  const [name, setName] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [type, setType] = useState('cash');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchRekening = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rekening?keluarga_id=1');
      const data = await res.json();
      setRekeningList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Gagal mengambil data rekening:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRekening();
  }, []);

  const openModal = (rekening: any = null) => {
    setSelectedRekening(rekening);
    if (rekening) {
      setName(rekening.name || '');
      setInitialBalance(String(rekening.balance || 0));
      setType(rekening.type || 'cash');
    } else {
      setName('');
      setInitialBalance('0');
      setType('cash');
    }
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nama dompet/rekening wajib diisi');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const url = selectedRekening ? `/api/rekening/${selectedRekening.id}` : '/api/rekening';
      const method = selectedRekening ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keluarga_id: 1,
          name: name.trim(),
          initial_balance: parseFloat(initialBalance) || 0,
          type,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Gagal menyimpan rekening');
      }

      setIsModalOpen(false);
      fetchRekening();
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (
      !confirm(
        `Hapus dompet "${name}"? Semua catatan transaksi yang terikat dengan dompet ini juga akan dihapus.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/rekening/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal menghapus dompet');
      fetchRekening();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus dompet');
    }
  };

  const totalAll = rekeningList.reduce((acc, r) => acc + Number(r.balance), 0);

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">💳 Kelola Dompet & Rekening</h1>
          <p className="text-sm text-gray-500 mt-1">
            Atur tempat penyimpanan kas keluarga (Uang Tunai, Bank BCA/Mandiri, E-Wallet, dsb).
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
            <span>➕</span> Tambah Dompet
          </button>
        </div>
      </div>

      {/* Ringkasan Total Saldo */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white rounded-2xl p-6 shadow-sm mb-8 flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold uppercase text-blue-200 tracking-wider">
            Total Seluruh Saldo Kas
          </span>
          <p className="text-3xl font-extrabold mt-1">Rp {totalAll.toLocaleString('id-ID')}</p>
        </div>
        <span className="text-4xl opacity-80">🏦</span>
      </div>

      {/* Grid Rekening */}
      {loading ? (
        <p className="text-center py-12 text-gray-500">Memuat daftar rekening...</p>
      ) : rekeningList.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {rekeningList.map((r) => (
            <div
              key={r.id}
              className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition"
            >
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold uppercase px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg">
                    {r.type === 'bank' ? '🏦 Bank' : r.type === 'ewallet' ? '📱 E-Wallet' : '💵 Tunai / Cash'}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openModal(r)}
                      className="p-1 text-gray-400 hover:text-blue-600 rounded"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    {rekeningList.length > 1 && (
                      <button
                        onClick={() => handleDelete(r.id, r.name)}
                        className="p-1 text-gray-400 hover:text-rose-600 rounded"
                        title="Hapus"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="font-bold text-lg text-gray-800 mt-4">{r.name}</h3>
                <p className="text-2xl font-extrabold text-gray-900 mt-2">
                  Rp {Number(r.balance).toLocaleString('id-ID')}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between text-xs text-gray-400">
                <span>ID Rekening: #{r.id}</span>
                <span className="text-emerald-600 font-medium">Aktif</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">Belum ada dompet terdaftar.</div>
      )}

      {/* Modal Tambah/Edit Rekening */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-800">
                {selectedRekening ? '✏️ Edit Dompet' : '➕ Tambah Dompet Baru'}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Dompet / Rekening
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Rekening BCA, Dompet Tunai Ayah, Gopay"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Simpanan</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="cash">💵 Uang Tunai (Cash)</option>
                  <option value="bank">🏦 Rekening Bank</option>
                  <option value="ewallet">📱 E-Wallet (Gopay/OVO/ShopeePay/DANA)</option>
                </select>
              </div>

              {!selectedRekening && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Saldo Awal (Rp)
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm font-semibold"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Masukkan saldo saat ini pada dompet/rekening tersebut.
                  </p>
                </div>
              )}

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
                  {saving ? 'Menyimpan...' : 'Simpan Dompet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
