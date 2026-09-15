'use client';

import { useState, useEffect } from 'react';

interface AnggotaOption {
  id: number;
  name: string;
  user_id?: string | null;
}

interface InvitationItem {
  id: number;
  invitation_code: string;
  target_role: string;
  target_anggota_id: number | null;
  target_anggota_name?: string | null;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

interface InvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  anggotaList: AnggotaOption[];
}

export default function InvitationModal({ isOpen, onClose, anggotaList }: InvitationModalProps) {
  const [targetAnggotaId, setTargetAnggotaId] = useState<string>('');
  const [targetRole, setTargetRole] = useState<'member' | 'admin'>('member');
  const [loading, setLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Filter existing members without a registered user_id
  const unlinkedMembers = anggotaList.filter(a => !a.user_id);

  const fetchInvitations = async () => {
    setLoadingList(true);
    try {
      const res = await fetch('/api/keluarga/invitations');
      if (res.ok) {
        const data = await res.json();
        setInvitations(data);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setGeneratedCode(null);
      setError('');
      setCopied(false);
      setTargetAnggotaId('');
      fetchInvitations();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload: { target_role: string; target_anggota_id?: number } = {
        target_role: targetRole,
      };
      if (targetAnggotaId) {
        payload.target_anggota_id = parseInt(targetAnggotaId, 10);
      }

      const res = await fetch('/api/keluarga/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal membuat kode undangan.');
      }

      setGeneratedCode(data.invitation_code);
      fetchInvitations();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/75">
          <div className="flex items-center gap-2">
            <span className="text-xl">✉️</span>
            <h3 className="font-bold text-gray-900">Undang Anggota Keluarga</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
              {error}
            </div>
          )}

          {/* Generated Code Display */}
          {generatedCode ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center space-y-3">
              <span className="text-3xl">🎉</span>
              <h4 className="font-bold text-emerald-900 text-base">Kode Undangan Berhasil Dibuat!</h4>
              <p className="text-xs text-emerald-700">
                Berikan kode ini kepada anggota keluarga Anda untuk dimasukkan saat registrasi akun.
              </p>
              
              <div className="bg-white border-2 border-dashed border-emerald-300 rounded-xl p-3 flex items-center justify-center gap-3">
                <span className="font-mono text-xl font-bold tracking-wider text-emerald-800">
                  {generatedCode}
                </span>
                <button
                  onClick={() => copyToClipboard(generatedCode)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition"
                >
                  {copied ? '✓ Tersalin' : 'Salin Kode'}
                </button>
              </div>

              <div className="text-[11px] text-emerald-600 space-y-1 text-left bg-emerald-100/50 p-2.5 rounded-lg">
                <p>• Berlaku selama <strong>48 jam</strong>.</p>
                <p>• Hanya dapat digunakan <strong>1 kali</strong>.</p>
                <p>• Anggota dapat mendaftar di halaman Register dan memilih &quot;Punya Kode Undangan&quot;.</p>
              </div>

              <button
                onClick={() => setGeneratedCode(null)}
                className="text-xs text-emerald-800 font-semibold hover:underline pt-2"
              >
                + Buat Kode Undangan Baru
              </button>
            </div>
          ) : (
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">
                  Tautkan ke Anggota Tertentu (Opsional)
                </label>
                <select
                  value={targetAnggotaId}
                  onChange={(e) => setTargetAnggotaId(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Undangan Umum (Buat Anggota Baru Otomatis) --</option>
                  {unlinkedMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} (Tautkan akun ke slot ini)
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">
                  Pilih slot anggota jika Anda sebelumnya sudah menambahkan nama anggota di sistem tanpa akun login. Riwayat transaksi anggota ini akan tetap dipertahankan.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">
                  Peran Akun Baru (Role)
                </label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value as 'member' | 'admin')}
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500"
                >
                  <option value="member">👤 Member (Catat Transaksi & Dompet)</option>
                  <option value="admin">👑 Admin (Kelola Keluarga & Anggota)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {loading ? (
                  <>
                    <span className="inline-block animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></span>
                    <span>Membuat Kode Undangan...</span>
                  </>
                ) : (
                  <span>✨ Terbitkan Kode Undangan</span>
                )}
              </button>
            </form>
          )}

          {/* Daftar Undangan Sebelumnya */}
          <div className="pt-4 border-t border-gray-100">
            <h4 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-3">
              Riwayat Undangan ({invitations.length})
            </h4>

            {loadingList ? (
              <div className="text-center py-4 text-xs text-gray-400">Memuat daftar undangan...</div>
            ) : invitations.length === 0 ? (
              <div className="text-center py-4 text-xs text-gray-400 bg-gray-50 rounded-xl">
                Belum ada kode undangan yang dibuat.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {invitations.map((inv) => {
                  const isExpired = new Date(inv.expires_at) < new Date();
                  const isUsed = !!inv.used_at;

                  return (
                    <div
                      key={inv.id}
                      className="p-3 bg-gray-50 hover:bg-gray-100/80 rounded-xl border border-gray-200/70 flex items-center justify-between text-xs transition"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-gray-800 tracking-wider">
                            {inv.invitation_code}
                          </span>
                          {isUsed ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                              Sudah Digunakan
                            </span>
                          ) : isExpired ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-200 text-gray-600">
                              Kedaluwarsa
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">
                              Aktif
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {inv.target_anggota_name
                            ? `Tautkan ke: ${inv.target_anggota_name}`
                            : `Role: ${inv.target_role}`}
                          {' • '}
                          Kedaluwarsa: {new Date(inv.expires_at).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      {!isUsed && !isExpired && (
                        <button
                          onClick={() => copyToClipboard(inv.invitation_code)}
                          className="px-2.5 py-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-[11px] font-medium transition shadow-2xs"
                        >
                          Salin
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
