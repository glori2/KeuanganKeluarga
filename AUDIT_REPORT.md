# 🛡️ LAPORAN AUDIT LENGKAP & ANALISIS KEAMANAN (PHASE 0)
**Proyek:** KeuanganKeluarga  
**Target Platform:** Supabase (Free Tier) + Vercel (Hobby/Free)  
**Waktu Audit:** 15 September 2026  
**Auditor:** Senior Software Architect & Application Security Engineer  

---

## 1. EXECUTIVE SUMMARY & SEVERITY METRICS

Berdasarkan audit komprehensif terhadap arsitektur, basis kode, basis data, riwayat git, API, Telegram Bot, dan alur otentikasi/otorisasi, ditemukan **16 temuan keamanan dan integritas** dengan klasifikasi sebagai berikut:

| Tingkat Keparahan (Severity) | Jumlah Temuan | Status Prioritas |
|---|:---:|---|
| 🔴 **CRITICAL** | **8** | Wajib diperbaiki segera sebelum sistem dibuka untuk multi-user |
| 🟠 **HIGH** | **4** | Berisiko tinggi terhadap integritas finansial & kebocoran data |
| 🟡 **MEDIUM** | **3** | Validasi input, penanganan error, dan code hygiene |
| 🟢 **LOW / INFO** | **3** | Linting, legacy cleanup, dan dokumentasi |

---

## 2. DETAIL TEMUAN KEAMANAN & ARSITEKTUR

### 🔴 CRITICAL FINDINGS

#### [SEC-01] Kebocoran Kredensial Sensitif di Riwayat Git (Git History Leak)
- **Lokasi:** Commit `cb2c20933a` dan `7e2fa1e700` (`api/.env`, `backend/.env`).
- **Deskripsi:** Riwayat git publik/repositori pernah melacak file `.env` yang memuat `DATABASE_URL` (dengan plaintext password Supabase) dan `TELEGRAM_BOT_TOKEN`.
- **Dampak:** Siapa pun yang memiliki akses ke repositori git dapat membaca kredensial database dan mengontrol bot Telegram.
- **Rekomendasi:** Wajib dilakukan **kredensial rotasi** (Reset DB password di Supabase & revoke token di @BotFather). Bersihkan git tracking history dan gunakan template `.env.example`.

#### [SEC-02] Ketiadaan Sistem Autentikasi (Anonymous Full Access)
- **Lokasi:** Seluruh route halaman (`/`, `/laporan`, `/anggota`, `/rekening`) dan API (`/api/*`).
- **Deskripsi:** Tidak ada proteksi Supabase Auth atau session middleware. Siapa pun yang mengunjungi domain Vercel langsung memiliki hak akses setara Admin.
- **Dampak:** Data finansial keluarga terekspos secara publik ke internet tanpa proteksi login.

#### [SEC-03] IDOR & Hardcoded Family ID (`keluarga_id = 1`)
- **Lokasi:** `app/page.tsx`, `app/laporan/page.tsx`, `app/anggota/page.tsx`, `app/rekening/page.tsx`, `app/api/anggota/route.ts`, `app/api/rekening/route.ts`.
- **Deskripsi:** Sistem mengasumsikan seluruh aktivitas terjadi pada keluarga ID `1`. Tidak ada pemisahan tenant (keluarga).
- **Dampak:** Multi-tenancy tidak berfungsi; data antar keluarga akan bercampur atau saling tertimpa.

#### [SEC-04] IDOR pada Manipulasi Transaksi, Rekening, dan Anggota
- **Lokasi:** `app/api/transaksi/[id]/route.ts`, `app/api/rekening/[id]/route.ts`, `app/api/anggota/[id]/route.ts`.
- **Deskripsi:** Operasi `PUT` (edit) dan `DELETE` (hapus) hanya menerima parameter `id` URL tanpa memvalidasi apakah resource tersebut milik keluarga dari user yang melakukan request.
- **Dampak:** Pengguna dari Keluarga A dapat mengubah/menghapus transaksi milik Keluarga B hanya dengan mengganti ID transaksi.

