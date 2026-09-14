'use client';

import { useState } from 'react';
import TransaksiModal from './TransaksiModal';

interface TransaksiListProps {
  initialTransactions: any[];
  anggotaList: { id: number; name: string }[];
  rekeningList: { id: number; name: string }[];
  onRefresh?: () => void;
}

export default function TransaksiList({
  initialTransactions,
  anggotaList,
  rekeningList,
  onRefresh,
}: TransaksiListProps) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus transaksi ini? Saldo rekening akan otomatis disesuaikan kembali.')) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/transaksi/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('Gagal menghapus transaksi');
      }
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus transaksi');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (tx: any) => {
    setSelectedTx(tx);
    setIsModalOpen(true);
  };

  const handleSuccess = () => {
    if (onRefresh) onRefresh();
    window.location.reload();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Transaksi Terbaru</h2>
          <p className="text-sm text-gray-500">Daftar catatan kas masuk dan keluar keluarga</p>
        </div>
        <button
          onClick={() => {
            setSelectedTx(null);
            setIsModalOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-xl text-sm transition flex items-center gap-1.5 shadow-sm"
        >
          <span>➕</span> Catat Transaksi
        </button>
      </div>

      {transactions && transactions.length > 0 ? (
        <div className="divide-y divide-gray-100">
          {transactions.map((tx: any) => (
            <div
              key={tx.id}
              className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/75 p-3 rounded-xl transition"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                    tx.type === 'income'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  {tx.type === 'income' ? '↙' : '↗'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{tx.category}</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
                      {tx.rekening_name || 'Dompet Utama'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">{tx.description || '-'}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                    <span>Oleh: <strong className="text-gray-600">{tx.anggota_name || 'Unknown'}</strong></span>
                    <span>•</span>
                    <span>{new Date(tx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pl-13 sm:pl-0">
                <span
                  className={`text-base font-bold ${
                    tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {tx.type === 'income' ? '+' : '-'} Rp {tx.amount.toLocaleString('id-ID')}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(tx)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Edit Transaksi"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(tx.id)}
                    disabled={deletingId === tx.id}
                    className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition disabled:opacity-50"
                    title="Hapus Transaksi"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <span className="text-4xl">📝</span>
          <p className="text-gray-500 font-medium mt-2">Belum ada transaksi tercatat.</p>
          <p className="text-xs text-gray-400 mt-1">Klik tombol Catat Transaksi di atas atau gunakan Bot Telegram.</p>
        </div>
      )}

      <TransaksiModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSuccess}
        initialData={selectedTx}
        anggotaList={anggotaList}
        rekeningList={rekeningList}
      />
    </div>
  );
}
