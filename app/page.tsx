import { getDashboardData } from './lib/queries';
import { getUserFamily } from './lib/auth';
import TransaksiList from './components/TransaksiList';
import { DashboardData } from './lib/types';
import { formatRupiah } from './lib/format';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function Home() {
  let data: DashboardData | null = null;
  let familyName: string = 'Keluarga';
  let error: string | null = null;

  try {
    const ctx = await getUserFamily();
    if (!ctx) {
      redirect('/login');
    }
    familyName = ctx.keluarga.name;
    data = await getDashboardData(ctx.keluarga.id);
  } catch (err: unknown) {
    // Next.js redirect throws NEXT_REDIRECT which must not be caught as error
    if (err && typeof err === 'object' && 'digest' in err && typeof (err as { digest: string }).digest === 'string' && (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')) {
      throw err;
    }
    console.error('Dashboard error:', err);
    error = 'Tidak dapat memuat data dasbor saat ini.';
  }

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Dashboard */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Dasbor {familyName}
            </h1>
            <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2.5 py-0.5 rounded-full">
              Keluarga Terverifikasi
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Pantau arus kas, saldo dompet, dan catatan pengeluaran keluarga secara real-time.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/laporan"
            className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium px-4 py-2 rounded-xl text-sm transition shadow-sm"
          >
            📑 Laporan Bulanan
          </Link>
          <Link
            href="/rekening"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-xl text-sm transition shadow-sm"
          >
            💳 Kelola Dompet
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl mb-8 flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-semibold text-sm">Gagal Mengambil Data Database</p>
            <p className="text-xs text-rose-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Ringkasan Saldo, Pemasukan, Pengeluaran */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Total Saldo Kas
              </span>
              <span className="p-2 bg-blue-50 text-blue-600 rounded-xl text-sm">💰</span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-3">
              {formatRupiah(data?.total_balance || 0)}
            </p>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Akumulasi dari {data?.rekening_list?.length || 0} dompet keluarga
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Total Pemasukan
              </span>
              <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl text-sm">📈</span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 mt-3">
              + {formatRupiah(data?.total_income || 0)}
            </p>
          </div>
          <p className="text-xs text-gray-400 mt-3">Semua catatan kas masuk aktif</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Total Pengeluaran
              </span>
              <span className="p-2 bg-rose-50 text-rose-600 rounded-xl text-sm">📉</span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-rose-600 mt-3">
              - {formatRupiah(data?.total_expense || 0)}
            </p>
          </div>
          <p className="text-xs text-gray-400 mt-3">Semua catatan kas keluar aktif</p>
        </div>
      </div>

      {/* Rincian Dompet / Rekening */}
      {data?.rekening_list && data.rekening_list.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-bold text-gray-800">💳 Rincian Dompet & Rekening</h2>
            <Link href="/rekening" className="text-xs text-blue-600 font-semibold hover:underline">
              + Tambah Dompet
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {data.rekening_list.map((r) => (
              <div key={r.id} className="p-4 bg-gray-50/75 rounded-xl border border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 uppercase">{r.type}</span>
                  <span className="text-xs text-gray-400">ID #{r.id}</span>
                </div>
                <h3 className="font-bold text-gray-800 mt-1">{r.name}</h3>
                <p className="text-base font-semibold text-blue-600 mt-1">
                  {formatRupiah(r.balance)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabel Transaksi dengan Aksi CRUD & Audit */}
      <TransaksiList
        initialTransactions={data?.recent_transactions || []}
        anggotaList={data?.anggota_list || []}
        rekeningList={data?.rekening_list || []}
      />

      {/* Panduan Cepat Bot Telegram */}
      <div className="mt-8 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl p-6 shadow-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🤖</span>
              <h3 className="font-bold text-lg">Catat Cepat via Bot Telegram</h3>
            </div>
            <p className="text-blue-100 text-sm mt-1 max-w-xl">
              Cukup kirim pesan singkat ke bot Telegram Anda:
              <br />
              <code className="bg-blue-800/60 px-2 py-0.5 rounded text-xs text-yellow-300 font-mono">
                /catat 50k Makan Siang
              </code>{' '}
              atau{' '}
              <code className="bg-blue-800/60 px-2 py-0.5 rounded text-xs text-emerald-300 font-mono">
                /masuk 5000000 Gaji Bulanan
              </code>
            </p>
          </div>
          <Link
            href="/anggota"
            className="bg-white text-blue-700 font-bold px-4 py-2.5 rounded-xl text-xs hover:bg-blue-50 transition shadow whitespace-nowrap"
          >
            Tautkan Akun Telegram Anggota →
          </Link>
        </div>
      </div>
    </main>
  );
}