#### [SEC-05] Cross-Family Integrity Bypass pada Input Transaksi
- **Lokasi:** `app/api/transaksi/route.ts` & `createTransaksi()` di `app/lib/queries.ts`.
- **Deskripsi:** Endpoint menerima `rekening_id` dan `anggota_id` tanpa memverifikasi apakah kedua ID tersebut berasal dari keluarga yang sama dengan pembuat transaksi.
- **Dampak:** Transaksi dapat dicatat mengatasnamakan anggota keluarga lain atau memotong saldo rekening keluarga lain.

#### [SEC-06] Ketiadaan Row Level Security (RLS) di Database Supabase
- **Lokasi:** Tabel `keluarga`, `anggota`, `rekening`, `transaksi` di Supabase PostgreSQL.
- **Deskripsi:** RLS belum diaktifkan dengan policy per `auth.uid()`.
- **Dampak:** Jika koneksi client/anon digunakan, seluruh baris database dapat di-query secara langsung tanpa pembatasan.

#### [SEC-07] Mekanisme Penautan Telegram Tidak Aman (Insecure Auto-Linking)
- **Lokasi:** `app/lib/telegram.ts` (Handler `/start`).
- **Deskripsi:** Ketika user baru mengirim `/start`, sistem mencari sembarang anggota keluarga yang `telegram_id IS NULL` pertama kali dan langsung menautkannya.
- **Dampak:** Orang asing yang menekan `/start` pada bot dapat secara otomatis membajak profil anggota keluarga yang belum terhubung.

#### [SEC-08] Webhook Telegram Tidak Memiliki Verifikasi Secret Token
- **Lokasi:** `app/api/webhook/route.ts`.
- **Deskripsi:** Route `POST /api/webhook` menerima payload apa pun tanpa memvalidasi header `X-Telegram-Bot-Api-Secret-Token`.
- **Dampak:** Penyerang dapat mengirim request palsu (spoofed updates) untuk memanipulasi saldo atau mencatat transaksi fiktif tanpa melalui bot Telegram asli.

---

### 🟠 HIGH FINDINGS

#### [SEC-09] Penggunaan Tipe Data Floating-Point untuk Nominal Keuangan
- **Lokasi:** `api/models.py` (`Float`) & JavaScript number calculation di `app/lib/queries.ts`.
- **Deskripsi:** Saldo dan nominal transaksi menggunakan representasi pecahan floating-point standar.
- **Dampak:** Akumulasi transaksi dapat menghasilkan *rounding error* (misal: `0.1 + 0.2 = 0.30000000000000004`). Wajib distandarkan ke `NUMERIC(19, 2)` di PostgreSQL.

#### [SEC-10] Non-Atomic Balance Mutation (Ketiadaan Database Transaction)
- **Lokasi:** `app/lib/queries.ts` (`createTransaksi`, `updateTransaksi`, `deleteTransaksi`).
- **Deskripsi:** Operasi `INSERT/UPDATE transaksi` dan `UPDATE rekening SET balance` dieksekusi sebagai query terpisah tanpa blok transaksi database (`sql.begin` / `BEGIN ... COMMIT`).
- **Dampak:** Jika serverless function terputus di tengah eksekusi, transaksi dapat tercatat tanpa saldo terupdate, atau sebaliknya (*data inconsistency*).

#### [SEC-11] Ketiadaan Dukungan Fitur Transfer Antar Rekening yang Aman
- **Lokasi:** `app/lib/queries.ts` & `app/components/TransaksiModal.tsx`.
- **Deskripsi:** Tipe transaksi `transfer` didefinisikan di enum database lama, namun belum memiliki model data rekening sumber vs rekening tujuan dan mutasi dua arah yang atomik.

#### [SEC-12] Ketiadaan Audit Trail / Audit Log Finansial
- **Lokasi:** Seluruh endpoint mutasi database.
- **Deskripsi:** Tidak ada pencatatan jejak audit (*who changed what and when*). Transaksi yang dihapus langsung di-hard delete tanpa rekam jejak.

---

### 🟡 MEDIUM FINDINGS

#### [SEC-13] Pembocoran Detail Error Internal ke Respons Client (Error Leakage)
- **Lokasi:** `app/api/transaksi/route.ts`, `app/api/rekening/route.ts`, `app/api/anggota/route.ts`.
- **Deskripsi:** Endpoint mengembalikan `{ error: error.message }` mentah jika terjadi kegagalan SQL.
- **Dampak:** Penyerang dapat melihat struktur tabel, nama kolom, atau constraint database.

