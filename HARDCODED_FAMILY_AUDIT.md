# 🔍 AUDIT HARDCODED FAMILY ID (PHASE 2H)
**Proyek:** KeuanganKeluarga  
**Waktu Audit:** 15 September 2026  
**Status:** In Progress for Phase 4 (API Refactor) & Phase 7 (Frontend Refactor)

---

## 1. Daftar Kemunculan Hardcoded Family ID

| No | FILE | LINE | CURRENT BEHAVIOR | TARGET BEHAVIOR (PHASE 4 & 7) |
|---|---|:---:|---|---|
| 1 | `app/page.tsx` | 11 | `data = await getDashboardData(1)` | `const ctx = await getUserFamily(); data = await getDashboardData(ctx.keluarga.id)` |
| 2 | `app/laporan/page.tsx` | 22 | `fetch('/api/anggota?keluarga_id=1')` | `fetch('/api/anggota')` (API otomatis mengambil keluarga dari session `getUserFamily()`) |
| 3 | `app/laporan/page.tsx` | 27 | `fetch('/api/rekening?keluarga_id=1')` | `fetch('/api/rekening')` (API otomatis mengambil keluarga dari session `getUserFamily()`) |
| 4 | `app/laporan/page.tsx` | 36 | `url = '/api/keluarga/1/laporan?month=...'` | `url = '/api/laporan?month=...'` (Family ID didapat dari auth context server) |
| 5 | `app/laporan/page.tsx` | 58 | `url = '/api/keluarga/1/laporan/export?month=...'` | `url = '/api/laporan/export?month=...'` (Export data keluarga dari auth session) |
| 6 | `app/anggota/page.tsx` | 20 | `fetch('/api/anggota?keluarga_id=1')` | `fetch('/api/anggota')` (Context-aware user family) |
| 7 | `app/anggota/page.tsx` | 67 | `body: JSON.stringify({ keluarga_id: 1, ... })` | Hapus `keluarga_id` dari client payload; server menginjeksi `ctx.keluarga.id` |
| 8 | `app/rekening/page.tsx` | 20 | `fetch('/api/rekening?keluarga_id=1')` | `fetch('/api/rekening')` (Context-aware user family) |
| 9 | `app/rekening/page.tsx` | 67 | `body: JSON.stringify({ keluarga_id: 1, ... })` | Hapus `keluarga_id` dari client payload; server menginjeksi `ctx.keluarga.id` |
| 10 | `app/api/anggota/route.ts` | 9 | `const keluargaId = Number(searchParams.get('keluarga_id') || 1);` | Ambil keluarga via `getUserFamily()` atau return 401 jika unauthenticated |
| 11 | `app/api/anggota/route.ts` | 20 | `const { keluarga_id = 1, name, ... } = body;` | Ambil keluarga via `getUserFamily()` atau return 401/403 |
| 12 | `app/api/rekening/route.ts` | 9 | `const keluargaId = Number(searchParams.get('keluarga_id') || 1);` | Ambil keluarga via `getUserFamily()` atau return 401/403 |
| 13 | `app/api/rekening/route.ts` | 20 | `const { keluarga_id = 1, name, ... } = body;` | Ambil keluarga via `getUserFamily()` atau return 401/403 |
| 14 | `app/api/keluarga/[keluargaId]/anggota/route.ts` | 10 | `const { keluargaId } = await params;` | Verifikasi `Number(keluargaId) === ctx.keluarga.id`, jika beda return 403 Forbidden |
| 15 | `app/api/keluarga/[keluargaId]/laporan/route.ts` | 10 | `const { keluargaId } = await params;` | Verifikasi `Number(keluargaId) === ctx.keluarga.id`, jika beda return 403 Forbidden |
| 16 | `app/api/keluarga/[keluargaId]/laporan/export/route.ts` | 10 | `const { keluargaId } = await params;` | Verifikasi `Number(keluargaId) === ctx.keluarga.id`, jika beda return 403 Forbidden |

---

## 2. Rencana Tindak Lanjut
- **Phase 4 (API Refactor):** Menghapus seluruh parameter `keluarga_id` dari input client dan beralih 100% ke resolusi `getUserFamily()`.
- **Phase 7 (Frontend Refactor):** Menghubungkan seluruh komponen page dengan identitas user dan keluarga aktif hasil login.
