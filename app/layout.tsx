import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Navbar from './components/Navbar';
import AutoLogout from './components/AutoLogout';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Keuangan Keluarga - Catat Kas & Laporan Finansial',
  description: 'Aplikasi pencatatan keuangan keluarga terintegrasi Bot Telegram dan Supabase',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 text-gray-900 min-h-screen flex flex-col`}
      >
        <AutoLogout />
        <Navbar />
        <div className="flex-1">{children}</div>
        <footer className="bg-white border-t border-gray-200 py-6 text-center text-xs text-gray-500">
          <p>© {new Date().getFullYear()} Keuangan Keluarga. Terhubung aman ke Supabase & Telegram Bot.</p>
        </footer>
      </body>
    </html>
  );
}
