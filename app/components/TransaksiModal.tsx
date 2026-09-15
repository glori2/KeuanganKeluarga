'use client';

import { useState, useEffect } from 'react';
import { Anggota, Rekening, Transaksi, TransactionType } from '../lib/types';
import { parseMoneyInput } from '../lib/format';

interface TransaksiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Transaksi | null;
  anggotaList: Anggota[];
  rekeningList: Rekening[];
}

export default function TransaksiModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  anggotaList,
  rekeningList,
}: TransaksiModalProps) {
  const [type, setType] = useState<TransactionType>('expense');
  const [rekeningId, setRekeningId] = useState<number | ''>('');
  const [destRekeningId, setDestRekeningId] = useState<number | ''>('');
  const [anggotaId, setAnggotaId] = useState<number | ''>('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Makan');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const categories = {
    expense: [
      'Makan',
      'Belanja',
      'Transportasi',
      'Pendidikan',
      'Kesehatan',
      'Listrik/Air/Internet',
      'Hiburan',
      'Lain-lain',
    ],
    income: ['Gaji', 'Bonus', 'Bisnis / Usaha', 'Investasi', 'Hadiah / THR', 'Lain-lain'],
    transfer: ['Transfer Antar Rekening', 'Tarik Tunai', 'Setor Tunai', 'Top Up E-Wallet'],
  };

  useEffect(() => {
    if (initialData) {
      setType(initialData.type || 'expense');
      setRekeningId(initialData.rekening_id || '');
      setDestRekeningId(initialData.destination_rekening_id || '');
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
      setDestRekeningId(rekeningList[1]?.id || '');
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

    const parsedMoney = parseMoneyInput(amount);
    if (!parsedMoney.valid) {
      setError(parsedMoney.error || 'Nominal tidak valid');
      return;
    }

    if (!rekeningId || !anggotaId) {
      setError('Pilih dompet dan anggota keluarga');
      return;
    }

    if (type === 'transfer') {
      if (!destRekeningId) {
        setError('Pilih dompet / rekening tujuan transfer');
        return;
      }
      if (rekeningId === destRekeningId) {
        setError('Rekening tujuan tidak boleh sama dengan rekening asal');
        return;
      }
    }

    setLoading(true);

    try {
      if (type === 'transfer' && !initialData) {
        // Create transfer via atomic transfer API
        const res = await fetch('/api/transaksi/transfer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source_rekening_id: Number(rekeningId),
            destination_rekening_id: Number(destRekeningId),
            anggota_id: Number(anggotaId),
            amount: parsedMoney.value,
            description: description.trim() || 'Transfer Antar Rekening',
            date: new Date(date).toISOString(),
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Gagal memproses transfer');
        }
      } else {
        const url = initialData ? `/api/transaksi/${initialData.id}` : `/api/transaksi`;
        const method = initialData ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rekening_id: Number(rekeningId),
            destination_rekening_id: type === 'transfer' ? Number(destRekeningId) : null,
            anggota_id: Number(anggotaId),
            amount: parsedMoney.value,
            type,
            category: type === 'transfer' ? 'Transfer Antar Rekening' : category,
            description: description.trim(),
            date: new Date(date).toISOString(),
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Gagal menyimpan transaksi');
        }
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/75">
          <div className="flex items-center gap-2">
            <span className="text-xl">{initialData ? '✏️' : '➕'}</span>
            <h3 className="text-base font-bold text-gray-900">
              {initialData ? 'Ubah Catatan Transaksi' : 'Catat Transaksi Baru'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg text-lg leading-none"
            aria-label="Tutup modal"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
              {error}
            </div>
          )}

          {/* Type Selector (Disabled on edit) */}
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">
              Jenis Transaksi
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={Boolean(initialData)}
                onClick={() => {
                  setType('expense');
                  setCategory(categories.expense[0]);
                }}
                className={`py-2 text-xs font-bold rounded-xl transition border ${
                  type === 'expense'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                ↗ Pengeluaran
              </button>
              <button
                type="button"
                disabled={Boolean(initialData)}
                onClick={() => {
                  setType('income');
                  setCategory(categories.income[0]);
                }}
                className={`py-2 text-xs font-bold rounded-xl transition border ${
                  type === 'income'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                ↙ Pemasukan
              </button>
              <button
                type="button"
                disabled={Boolean(initialData)}
                onClick={() => {
                  setType('transfer');
                  setCategory('Transfer Antar Rekening');
                }}
                className={`py-2 text-xs font-bold rounded-xl transition border ${
                  type === 'transfer'
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                🔁 Transfer
              </button>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">
              Nominal (Rupiah) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-sm font-bold text-gray-400">Rp</span>
              <input
                type="number"
                step="any"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                placeholder="50000"
                className="w-full pl-10 pr-3.5 py-2.5 border border-gray-300 rounded-xl text-base font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Account Selection */}
          {type === 'transfer' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">
                  Dari Dompet (Sumber) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={rekeningId}
                  onChange={(e) => setRekeningId(Number(e.target.value))}
                  required
                  disabled={Boolean(initialData)}
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                >
                  {rekeningList.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} (Rp {r.balance.toLocaleString('id-ID')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">
                  Ke Dompet (Tujuan) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={destRekeningId}
                  onChange={(e) => setDestRekeningId(Number(e.target.value))}
                  required
                  disabled={Boolean(initialData)}
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                >
                  {rekeningList.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} (Rp {r.balance.toLocaleString('id-ID')})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">
                Dompet / Rekening <span className="text-rose-500">*</span>
              </label>
              <select
                value={rekeningId}
                onChange={(e) => setRekeningId(Number(e.target.value))}
                required
                className="w-full border border-gray-300 rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500"
              >
                {rekeningList.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} (Rp {r.balance.toLocaleString('id-ID')})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Member & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">
                Anggota Keluarga <span className="text-rose-500">*</span>
              </label>
              <select
                value={anggotaId}
                onChange={(e) => setAnggotaId(Number(e.target.value))}
                required
                className="w-full border border-gray-300 rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500"
              >
                {anggotaList.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.role})
                  </option>
                ))}
              </select>
            </div>

            {type !== 'transfer' && (
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">
                  Kategori
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                >
                  {categories[type].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Date & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">
                Tanggal Transaksi
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-xl p-2 text-xs font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">
                Keterangan (Opsional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Contoh: Makan siang Padang"
                className="w-full border border-gray-300 rounded-xl p-2 text-xs font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <span className="inline-block animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></span>
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>{initialData ? 'Simpan Perubahan' : 'Catat Sekarang'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
