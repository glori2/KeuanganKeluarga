'use client';

import { useState } from 'react';
import { TelegramLinkCodeResponse } from '../lib/types';

interface TelegramLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TelegramLinkModal({ isOpen, onClose }: TelegramLinkModalProps) {
  const [data, setData] = useState<TelegramLinkCodeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const generateCode = async () => {
    setLoading(true);
    setError('');
    setCopied(false);
    try {
      const res = await fetch('/api/telegram/link-code', {
        method: 'POST',
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Gagal menghasilkan kode link Telegram');
      }
      const json = await res.json();
      setData(json);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (data?.code) {
      navigator.clipboard.writeText(`/link ${data.code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100">
        <div className="p-6">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🤖</span>
              <h3 className="text-base font-bold text-gray-900">Tautkan Bot Telegram</h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-lg text-lg leading-none"
            >
              ✕
            </button>
          </div>

          <p className="text-xs text-gray-600 mb-4">
            Gunakan kode OTP sekali pakai untuk menghubungkan akun Telegram anggota keluarga ke kas keluarga secara aman.
          </p>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs mb-4">
              {error}
            </div>
          )}

          {!data ? (
            <div className="text-center py-6">
              <button
                onClick={generateCode}
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                    <span>Membuat Kode OTP...</span>
                  </>
                ) : (
                  <>
                    <span>🔑</span>
                    <span>Buat Kode Tautan Telegram (OTP)</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 border-2 border-dashed border-blue-300 rounded-2xl p-5 text-center">
                <p className="text-xs uppercase font-bold text-blue-700 tracking-wider">Kode OTP Anda</p>
                <p className="text-3xl font-mono font-extrabold text-blue-950 tracking-widest my-2">
                  {data.code}
                </p>
                <p className="text-xs text-blue-600">
                  ⏳ Berlaku selama <strong>{data.expires_in_minutes} menit</strong>
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-xs text-gray-700 space-y-1.5">
                <p className="font-bold text-gray-900">Petunjuk Penggunaan di Telegram:</p>
                <ol className="list-decimal list-inside space-y-1 text-gray-600">
                  <li>Buka bot Telegram Anda di HP.</li>
                  <li>Kirim perintah: <code className="bg-gray-200 px-1 py-0.5 rounded font-mono font-bold text-gray-900">/link {data.code}</code></li>
                  <li>Akun Telegram akan otomatis terhubung ke kas keluarga!</li>
                </ol>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={copyToClipboard}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-1.5"
                >
                  <span>{copied ? '✅ Tersalin!' : '📋 Salin Perintah /link'}</span>
                </button>
                <button
                  onClick={generateCode}
                  disabled={loading}
                  className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs transition"
                  title="Buat kode baru"
                >
                  🔄
                </button>
              </div>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl text-xs transition"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
