'use client';

import { useState, useEffect, useCallback } from 'react';
import { AuditLogEntry } from '../lib/types';
import { formatDateTime, formatRupiah } from '../lib/format';

interface AuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaksiId: number | null;
}

export default function AuditModal({ isOpen, onClose, transaksiId }: AuditModalProps) {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAudit = useCallback(async () => {
    if (!transaksiId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/transaksi/${transaksiId}/audit`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal memuat riwayat audit');
      }
      const data = await res.json();
      setAuditLogs(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan memuat audit';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [transaksiId]);

  useEffect(() => {
    if (isOpen && transaksiId) {
      fetchAudit();
    } else {
      setAuditLogs([]);
      setError(null);
    }
  }, [isOpen, transaksiId, fetchAudit]);

  if (!isOpen || !transaksiId) return null;

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE':
        return <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2 py-0.5 rounded-full">✨ Dibuat (CREATE)</span>;
      case 'UPDATE':
        return <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded-full">✏️ Diubah (UPDATE)</span>;
      case 'VOID':
        return <span className="bg-rose-100 text-rose-800 text-xs font-semibold px-2 py-0.5 rounded-full">🚫 Dibatalkan (VOID)</span>;
      case 'TRANSFER':
        return <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-2 py-0.5 rounded-full">🔁 Transfer</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 text-xs font-semibold px-2 py-0.5 rounded-full">{action}</span>;
    }
  };

  const getActorLabel = (entry: AuditLogEntry) => {
    if (entry.actor_type === 'telegram') {
      return (
        <span className="flex items-center gap-1 text-xs text-indigo-700 font-medium bg-indigo-50 px-2 py-0.5 rounded">
          <span>🤖</span> Telegram ({entry.actor_name || 'Member'}{entry.telegram_id ? ` #${entry.telegram_id}` : ''})
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-xs text-gray-700 font-medium bg-gray-100 px-2 py-0.5 rounded">
        <span>🌐</span> Web ({entry.actor_name || 'Pengguna'})
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/75">
          <div className="flex items-center gap-2">
            <span className="text-xl">📜</span>
            <div>
              <h3 className="text-base font-bold text-gray-900">Riwayat Audit Transaksi #{transaksiId}</h3>
              <p className="text-xs text-gray-500">Catatan jejak aktivitas yang tidak dapat diubah (Immutable Ledger)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 text-lg leading-none"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {loading && (
            <div className="py-12 text-center text-gray-500">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent mb-2"></div>
              <p className="text-sm">Memuat riwayat audit...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm">
              <p className="font-semibold">Gagal memuat data audit</p>
              <p className="text-xs mt-0.5">{error}</p>
            </div>
          )}

          {!loading && !error && auditLogs.length === 0 && (
            <div className="py-12 text-center text-gray-400">
              <p className="text-sm">Belum ada catatan audit untuk transaksi ini.</p>
            </div>
          )}

          {!loading && !error && auditLogs.length > 0 && (
            <div className="relative border-l-2 border-gray-200 ml-4 space-y-6">
              {auditLogs.map((entry) => (
                <div key={entry.id} className="relative pl-6">
                  {/* Timeline dot */}
                  <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-white border-2 border-blue-600"></div>

                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {getActionBadge(entry.action)}
                        {getActorLabel(entry)}
                      </div>
                      <span className="text-xs text-gray-400 font-mono">
                        {formatDateTime(entry.created_at)}
                      </span>
                    </div>

                    {/* Snapshot / details */}
                    {entry.action === 'VOID' && entry.new_data && (
                      <div className="mt-2 text-xs text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-100">
                        <p className="font-semibold">Alasan Pembatalan:</p>
                        <p className="mt-0.5">{String(entry.new_data.void_reason || 'Tidak ada keterangan')}</p>
                      </div>
                    )}

                    {entry.action === 'UPDATE' && entry.old_data && entry.new_data && (
                      <div className="mt-2 text-xs space-y-1 bg-white p-2.5 rounded-lg border border-gray-200">
                        <p className="font-semibold text-gray-700">Perubahan Data:</p>
                        {entry.old_data.amount !== entry.new_data.amount && (
                          <p className="text-gray-600">
                            • Nominal: <span className="line-through text-rose-600">{formatRupiah(entry.old_data.amount as number)}</span> ➔ <span className="font-bold text-emerald-600">{formatRupiah(entry.new_data.amount as number)}</span>
                          </p>
                        )}
                        {entry.old_data.category !== entry.new_data.category && (
                          <p className="text-gray-600">
                            • Kategori: <span className="line-through">{String(entry.old_data.category)}</span> ➔ <span className="font-semibold">{String(entry.new_data.category)}</span>
                          </p>
                        )}
                        {entry.old_data.description !== entry.new_data.description && (
                          <p className="text-gray-600">
                            • Keterangan: {String(entry.old_data.description || '-')} ➔ {String(entry.new_data.description || '-')}
                          </p>
                        )}
                      </div>
                    )}

                    {entry.action === 'CREATE' && entry.new_data && (
                      <div className="mt-2 text-xs text-gray-600 bg-white p-2.5 rounded-lg border border-gray-200">
                        <p>Nominal: <strong className="text-gray-900">{formatRupiah(entry.new_data.amount as number)}</strong></p>
                        <p>Kategori: {String(entry.new_data.category || '-')}</p>
                        <p>Keterangan: {String(entry.new_data.description || '-')}</p>
                      </div>
                    )}

                    {entry.action === 'TRANSFER' && entry.new_data && (
                      <div className="mt-2 text-xs text-gray-600 bg-white p-2.5 rounded-lg border border-gray-200">
                        <p>Nominal Transfer: <strong className="text-purple-700">{formatRupiah(entry.new_data.amount as number)}</strong></p>
                        <p>Keterangan: {String(entry.new_data.description || 'Transfer Antar Rekening')}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl text-xs transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
