# 🏛️ AUDIT STATUS FASTAPI LEGACY (PHASE 4 STEP 11)
**Proyek:** KeuanganKeluarga  
**Waktu Audit:** 15 September 2026  

---

## 1. Status Dependensi Folder `api/`

| Legacy File / Endpoint | Status | Penggunaan Saat Ini | Pengganti Modern (Next.js App Router) | Rekomendasi Aksi |
|---|---|---|---|---|
| `api/index.py` (`POST /api/keluarga/`, `GET /api/keluarga/`) | **DEAD / DUPLICATE** | Tidak dipanggil oleh frontend/Vercel | Next.js Server Components & `getUserFamily()` | Arsipkan / Hapus saat migrasi final |
| `api/index.py` (`POST /api/anggota/`, `GET /api/keluarga/{id}/anggota`) | **DEAD / DUPLICATE** | Tidak dipanggil oleh frontend/Vercel | Next.js `app/api/anggota/route.ts` | Arsipkan / Hapus saat migrasi final |
| `api/index.py` (`POST /api/rekening/`, `GET /api/keluarga/{id}/rekening`) | **DEAD / DUPLICATE** | Tidak dipanggil oleh frontend/Vercel | Next.js `app/api/rekening/route.ts` | Arsipkan / Hapus saat migrasi final |
| `api/index.py` (`POST /api/transaksi/`, `GET /api/transaksi/`) | **DEAD / DUPLICATE** | Tidak dipanggil oleh frontend/Vercel | Next.js `app/api/transaksi/route.ts` | Arsipkan / Hapus saat migrasi final |
| `api/index.py` (`GET /api/keluarga/{id}/laporan`) | **DEAD / DUPLICATE** | Tidak dipanggil oleh frontend/Vercel | Next.js `app/api/keluarga/[keluargaId]/laporan` | Arsipkan / Hapus saat migrasi final |
| `api/bot.py` (Polling / Webhook Python) | **DEAD / DUPLICATE** | Tidak dijalankan di Vercel | Next.js `app/api/webhook/route.ts` + `app/lib/telegram.ts` | Arsipkan / Hapus saat migrasi final |
| `api/database.py` (SQLAlchemy Engine) | **DEAD** | Tidak digunakan oleh Next.js | Next.js `app/lib/db.ts` (PostgreSQL connection pool) | Arsipkan / Hapus saat migrasi final |
| `api/models.py` (SQLAlchemy ORM Models) | **REFERENCE ONLY** | Hanya referensi skema lama | Supabase PostgreSQL DDL (`supabase/migrations/`) | Pertahankan sementara sebagai arsip |
| `api/schemas.py` (Pydantic Models) | **REFERENCE ONLY** | Hanya referensi lama | Zod Schemas (`app/lib/validations.ts`) | Pertahankan sementara sebagai arsip |
| `api/seed.py` (Seeding Script) | **STANDALONE** | Script CLI lokal | Supabase Migrations & Test Fixtures | Pertahankan untuk dev lokal |

---

## 2. Kesimpulan Evaluasi
- **Vercel Deployment:** Vercel hanya mengeksekusi Next.js (`@vercel/next`). Seluruh fungsi API web dan Webhook bot Telegram telah 100% dialihkan ke TypeScript di Next.js App Router.
- **Tindakan Phase 4:** Tandai seluruh file di `api/` sebagai **LEGACY**. Jangan hapus sembarangan sebelum seluruh testing selesai untuk menjaga referensi historis.
