'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: '📊 Dasbor', href: '/' },
    { label: '📑 Laporan', href: '/laporan' },
    { label: '👥 Anggota', href: '/anggota' },
    { label: '💳 Rekening', href: '/rekening' },
  ];

  const handleLogout = async () => {
    const { createClient } = await import('../lib/supabase/client');
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏡</span>
            <div>
              <Link href="/" className="text-lg font-bold text-gray-900 hover:text-blue-600 transition">
                Keuangan Keluarga
              </Link>
              <span className="hidden sm:inline-block ml-2 text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                Online
              </span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1 sm:space-x-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition ${
                    isActive
                      ? 'bg-blue-50 text-blue-600 font-semibold'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={handleLogout}
              className="px-3 py-2 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 transition"
              title="Keluar dari akun"
              aria-label="Keluar dari akun"
            >
              🚪 Keluar
            </button>
          </nav>

          {/* Mobile Hamburger Button */}
          <div className="flex md:hidden items-center">
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="p-2 rounded-xl text-gray-600 hover:bg-gray-100 transition"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <nav className="md:hidden py-3 border-t border-gray-100 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-xl text-sm font-medium transition ${
                    isActive
                      ? 'bg-blue-50 text-blue-600 font-semibold'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 transition"
            >
              🚪 Keluar dari Akun
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}
