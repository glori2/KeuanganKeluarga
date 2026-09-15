'use client';

import { useState } from 'react';
import { Anggota, Rekening, Transaksi } from '../lib/types';
import { formatDate, formatRupiah } from '../lib/format';
import TransaksiModal from './TransaksiModal';
import VoidConfirmationModal from './VoidConfirmationModal';
import AuditModal from './AuditModal';

interface TransaksiListProps {
  initialTransactions: Transaksi[];
  anggotaList: Anggota[];
  rekeningList: Rekening[];
  onRefresh?: () => void;
}

export default function TransaksiList({
  initialTransactions,
  anggotaList,
  rekeningList,
  onRefresh,
}: TransaksiListProps) {
  const [transactions, setTransactions] = useState<Transaksi[]>(initialTransactions);
  const [selectedTx, setSelectedTx] = useState<Transaksi | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Void modal state
  const [voidTx, setVoidTx] = useState<Transaksi | null>(null);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [voidLoading, setVoidLoading] = useState(false);

  // Audit modal state
  const [auditTxId, setAuditTxId] = useState<number | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  const handleOpenVoid = (tx: Transaksi) => {
    if (tx.status === 'voided') {
      alert('Transaksi ini sudah dibatalkan sebelumnya.');
      return;
    }
    setVoidTx(tx);
    setIsVoidModalOpen(true);
  };

  const handleConfirmVoid = async (reason: string) => {
    if (!voidTx) return;
    setVoidLoading(true);
    try {
      const res = await fetch(`/api/transaksi/${voidTx.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ void_reason: reason }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Gagal membatalkan transaksi');
      }

      // Mark local transaction as voided
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === voidTx.id
            ? { ...t, status: 'voided', void_reason: reason, voided_at: new Date().toISOString() }
            : t
        )
      );

      if (onRefresh) onRefresh();
    } finally {
      setVoidLoading(false);
    }
  };

  const handleEdit = (tx: Transaksi) => {
    if (tx.status === 'voided') {
      alert('Transaksi yang sudah dibatalkan (voided) tidak dapat diedit kembali.');
      return;
    }
    setSelectedTx(tx);
    setIsModalOpen(true);
  };

  const handleOpenAudit = (id: number) => {
    setAuditTxId(id);
    setIsAuditModalOpen(true);
  };

  const handleSuccess = () => {
    if (onRefresh) onRefresh();
    window.location.reload();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Transaksi Terbaru</h2>
          <p className="text-sm text-gray-500">
            Daftar catatan kas masuk, keluar, dan transfer keluarga
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedTx(null);
            setIsModalOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-xl text-sm transition flex items-center gap-1.5 shadow-sm self-start sm:self-auto"
        >
          <span>➕</span> Catat Transaksi
        </button>
      </div>

      {transactions && transactions.length > 0 ? (
        <div className="divide-y divide-gray-100">
          {transactions.map((tx) => {
            const isVoided = tx.status === 'voided';

            return (
              <div
                key={tx.id}
                className={`py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl transition ${
                  isVoided ? 'bg-gray-50/50 opacity-60' : 'hover:bg-gray-50/75'
                }`}
              >
                {/* Left info */}
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                      isVoided
                        ? 'bg-gray-200 text-gray-500'
                        : tx.type === 'income'
                        ? 'bg-emerald-100 text-emerald-700'
                        : tx.type === 'transfer'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {isVoided ? '🚫' : tx.type === 'income' ? '↙' : tx.type === 'transfer' ? '🔁' : '↗'}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`font-semibold ${isVoided ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                        {tx.category}
                      </span>

                      {/* Status badge */}
                      {isVoided ? (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                          Dibatalkan (Void)
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                          Posted
                        </span>
                      )}

                      {/* Account badge */}
                      <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
                        {tx.type === 'transfer' && tx.destination_rekening_name
                          ? `${tx.rekening_name || 'Dompet'} ➔ ${tx.destination_rekening_name}`
                          : tx.rekening_name || 'Dompet Utama'}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 mt-0.5">
                      {tx.description || '-'}
                      {isVoided && tx.void_reason && (
                        <span className="block text-xs text-rose-600 italic mt-0.5">
                          Alasan batal: {tx.void_reason}
                        </span>
                      )}
                    </p>

                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                      <span>
                        Oleh: <strong className="text-gray-600">{tx.anggota_name || 'Unknown'}</strong>
                      </span>
                      <span>•</span>
                      <span>{formatDate(tx.date)}</span>
                    </div>
                  </div>
                </div>

                {/* Right actions & amount */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-13 sm:pl-0">
                  <span
                    className={`text-base font-bold ${
                      isVoided
                        ? 'line-through text-gray-400'
                        : tx.type === 'income'
                        ? 'text-emerald-600'
                        : tx.type === 'transfer'
                        ? 'text-purple-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {tx.type === 'income' ? '+' : tx.type === 'transfer' ? '🔁' : '-'} {formatRupiah(tx.amount)}
                  </span>

                  <div className="flex items-center gap-1">
                    {/* Audit Trail button */}
                    <button
                      onClick={() => handleOpenAudit(tx.id)}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                      title="Lihat Riwayat Audit"
                      aria-label="Lihat Riwayat Audit"
                    >
                      📜
                    </button>

                    {/* Edit button (disabled for voided) */}
                    {!isVoided && (
                      <button
                        onClick={() => handleEdit(tx)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Edit Transaksi"
                        aria-label="Edit Transaksi"
                      >
                        ✏️
                      </button>
                    )}

                    {/* Void / Batalkan button (disabled for voided) */}
                    {!isVoided && (
                      <button
                        onClick={() => handleOpenVoid(tx)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Batalkan Transaksi (Void)"
                        aria-label="Batalkan Transaksi"
                      >
                        🚫
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <span className="text-4xl">📝</span>
          <p className="text-gray-500 font-medium mt-2">Belum ada transaksi tercatat.</p>
          <p className="text-xs text-gray-400 mt-1">
            Klik tombol Catat Transaksi di atas atau gunakan Bot Telegram.
          </p>
        </div>
      )}

      {/* Edit / Create Modal */}
      <TransaksiModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSuccess}
        initialData={selectedTx}
        anggotaList={anggotaList}
        rekeningList={rekeningList}
      />

      {/* Void Confirmation Modal */}
      <VoidConfirmationModal
        isOpen={isVoidModalOpen}
        onClose={() => setIsVoidModalOpen(false)}
        onConfirm={handleConfirmVoid}
        transaction={voidTx}
        loading={voidLoading}
      />

      {/* Audit Log Modal */}
      <AuditModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        transaksiId={auditTxId}
      />
    </div>
  );
}
