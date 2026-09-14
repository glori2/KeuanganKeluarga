'use client';

import { useState, useEffect } from 'react';

interface TransaksiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any | null;
  anggotaList: { id: number; name: string }[];
  rekeningList: { id: number; name: string }[];
}

export default function TransaksiModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  anggotaList,
  rekeningList,
}: TransaksiModalProps) {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [rekeningId, setRekeningId] = useState<number | ''>('');
  const [anggotaId, setAnggotaId] = useState<number | ''>('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Makan');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const categories = {
    expense: ['Makan', 'Belanja', 'Transportasi', 'Pendidikan', 'Kesehatan', 'Listrik/Air/Internet', 'Hiburan', 'Lain-lain'],
    income: ['Gaji', 'Bonus', 'Bisnis / Usaha', 'Investasi', 'Hadiah / THR', 'Lain-lain'],
  };

  useEffect(() => {
    if (initialData) {
      setType(initialData.type || 'expense');
      setRekeningId(initialData.rekening_id || '');
      setAnggotaId(initialData.anggota_id || '');
      setAmount(String(initialData.amount || ''));
      setCategory(initialData.category || 'Makan');
      setDescription(initialData.description || '');
      setDate(
        initialData.date
          ? new Date(initialData.date).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10)
      );
    } else {
      setType('expense');
      setRekeningId(rekeningList[0]?.id || '');
      setAnggotaId(anggotaList[0]?.id || '');
      setAmount('');
      setCategory('Makan');
      setDescription('');
      setDate(new Date().toISOString().slice(0, 10));
    }
    setError('');
  }, [initialData, isOpen, rekeningList, anggotaList]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Nominal harus lebih besar dari 0');
      return;
    }

    if (!rekeningId || !anggotaId) {
      setError('Pilih dompet dan anggota keluarga');
      return;
    }

    setLoading(true);

    try {
      const url = initialData ? `/api/transaksi/${initialData.id}` : `/api/transaksi`;
      const method = initialData ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rekening_id: Number(rekeningId),
          anggota_id: Number(anggotaId),
          amount: numAmount,
          type,
          category,
          description,
          date: new Date(date).toISOString(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menyimpan transaksi');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-800">
            {initialData ? '✏️ Edit Transaksi' : '➕ Tambah Transaksi'}
          </h3>
          <button
            onClick={onClose}
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

          {/* Jenis Transaksi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Transaksi</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setType('expense');
                  setCategory('Makan');
                }}
                className={`py-2 px-4 rounded-lg font-semibold text-sm transition border ${
                  type === 'expense'
                    ? 'bg-red-50 border-red-500 text-red-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                🔴 Pengeluaran
              </button>
              <button
                type="button"
                onClick={() => {
                  setType('income');
                  setCategory('Gaji');
                }}
                className={`py-2 px-4 rounded-lg font-semibold text-sm transition border ${
                  type === 'income'
                    ? 'bg-green-50 border-green-500 text-green-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                🟢 Pemasukan
              </button>
            </div>
          </div>

          {/* Nominal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nominal (Rp)</label>
            <input
              type="number"
              placeholder="Contoh: 50000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-semibold"
            />
          </div>

          {/* Kategori & Tanggal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                {categories[type].map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          </div>

          {/* Dompet & Anggota */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dompet / Rekening</label>
              <select
                value={rekeningId}
                onChange={(e) => setRekeningId(Number(e.target.value))}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                {rekeningList.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Oleh Anggota</label>
              <select
                value={anggotaId}
                onChange={(e) => setAnggotaId(Number(e.target.value))}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                {anggotaList.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Keterangan */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan (Opsional)</label>
            <input
              type="text"
              placeholder="Contoh: Makan siang bersama keluarga di warung"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : initialData ? 'Perbarui Transaksi' : 'Simpan Transaksi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