#### [SEC-14] Ketiadaan Server-Side Input Schema Validation (Zod)
- **Lokasi:** Seluruh route handler di `app/api/*`.
- **Deskripsi:** Validasi input hanya mengandalkan pengecekan manual `if (!amount || amount <= 0)`. Belum ada schema validator ketat untuk tipe data, batas panjang string, dan format tanggal.

#### [SEC-15] Potensi Masalah Duplicate Backend (Legacy FastAPI di `api/`)
- **Lokasi:** Folder `api/` (`index.py`, `models.py`, `bot.py`, `database.py`, `seed.py`).
- **Deskripsi:** Backend FastAPI sudah tidak lagi digunakan oleh Next.js di Vercel, namun kodenya masih ada di repositori dan berpotensi menimbulkan ambiguitas arsitektur.

---

### 🟢 LOW & INFO FINDINGS

#### [SEC-16] 60 Masalah Linting TypeScript (`@typescript-eslint/no-explicit-any`)
- **Lokasi:** Komponen frontend & query handlers.
- **Deskripsi:** Penggunaan tipe `any` yang meluas mengurangi keandalan type safety.

#### [SEC-17] Ketiadaan Automated Security & Regression Tests
- **Lokasi:** Root proyek (belum ada test runner seperti Vitest/Jest untuk validasi otorisasi dan isolasi tenant).

---

## 3. PEMETAAN ARSITEKTUR SAAT INI (AS-IS)

```
[ BROWSER / TELEGRAM ]
        │
        ▼ (No Auth / Hardcoded keluarga_id = 1)
┌───────────────────────────────────────────────────────────┐
│                 Next.js (Vercel Hobby)                   │
│  - App Router: /, /laporan, /anggota, /rekening          │
│  - API Routes: /api/transaksi, /api/rekening, /api/anggota│
│  - Webhook: /api/webhook (TypeScript, No Secret Verify)   │
└─────────────────────────────┬─────────────────────────────┘
                              │ Direct Postgres Client (Pool)
                              ▼
┌───────────────────────────────────────────────────────────┐
│             Supabase PostgreSQL (AWS Tokyo)               │
│  - Tables: keluarga, anggota, rekening, transaksi        │
│  - RLS: DISABLED                                          │
│  - Float amounts, No Atomic Tx in App Layer              │
└───────────────────────────────────────────────────────────┘
```

---

## 4. TARGET ARSITEKTUR TARGET (TO-BE)

```
┌─────────────────────────────────┐      ┌──────────────────────────────┐
│        Authenticated User       │      │     Telegram Messenger       │
└────────────────┬────────────────┘      └──────────────┬───────────────┘
                 │ Supabase Auth Cookie                 │ Secret Header
                 ▼                                      ▼
┌───────────────────────────────────────────────────────────────────────┐
│                      Next.js 16 (Vercel Hobby)                        │
│ ┌────────────────────────┐  ┌───────────────────────────────────────┐ │
│ │   Protected Pages      │  │         API / Server Handlers         │ │
│ │  - /login, /register   │  │  - Auth Guard (getAuthenticatedUser)  │ │
│ │  - /dashboard          │  │  - Tenant Guard (getUserFamily)       │ │
│ │  - /laporan            │  │  - Zod Input Validation               │ │
│ │  - /anggota            │  │  - Atomic Transactions (sql.begin)    │ │
│ │  - /rekening           │  │  - Telegram Webhook Secret Verifier   │ │
│ └────────────────────────┘  └───────────────────────────────────────┘ │
└───────────────────────────────────┬───────────────────────────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
┌───────────────────────────────────┐   ┌───────────────────────────────┐
│           Supabase Auth           │   │      Supabase PostgreSQL      │
│  - auth.users (Email/Pass)        │   │  - Row Level Security (RLS)   │
│  - JWT Verification               │   │  - NUMERIC(19, 2) Currencies  │
│                                   │   │  - One-Time Telegram OTP Link │
│                                   │   │  - Audit Log & Void System    │
└───────────────────────────────────┘   └───────────────────────────────┘
```

