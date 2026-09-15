'use client';

import { useState, useEffect } from 'react';
import { Anggota, TelegramLinkCodeResponse } from '../lib/types';

interface TelegramLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetAnggota?: Anggota | null;
  anggotaList?: Anggota[];
}

export default function TelegramLinkModal({
  isOpen,
  onClose,
  targetAnggota,
  anggotaList = [],
}: TelegramLinkModalProps) {
  const [selectedAnggotaId, setSelectedAnggotaId] = useState<number | null>(
    targetAnggota?.id || (anggotaList.length > 0 ? anggotaList[0].id : null)
  );
  const [data, setData] = useState<TelegramLinkCodeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (targetAnggota) {
      setSelectedAnggotaId(targetAnggota.id);
    } else if (anggotaList.length > 0) {
      setSelectedAnggotaId(prev => prev ?? anggotaList[0].id);
    }
    setData(null);
    setError('');
    setCopied(false);
  }, [targetAnggota, anggotaList, isOpen]);

  if (!isOpen) return null;

  const currentMember = targetAnggota || anggotaList.find(a => a.id === selectedAnggotaId);

  const generateCode = async () => {
    if (!selectedAnggotaId) {
      setError('Pilih anggota keluarga terlebih dahulu');
      return;
    }

    setLoading(true);
    setError('');
    setCopied(false);
    try {
      const res = await fetch('/api/telegram/link-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anggota_id: selectedAnggotaId }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal menghasilkan kode link Telegram');
      }

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

          {/* Member Selection / Info */}
          <div className="mb-4 bg-blue-50/75 border border-blue-100 rounded-xl p-3">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-blue-800 mb-1">
              Anggota Target
            </label>
            {targetAnggota ? (
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-blue-950">{targetAnggota.name}</span>
                <span className="text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full font-medium">
                  ID #{targetAnggota.id} • {targetAnggota.role}
                </span>
              </div>
            ) : (
              <select
                value={selectedAnggotaId || ''}
                onChange={e => {
                  setSelectedAnggotaId(Number(e.target.value));
                  setData(null);
                }}
                className="w-full mt-1 bg-white border border-blue-200 rounded-lg p-2 text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-blue-500"
              >
                {anggotaList.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} (ID #{a.id} - {a.role})
                  </option>
                ))}
              </select>
            )}
          </div>

          <p className="text-xs text-gray-600 mb-4">
            Gunakan kode OTP sekali pakai untuk menghubungkan akun Telegram <strong>{currentMember?.name || 'anggota'}</strong> secara aman ke kas keluarga.
          </p>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs mb-4">
              {error}
            </div>
          )}

          {!data ? (
            <div className="text-center py-4">
              <button
                onClick={generateCode}
                disabled={loading || !selectedAnggotaId}
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
                    <span>Buat Kode OTP untuk {currentMember?.name || 'Anggota'}</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 border-2 border-dashed border-blue-300 rounded-2xl p-5 text-center">
                <p className="text-xs uppercase font-bold text-blue-700 tracking-wider">
                  Kode OTP untuk {currentMember?.name}
                </p>
                <p className="text-3xl font-mono font-extrabold text-blue-950 tracking-widest my-2">
                  {data.code}
                </p>
                <p className="text-xs text-blue-600">
                  ⏳ Berlaku selama <strong>10 menit</strong>
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-xs text-gray-700 space-y-1.5">
                <p className="font-bold text-gray-900">Petunjuk Penggunaan di Telegram:</p>
                <ol className="list-decimal list-inside space-y-1 text-gray-600">
                  <li>Buka bot Telegram dari HP / akun anggota <strong>{currentMember?.name}</strong>.</li>
                  <li>Kirim perintah: <code className="bg-gray-200 px-1 py-0.5 rounded font-mono font-bold text-gray-900">/link {data.code}</code></li>
                  <li>Akun Telegram tersebut akan langsung terhubung ke profil <strong>{currentMember?.name}</strong>!</li>
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
