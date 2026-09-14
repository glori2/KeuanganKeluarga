'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import TransaksiModal from '../components/TransaksiModal';

export default function LaporanPage() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [anggotaId, setAnggotaId] = useState('');
  const [anggotaList, setAnggotaList] = useState<any[]>([]);
  const [rekeningList, setRekeningList] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [summary, setSummary] = useState({ total_income: 0, total_expense: 0, net: 0 });
  const [loading, setLoading] = useState(false);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Ambil daftar anggota dan rekening
  useEffect(() => {
    fetch('/api/anggota?keluarga_id=1')
      .then((res) => res.json())
      .then((data) => setAnggotaList(Array.isArray(data) ? data : []))
      .catch((err) => console.error('Gagal mengambil anggota:', err));

    fetch('/api/rekening?keluarga_id=1')
      .then((res) => res.json())
      .then((data) => setRekeningList(Array.isArray(data) ? data : []))
      .catch((err) => console.error('Gagal mengambil rekening:', err));
  }, []);

  const fetchLaporan = async () => {
    setLoading(true);
    try {
      let url = `/api/keluarga/1/laporan?month=${month}&year=${year}`;
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
  };

  useEffect(() => {
    fetchLaporan();
  }, [month, year, anggotaId]);

  const handleDownload = () => {
    let url = `/api/keluarga/1/laporan/export?month=${month}&year=${year}`;
    if (anggotaId) {
      url += `&anggota_id=${anggotaId}`;
    }
    window.location.href = url;
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus transaksi ini? Saldo rekening akan disesuaikan kembali.')) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/transaksi/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal menghapus');
      fetchLaporan();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (tx: any) => {
    setSelectedTx(tx);
    setIsModalOpen(true);
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
              {anggotaList.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium p-2.5 rounded-xl text-sm transition shadow-sm flex items-center justify-center gap-1.5"
            >
              <span>📥</span> Unduh Excel/CSV
            </button>
          </div>
        </div>
      </div>

      {/* Ringkasan Bulan Terpilih */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-emerald-700 uppercase">Total Pemasukan Bulan Ini</span>
          <p className="text-2xl font-bold text-emerald-800 mt-1">
            + Rp {summary.total_income.toLocaleString('id-ID')}
          </p>
        </div>
        <div className="bg-rose-50 border border-rose-100 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-rose-700 uppercase">Total Pengeluaran Bulan Ini</span>
          <p className="text-2xl font-bold text-rose-800 mt-1">
            - Rp {summary.total_expense.toLocaleString('id-ID')}
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-100 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-blue-700 uppercase">Selisih Kas (Net)</span>
          <p className={`text-2xl font-bold mt-1 ${summary.net >= 0 ? 'text-blue-800' : 'text-rose-800'}`}>
            Rp {summary.net.toLocaleString('id-ID')}
          </p>
        </div>
      </div>

      {/* Tabel Transaksi */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">
          Detail Transaksi ({transactions.length})
        </h2>

        {loading ? (
          <p className="text-gray-500 text-center py-12">Memuat data transaksi...</p>
        ) : transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-semibold uppercase text-gray-400">
                  <th className="pb-3">Tanggal</th>
                  <th className="pb-3">Anggota</th>
                  <th className="pb-3">Dompet</th>
                  <th className="pb-3">Kategori</th>
                  <th className="pb-3">Keterangan</th>
                  <th className="pb-3 text-right">Nominal</th>
                  <th className="pb-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-gray-50/75 transition">
                    <td className="py-3.5 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(tx.date).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 text-sm font-medium text-gray-700">
                      {tx.anggota_name || 'Unknown'}
                    </td>
                    <td className="py-3.5 text-xs text-gray-500">
                      <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                        {tx.rekening_name || 'Dompet Utama'}
                      </span>
                    </td>
                    <td className="py-3.5 text-sm text-gray-800 font-semibold">{tx.category}</td>
                    <td className="py-3.5 text-sm text-gray-500">{tx.description || '-'}</td>
                    <td
                      className={`py-3.5 text-sm font-bold text-right whitespace-nowrap ${
                        tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'} Rp {tx.amount.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleEdit(tx)}
                          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(tx.id)}
                          disabled={deletingId === tx.id}
                          className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded disabled:opacity-50"
                          title="Hapus"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <span className="text-4xl">📂</span>
            <p className="text-gray-500 font-medium mt-2">Tidak ada transaksi pada bulan ini.</p>
            <p className="text-xs text-gray-400 mt-1">Coba ganti filter bulan atau tambah transaksi baru.</p>
          </div>
        )}
      </div>

      <TransaksiModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchLaporan}
        initialData={selectedTx}
        anggotaList={anggotaList}
        rekeningList={rekeningList}
      />
    </main>
  );
}
