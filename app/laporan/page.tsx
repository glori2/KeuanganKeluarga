'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import TransaksiModal from '../components/TransaksiModal';
import VoidConfirmationModal from '../components/VoidConfirmationModal';
import AuditModal from '../components/AuditModal';
import { Anggota, LaporanSummary, Rekening, Transaksi } from '../lib/types';
import { formatDate, formatRupiah } from '../lib/format';

export default function LaporanPage() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [anggotaId, setAnggotaId] = useState('');
  const [anggotaList, setAnggotaList] = useState<Anggota[]>([]);
  const [rekeningList, setRekeningList] = useState<Rekening[]>([]);
  const [transactions, setTransactions] = useState<Transaksi[]>([]);
  const [summary, setSummary] = useState<LaporanSummary>({ total_income: 0, total_expense: 0, net: 0 });
  const [loading, setLoading] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaksi | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Void modal state
  const [voidTx, setVoidTx] = useState<Transaksi | null>(null);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [voidLoading, setVoidLoading] = useState(false);

  // Audit modal state
  const [auditTxId, setAuditTxId] = useState<number | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // Fetch anggota and rekening lists
  useEffect(() => {
    fetch('/api/anggota')
      .then((res) => res.json())
      .then((data) => setAnggotaList(Array.isArray(data) ? data : []))
      .catch((err) => console.error('Gagal mengambil anggota:', err));

    fetch('/api/rekening')
      .then((res) => res.json())
      .then((data) => setRekeningList(Array.isArray(data) ? data : []))
      .catch((err) => console.error('Gagal mengambil rekening:', err));
  }, []);

  const fetchLaporan = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/laporan?month=${month}&year=${year}`;
      if (anggotaId) {
        url += `&anggota_id=${anggotaId}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
        setSummary(data.summary || { total_income: 0, total_expense: 0, net: 0 });
      }
    } catch (error) {
      console.error('Failed to fetch laporan', error);
    } finally {
      setLoading(false);
    }
  }, [month, year, anggotaId]);

  useEffect(() => {
    fetchLaporan();
  }, [fetchLaporan]);

  const handleDownload = () => {
    let url = `/api/laporan/export?month=${month}&year=${year}`;
    if (anggotaId) {
      url += `&anggota_id=${anggotaId}`;
    }
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `laporan-keuangan-${year}-${month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

      fetchLaporan();
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

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">📑 Laporan Keuangan Bulanan</h1>
          <p className="text-sm text-gray-500 mt-1">
            Rekapitulasi pemasukan, pengeluaran, dan ekspor data kas keluarga.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium px-4 py-2 rounded-xl text-sm transition shadow-sm"
          >
            ← Kembali ke Dashboard
          </Link>
          <button
            onClick={() => {
              setSelectedTx(null);
              setIsModalOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-xl text-sm transition shadow-sm"
          >
            ➕ Catat Transaksi
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Bulan</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full border-gray-300 rounded-xl p-2.5 border text-sm font-medium focus:ring-2 focus:ring-blue-500"
            >
              {[...Array(12)].map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(0, i).toLocaleString('id-ID', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Tahun</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full border-gray-300 rounded-xl p-2.5 border text-sm font-medium focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Anggota</label>
            <select
              value={anggotaId}
              onChange={(e) => setAnggotaId(e.target.value)}
              className="w-full border-gray-300 rounded-xl p-2.5 border text-sm font-medium focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Semua Anggota</option>
              {anggotaList.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <button
              onClick={handleDownload}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold p-2.5 rounded-xl text-sm transition shadow-sm flex items-center justify-center gap-2"
            >
              <span>📥</span> Unduh Laporan (CSV)
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase text-gray-400">Total Pemasukan</span>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              + {formatRupiah(summary.total_income)}
            </p>
          </div>
          <span className="text-3xl p-3 bg-emerald-50 rounded-2xl text-emerald-600">↙</span>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase text-gray-400">Total Pengeluaran</span>
            <p className="text-2xl font-bold text-rose-600 mt-1">
              - {formatRupiah(summary.total_expense)}
            </p>
          </div>
          <span className="text-3xl p-3 bg-rose-50 rounded-2xl text-rose-600">↗</span>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase text-gray-400">Selisih Bersih (Net)</span>
            <p
              className={`text-2xl font-bold mt-1 ${
                summary.net >= 0 ? 'text-blue-600' : 'text-amber-600'
              }`}
            >
              {formatRupiah(summary.net)}
            </p>
          </div>
          <span className="text-3xl p-3 bg-blue-50 rounded-2xl text-blue-600">⚖️</span>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800">
            Daftar Transaksi (Bulan {month} Tahun {year})
          </h2>
          <span className="text-xs text-gray-400">
            {transactions.length} baris transaksi
          </span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent mb-2"></div>
            <p className="text-sm">Memuat data laporan...</p>
          </div>
        ) : transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-200 text-xs font-semibold uppercase text-gray-500">
                  <th className="py-3.5 px-6">Tanggal</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6">Anggota</th>
                  <th className="py-3.5 px-6">Dompet</th>
                  <th className="py-3.5 px-6">Kategori</th>
                  <th className="py-3.5 px-6">Keterangan</th>
                  <th className="py-3.5 px-6 text-right">Nominal</th>
                  <th className="py-3.5 px-6 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {transactions.map((tx) => {
                  const isVoided = tx.status === 'voided';

                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-gray-50/75 transition ${
                        isVoided ? 'bg-gray-50/50 opacity-60' : ''
                      }`}
                    >
                      <td className="py-4 px-6 text-xs text-gray-600 whitespace-nowrap">
                        {formatDate(tx.date)}
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        {isVoided ? (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                            Voided
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                            Posted
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 font-medium text-gray-900 whitespace-nowrap">
                        {tx.anggota_name}
                      </td>
                      <td className="py-4 px-6 text-gray-600 text-xs whitespace-nowrap">
                        {tx.type === 'transfer' && tx.destination_rekening_name
                          ? `${tx.rekening_name} ➔ ${tx.destination_rekening_name}`
                          : tx.rekening_name}
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span className="inline-block px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-700">
                          {tx.category}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-gray-600 text-xs max-w-xs truncate">
                        {tx.description || '-'}
                        {isVoided && tx.void_reason && (
                          <span className="block text-rose-600 italic mt-0.5">
                            Batal: {tx.void_reason}
                          </span>
                        )}
                      </td>
                      <td
                        className={`py-4 px-6 text-right font-bold whitespace-nowrap ${
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
                      </td>
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenAudit(tx.id)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            title="Lihat Riwayat Audit"
                            aria-label="Lihat Riwayat Audit"
                          >
                            📜
                          </button>
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <span className="text-4xl">📄</span>
            <p className="mt-2 text-sm">Tidak ada transaksi ditemukan pada periode ini.</p>
          </div>
        )}
      </div>

      {/* Transaksi Modal */}
      <TransaksiModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchLaporan}
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
    </main>
  );
}
