'use client';

import { useState } from 'react';
import { Transaksi } from '../lib/types';
import { formatRupiah } from '../lib/format';

interface VoidConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  transaction: Transaksi | null;
  loading: boolean;
}

export default function VoidConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  transaction,
  loading,
}: VoidConfirmationModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  if (!isOpen || !transaction) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await onConfirm(reason.trim());
      setReason('');
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal membatalkan transaksi';
      setError(message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100">
        <div className="p-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl mb-4">
            ⚠️
          </div>

          <h3 className="text-lg font-bold text-gray-900">Batalkan Transaksi (Void)?</h3>
          <p className="text-sm text-gray-500 mt-1">
            Transaksi tidak akan dihapus permanen, melainkan ditandai sebagai <strong>DIBATALKAN (VOID)</strong> untuk menjaga integritas riwayat audit kas.
          </p>

          <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs space-y-1">
            <p className="text-gray-700">
              <strong>Kategori:</strong> {transaction.category}
            </p>
            <p className="text-gray-700">
              <strong>Nominal:</strong> {formatRupiah(transaction.amount)} ({transaction.type === 'income' ? 'Pemasukan' : transaction.type === 'expense' ? 'Pengeluaran' : 'Transfer'})
            </p>
            <p className="text-gray-700">
              <strong>Dompet:</strong> {transaction.rekening_name || 'Dompet'}
            </p>
            <p className="text-emerald-700 font-semibold pt-1">
              ✨ Saldo dompet akan otomatis dikembalikan ke kondisi sebelum transaksi ini dibuat.
            </p>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Alasan Pembatalan (Opsional)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Contoh: Salah input nominal / duplikat"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition"
              >
                Kembali
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {loading ? (
                  <>
                    <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></span>
                    <span>Memproses...</span>
                  </>
                ) : (
                  <span>Batalkan Transaksi</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
