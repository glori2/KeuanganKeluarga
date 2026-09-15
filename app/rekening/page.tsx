'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Rekening, RekeningType } from '../lib/types';
import { formatRupiah, parseMoneyInput } from '../lib/format';

export default function RekeningPage() {
  const [rekeningList, setRekeningList] = useState<Rekening[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRekening, setSelectedRekening] = useState<Rekening | null>(null);
  const [name, setName] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [type, setType] = useState<RekeningType>('cash');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const fetchRekening = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rekening');
      if (!res.ok) {
        throw new Error('Gagal mengambil data rekening');
      }
      const data = await res.json();
      setRekeningList(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      console.error('Gagal mengambil data rekening:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRekening();
  }, [fetchRekening]);

  const openModal = (rekening: Rekening | null = null) => {
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

    const parsedMoney = parseMoneyInput(initialBalance || 0);
    if (!parsedMoney.valid && !selectedRekening) {
      setError(parsedMoney.error || 'Saldo awal tidak valid');
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
          name: name.trim(),
          initial_balance: parsedMoney.value,
          type,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Gagal menyimpan rekening');
      }

      setIsModalOpen(false);
      fetchRekening();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, rekName: string) => {
    if (
      !confirm(
        `Hapus dompet "${rekName}"? Semua catatan transaksi yang terikat dengan dompet ini juga akan dibatalkan/dihapus.`
      )
    ) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/rekening/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Gagal menghapus dompet');
      }
      fetchRekening();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus dompet';
      alert(message);
    } finally {
      setDeletingId(null);
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
            onClick={() => openModal(null)}
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
          <p className="text-3xl font-extrabold mt-1">{formatRupiah(totalAll)}</p>
        </div>
        <span className="text-4xl opacity-80">🏦</span>
      </div>

      {/* Grid Rekening */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent mb-2"></div>
          <p className="text-sm">Memuat daftar rekening...</p>
        </div>
      ) : rekeningList.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {rekeningList.map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition"
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg uppercase">
                    {r.type}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openModal(r)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Edit Dompet"
                      aria-label="Edit Dompet"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(r.id, r.name)}
                      disabled={deletingId === r.id}
                      className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition disabled:opacity-50"
                      title="Hapus Dompet"
                      aria-label="Hapus Dompet"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-900">{r.name}</h3>
                <p className="text-2xl font-extrabold text-blue-600 mt-2">
                  {formatRupiah(r.balance)}
                </p>
              </div>
              <p className="text-xs text-gray-400 mt-4 pt-3 border-t border-gray-50">
                ID Rekening #{r.id}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
          <span className="text-4xl">💳</span>
          <h3 className="font-bold text-gray-800 text-lg mt-3">Belum ada dompet kas</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
            Buat dompet pertama Anda (misal: Dompet Tunai, Rekening BCA) untuk mulai mencatat keuangan.
          </p>
          <button
            onClick={() => openModal(null)}
            className="mt-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition shadow-sm"
          >
            ➕ Tambah Dompet Sekarang
          </button>
        </div>
      )}

      {/* Modal Tambah / Edit Rekening */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/75">
              <h3 className="font-bold text-gray-900">
                {selectedRekening ? 'Ubah Dompet / Rekening' : 'Tambah Dompet / Rekening Baru'}
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
                  Nama Dompet / Rekening <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Contoh: Dompet Tunai / BCA Utama"
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">
                  Jenis Simpanan
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as RekeningType)}
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500"
                >
                  <option value="cash">💵 Uang Tunai (Cash)</option>
                  <option value="bank">🏦 Rekening Bank</option>
                  <option value="ewallet">📱 E-Wallet (GoPay/OVO/ShopeePay)</option>
                  <option value="investment">📈 Tabungan / Investasi</option>
                  <option value="other">📦 Lainnya</option>
                </select>
              </div>

              {!selectedRekening && (
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">
                    Saldo Awal (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(e.target.value)}
                    placeholder="0"
                    className="w-full border border-gray-300 rounded-xl p-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Saldo awal yang tersimpan di rekening saat pertama kali dibuat.
                  </p>
                </div>
              )}

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
                    <span>{selectedRekening ? 'Simpan Perubahan' : 'Tambah Dompet'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