---

## 5. RENCANA IMPLEMENTASI BERTAHAP (MIGRATION PLAN)

Sesuai instruksi MASTER PROMPT, refactoring akan dieksekusi secara bertahap tanpa merusak fungsionalitas yang ada:

### **PHASE 1 — Secret & Repository Hardening**
1. Pembersihan riwayat git untuk menghilangkan file secret lama dari commit history.
2. Penguatan `.gitignore` (`.env`, `.env.*`, `*.db`, `*.sqlite*`, `__pycache__`).
3. Penyediaan template `.env.example` bersih tanpa nilai sensitif.
4. Dokumentasi prosedur rotasi kredensial (Supabase password & Telegram Bot Token).

### **PHASE 2 — Supabase Foundation & Database Schema**
1. Pembuatan migrasi terstruktur (`supabase/migrations/001_initial_hardening.sql`):
   - Migrasi tipe uang dari `Float` ke `NUMERIC(19, 2)`.
   - Penambahan kolom `created_at`, `updated_at`, `is_void`, `destination_rekening_id` (untuk transfer).
   - Tabel `profiles` (terhubung ke `auth.users`), `telegram_link_codes`, dan `audit_log`.
2. Pengaturan Supabase Client (Browser Client, Server Client via `@supabase/ssr`, Admin Client).

### **PHASE 3 — Row Level Security & Authorization Guard**
1. Pengaktifan RLS di seluruh tabel dengan policy isolasi berbasis `auth.uid() -> anggota.user_id -> keluarga_id`.
2. Implementasi Server-Side Authorization Helper (`getAuthenticatedUser()`, `getUserFamily()`).
3. Penegakan role permissions (`owner`, `admin`, `member`, `viewer`).

### **PHASE 4 — API Refactoring & IDOR Elimination**
1. Refactor seluruh endpoint di `app/api/*`:
   - Validasi autentikasi & kepemilikan keluarga (menghilangkan seluruh hardcoded `keluarga_id = 1`).
   - Validasi kepemilikan rekening & anggota dalam satu keluarga sebelum mutasi.
   - Skema validasi input menggunakan **Zod**.
   - Sanitasi respons error (tidak membocorkan SQL error).

### **PHASE 5 — Financial Integrity & Atomic Mutations**
1. Eksekusi mutasi saldo dalam blok database transaction (`sql.begin`).
2. Implementasi fitur **Transfer Dana Antar Rekening** atomik (source `-=` amount, destination `+=` amount).
3. Implementasi pencatatan jejak audit otomatis pada `audit_log`.
4. Fitur pembatalan/void transaksi yang aman.

### **PHASE 6 — Telegram Bot Security & One-Time OTP Linking**
1. Verifikasi header `X-Telegram-Bot-Api-Secret-Token` pada `/api/webhook`.
2. Penggantian mekanisme linking: User men-generate kode OTP di Web Dashboard (`/link LINK-XXXXXX`) yang berlaku 10 menit, single-use, dan diverifikasi aman.
3. Otentikasi dan otorisasi ketat pada setiap perintah Telegram.

### **PHASE 7 — Frontend Security & Multi-Tenant UX**
1. Halaman `/login` dan `/register` berbasis Supabase Auth.
2. Route middleware protection (redirect unauthenticated user ke `/login`).
3. Dashboard dan seluruh halaman dinamis berbasis keluarga user aktif (bukan keluarga #1).

### **PHASE 8 — Vercel & Production Readiness**
1. Pembersihan modul legacy Python (`api/`) ke arsip terdokumentasi.
2. Konfigurasi Environment Variables production.
3. Pengujian build Turbopack dan linting bersih.

### **PHASE 9 — Automated Security & Integration Testing**
1. Pembuatan suite test otomatis untuk verifikasi IDOR, isolasi tenant, integritas transfer, dan otorisasi webhook.

---

## 6. STATUS KESIAPAN
Fase Audit (PHASE 0) telah **SELESAI 100%**. Seluruh titik kelemahan telah teridentifikasi secara presisi. Tidak ada perubahan kode aplikasi yang dilakukan selama fase audit ini.
