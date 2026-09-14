import { fetchDashboardData } from './lib/api';

export const dynamic = 'force-dynamic';

export default async function Home() {
  let data = null;
  let error = null;

  try {
    // Assuming keluarga_id = 1 for demo purposes
    data = await fetchDashboardData(1);
  } catch (err: any) {
    error = err.message || "Could not connect to backend.";
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Dashboard Keuangan Keluarga</h1>
          <a href="/laporan" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">Lihat Laporan Bulanan</a>
        </div>

        {error && (
          <div className="bg-red-100 text-red-800 p-4 rounded-lg mb-8">
            <p className="font-semibold">Warning: Cannot fetch data</p>
            <p className="text-sm">{error}. Ensure the FastAPI backend is running on port 8000.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-gray-500 text-sm font-medium mb-2">Total Saldo</h2>
            <p className="text-3xl font-bold text-blue-600">
              Rp {data?.total_balance?.toLocaleString() || '0'}
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-gray-500 text-sm font-medium mb-2">Pemasukan Bulan Ini</h2>
            <p className="text-3xl font-bold text-green-600">
              Rp {data?.total_income?.toLocaleString() || '0'}
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-gray-500 text-sm font-medium mb-2">Pengeluaran Bulan Ini</h2>
            <p className="text-3xl font-bold text-red-600">
              Rp {data?.total_expense?.toLocaleString() || '0'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Transaksi Terbaru</h2>
          
          {data?.recent_transactions && data.recent_transactions.length > 0 ? (
            <div className="space-y-4">
              {data.recent_transactions.map((tx: any) => (
                <div key={tx.id} className="flex justify-between items-center p-4 hover:bg-gray-50 rounded-lg transition-colors border border-gray-50">
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-800">{tx.category}</span>
                    <span className="text-sm text-gray-500">{tx.description || '-'}</span>
                    <span className="text-xs text-blue-500 mt-1">Oleh: {tx.anggota_name || 'Unknown'}</span>
                  </div>
                  <div className="text-right">
                    <span className={`font-semibold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'income' ? '+' : '-'} Rp {tx.amount.toLocaleString()}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(tx.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">Belum ada transaksi.</p>
          )}
        </div>
      </div>
    </main>
  );
}
