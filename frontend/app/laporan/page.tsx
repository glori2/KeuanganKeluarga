'use client';

import { useState, useEffect } from 'react';

const API_URL = "http://localhost:8000";

export default function LaporanPage() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [anggotaId, setAnggotaId] = useState("");
  const [anggotaList, setAnggotaList] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/keluarga/1/anggota`)
      .then(res => res.json())
      .then(data => setAnggotaList(data))
      .catch(err => console.error("Failed to fetch anggota", err));
  }, []);

  const fetchLaporan = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/keluarga/1/laporan?month=${month}&year=${year}`;
      if (anggotaId) {
        url += `&anggota_id=${anggotaId}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setTransactions(data);
      }
    } catch (error) {
      console.error("Failed to fetch laporan", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLaporan();
  }, [month, year, anggotaId]);

  const handleDownload = () => {
    let url = `${API_URL}/keluarga/1/laporan/export?month=${month}&year=${year}`;
    if (anggotaId) {
      url += `&anggota_id=${anggotaId}`;
    }
    window.location.href = url;
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Laporan Bulanan</h1>
          <a href="/" className="text-blue-600 hover:underline">Kembali ke Dashboard</a>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Bulan</label>
            <select 
              value={month} 
              onChange={(e) => setMonth(Number(e.target.value))}
              className="border-gray-300 rounded-lg p-2 border"
            >
              {[...Array(12)].map((_, i) => (
                <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('id-ID', { month: 'long' })}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tahun</label>
            <input 
              type="number" 
              value={year} 
              onChange={(e) => setYear(Number(e.target.value))}
              className="border-gray-300 rounded-lg p-2 border w-24"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Anggota</label>
            <select 
              value={anggotaId} 
              onChange={(e) => setAnggotaId(e.target.value)}
              className="border-gray-300 rounded-lg p-2 border"
            >
              <option value="">Semua Anggota</option>
              {anggotaList.map((a: any) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <button 
            onClick={handleDownload}
            className="ml-auto bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
          >
            Unduh Excel/CSV
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Detail Transaksi</h2>
          
          {loading ? (
            <p className="text-gray-500 text-center py-8">Memuat data...</p>
          ) : transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b">
                    <th className="pb-3 text-sm font-semibold text-gray-600">Tanggal</th>
                    <th className="pb-3 text-sm font-semibold text-gray-600">Anggota</th>
                    <th className="pb-3 text-sm font-semibold text-gray-600">Kategori</th>
                    <th className="pb-3 text-sm font-semibold text-gray-600">Keterangan</th>
                    <th className="pb-3 text-sm font-semibold text-gray-600 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx: any) => (
                    <tr key={tx.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3 text-sm text-gray-600">{new Date(tx.date).toLocaleDateString('id-ID')}</td>
                      <td className="py-3 text-sm text-gray-600">{tx.anggota_name || 'Unknown'}</td>
                      <td className="py-3 text-sm text-gray-800 font-medium">{tx.category}</td>
                      <td className="py-3 text-sm text-gray-500">{tx.description || '-'}</td>
                      <td className={`py-3 text-sm font-semibold text-right ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.type === 'income' ? '+' : '-'} Rp {tx.amount.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">Tidak ada transaksi di bulan ini.</p>
          )}
        </div>
      </div>
    </main>
  );
}
