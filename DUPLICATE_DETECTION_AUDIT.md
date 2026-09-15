# 🔎 AUDIT FORENSIK: DUPLICATE ACCOUNT & FAMILY DETECTION
**Projek:** KeuanganKeluarga (`glori2/KeuanganKeluarga`)  
**Fokus Audit:** Deteksi Duplikasi Akun & Keluarga, Privasi Multi-Tenant, Mekanisme Undangan Aman  
**Tanggal:** 15 September 2026  
**Status:** Audit Selesai — Rencana Implementasi Siap  

---

## 1. Current Identity & Tenancy Model

Arsitektur multi-tenant `KeuanganKeluarga` saat ini tersusun atas hierarki berikut:

```
auth.users (Supabase Auth: UUID, email, password)
    │
    ├── 1:1 ── profiles (id = auth.uid(), full_name, role)
    │
    └── 1:N ── anggota (id, keluarga_id, user_id, name, role, telegram_id, telegram_chat_id)
                   │
                   └── N:1 ── keluarga (id, name, created_at, updated_at)
                                  │
                                  ├── 1:N ── rekening (id, keluarga_id, name, balance, type)
                                  └── 1:N ── transaksi (id, rekening_id, anggota_id, amount, ...)
```

### Karakteristik Entitas:
1. **`auth.users` (Supabase Managed):**
   - Source of truth identitas login.
   - Primary key: UUID.
   - `email`: UNIQUE constraint di database Supabase Auth.
   - Password terenkripsi bcrypt/argon2.
2. **`profiles`:**
   - Menyimpan profil nama tampilan user (`full_name`).
   - Dilindungi RLS: user hanya dapat membaca/menulis record miliknya sendiri (`auth.uid() = id`).
3. **`keluarga`:**
   - Mewakili entitas tenant keuangan (family unit).
   - Primary key: `id` (integer autoincrement).
   - Kolom `name`: String deskriptif (contoh: "Ainun Family"). **Tidak memiliki UNIQUE constraint** (dan secara aturan bisnis memang tidak boleh unik karena dua keluarga berbeda di dunia nyata bisa memiliki nama yang sama).
4. **`anggota`:**
   - Mewakili individu dalam keluarga yang memiliki hak akses pencatatan kas atau penautan Telegram.
   - `user_id`: UUID yang merujuk ke `auth.users(id)`. Boleh `NULL` untuk anggota keluarga yang belum memiliki login web (hanya dicatat oleh admin keluarga atau bertransaksi via Telegram).
   - Kolom `name`: String deskriptif (contoh: "Rianita"). **Tidak memiliki UNIQUE constraint**.
   - Kolom `telegram_id`: String numerik Telegram ID. Dilindungi logika anti-reassignment (1 Telegram ID hanya boleh terhubung ke 1 anggota).

---

## 2. Available Identifiers & Karakteristiknya

| Identifier | Lokasi Tabel | Tipe Data | Sifat Unik? | Kekuatan Sinyal Identitas |
| :--- | :--- | :--- | :--- | :--- |
| **Email** | `auth.users.email` | VARCHAR | Ya (DB-level) | **Level A (Sangat Kuat)** — Diverifikasi via Supabase Auth |
| **User ID** | `auth.users.id`, `anggota.user_id` | UUID | Ya (DB-level) | **Level A (Sangat Kuat)** — Identitas sesi terotentikasi |
| **Telegram ID** | `anggota.telegram_id` | VARCHAR(64) | Ya (Application-level) | **Level A (Sangat Kuat)** — Terverifikasi lewat webhook/OTP |
| **Telegram Chat ID** | `anggota.telegram_chat_id` | VARCHAR(64) | Ya (Application-level) | **Level A (Sangat Kuat)** — Terikat ke private chat |
| **Nomor Telepon** | N/A | N/A | Tidak ada | N/A (Saat ini tidak dikumpulkan dalam skema) |
| **Nama Keluarga** | `keluarga.name` | VARCHAR(255) | **TIDAK** | **Level B / C (Lemah - Sedang)** — Rawan kemiripan nama / typo |
| **Nama Anggota** | `anggota.name` | VARCHAR(100) | **TIDAK** | **Level B / C (Lemah - Sedang)** — Rawan kemiripan nama |

---

## 3. Analisis Alur Registrasi & Onboarding Saat Ini

Alur saat ini di [`app/register/page.tsx`](file:///d:/dokumen/Projek/Keuangan%20Keluarga/app/register/page.tsx) dan [`app/api/auth/onboard/route.ts`](file:///d:/dokumen/Projek/Keuangan%20Keluarga/app/api/auth/onboard/route.ts):

```
User mengisi Form Register (Nama, Nama Keluarga, Email, Password)
                 ↓
Supabase Auth: supabase.auth.signUp()
                 ↓
Trigger PostgreSQL: on_auth_user_created -> insert profiles
                 ↓
Client memanggil: POST /api/auth/onboard
                 ↓
Backend Onboard:
   1. INSERT INTO keluarga (name) VALUES (familyName)  <-- SELALU BUAT KELUARGA BARU!
   2. INSERT INTO rekening (name: 'Dompet Utama')
   3. INSERT INTO anggota (role: 'admin', user_id: auth.uid())
                 ↓
Redirect ke Dashboard (/)
```

### Masalah pada Alur Saat Ini:
1. **Tidak Ada Deteksi Duplikasi:** Siapapun dapat mendaftarkan keluarga baru dengan nama yang persis sama dengan keluarga yang sudah ada (misal "Ainun Family").
2. **Tidak Ada Mekanisme Bergabung (Join Family):** Ketika admin keluarga (misal Suami) menambahkan anggota (Istri: "Rianita") di menu Anggota, anggota tersebut dibuat dengan `user_id = NULL`. Jika "Rianita" kemudian mendaftar di halaman register, sistem **secara paksa membuatkan keluarga baru yang terpisah**, bukan menggabungkannya ke "Ainun Family"!
3. **Ketiadaan Kode Undangan (Invitation System):** Belum ada tabel atau endpoint untuk mengundang anggota keluarga agar bisa login dengan email/password masing-masing ke keluarga yang sama.

---

## 4. Audit RLS & Batasan Keamanan Data Leakage

### Analisis RLS Saat Ini:
- `keluarga`: SELECT dan UPDATE dibatasi oleh `id IN (SELECT get_auth_user_keluarga_ids())`.
- `anggota`: SELECT dibatasi oleh `keluarga_id IN (SELECT get_auth_user_keluarga_ids()) OR user_id = auth.uid()`.
- `rekening` & `transaksi`: Terisolasi penuh berdasarkan kepemilikan keluarga (`keluarga_id`).

### Risiko Privasi & Data Leakage dalam Duplicate Detection:
> [!CAUTION]
> **VULNERABILITY RISKS (Data Leakage & Account Enumeration):**
> 1. **User Enumeration / Family Scraping:** Jika dibuat endpoint pencarian seperti `GET /api/keluarga/check?name=Ainun` yang mengembalikan detail seperti ID keluarga, nama admin, atau daftar anggota, penyerang dapat melakukan brute-force / enumeration terhadap seluruh keluarga terdaftar di aplikasi.
> 2. **Auto-Join Hijacking:** Jika sistem otomatis menggabungkan akun hanya karena nama keluarga atau nama anggota mirip, penyerang dapat mendaftar dengan nama yang sama untuk membajak dan melihat saldo serta transaksi keluarga orang lain.
> 3. **Cross-Tenant IDOR:** Pengguna tidak boleh diizinkan mengirim `keluarga_id` sembarangan untuk bergabung tanpa bukti kriptografis berupa kode undangan (one-time invitation code).

### Prinsip Keamanan Detection API:
- Endpoint deteksi harus **server-side only** dan **authenticated** (atau terikat ke sesi pendaftaran aktif).
- Response **HANYA** mengembalikan indikator biner/kategorikal tanpa data sensitif:
  ```json
  {
    "possible_match": true,
    "confidence": "strong",
    "message": "Kami menemukan kemungkinan data yang mirip dengan keluarga yang sudah ada."
  }
  ```
  *(Dilarang mengembalikan ID keluarga, daftar anggota, nama admin, rekening, atau alamat email).*
- **JANGAN PERNAH** melakukan auto-join otomatis.
- Tetap berikan opsi jelas bagi pengguna:
  - `[Gunakan nama ini dan buat keluarga baru]`
  - `[Batal / Gunakan Kode Undangan]`

---

## 5. Rencana Arsitektur & Aturan Deteksi (Confidence Rules)

### Aturan Tingkat Keyakinan (Confidence Matrix):

| Tingkat | Kriteria Deteksi | Respon Sistem | Aksi User |
| :--- | :--- | :--- | :--- |
| **LEVEL A** (Exact Match) | • Email sudah terdaftar di Supabase Auth<br>• Telegram ID sudah terhubung ke anggota lain | **Tolak / Blokir:**<br>• Supabase Auth tolak registrasi ("Email already registered")<br>• Bot tolak penautan Telegram dan minta `/unlink` | User harus login dengan akun yang ada atau jalankan `/unlink` di Telegram. |
| **LEVEL B** (Strong Similarity) | • Nama keluarga yang diinput cocok dengan nama keluarga yang sudah ada (`LOWER(TRIM(name)) = LOWER(TRIM(input))` atau exact match tanpa case). | **Tampilkan Peringatan Informatif:**<br>"⚠️ Kemungkinan keluarga sudah ada. Jika Anda ingin bergabung, minta Admin keluarga mengundang Anda." | User dapat memilih:<br>1. Tetap buat keluarga baru (nama sah dipakai orang lain)<br>2. Batal & bergabung via kode undangan resmi |
| **LEVEL C** (Name-Only / Member Similarity) | • Admin keluarga menambahkan anggota dengan nama yang sudah ada di keluarga yang sama (misal: ada dua "Rianita" dalam 1 keluarga). | **Peringatan Internal Admin:**<br>"Anggota dengan nama serupa sudah ada dalam keluarga ini." | Admin dapat memilih:<br>1. Tetap buat anggota baru<br>2. Batal |

---

## 6. Desain Secure Invitation & Join Flow

Untuk menyelesaikan masalah pemisahan keluarga secara aman tanpa membocorkan data, diperlukan tabel `family_invitations`.

### Skema Tabel `family_invitations`:
```sql
CREATE TABLE IF NOT EXISTS public.family_invitations (
    id SERIAL PRIMARY KEY,
    keluarga_id INTEGER NOT NULL REFERENCES public.keluarga(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    target_role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (target_role IN ('admin', 'member')),
    target_anggota_id INTEGER REFERENCES public.anggota(id) ON DELETE SET NULL,
    invitation_code VARCHAR(16) NOT NULL UNIQUE,
    code_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    used_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

### Karakteristik & Keamanan Undangan:
1. **Cryptographically Secure:** Kode undangan dibuat menggunakan generator acak berkekuatan kriptografis (misal format `INV-XXXX-YYYY` dengan 8 karakter random alfanumerik bebas ambigu).
2. **One-Time Use (Sekali Pakai):** Dilindungi flag `used_at` dan row-locking `FOR UPDATE` saat klaim untuk mencegah race-condition / replay attack.
3. **Masa Berlaku Terbatas (Expiration):** Kedaluwarsa otomatis (misal 48 jam).
4. **Terikat Tenant:** Kode terikat secara paten ke `keluarga_id`. Admin Keluarga A tidak dapat mengundang user ke Keluarga B.
5. **Audit Trail:** Pembuatan dan penerimaan undangan dicatat ke `audit_log` sebagai bukti forensik.
6. **Slot Linking (Opsional):** Jika admin sudah membuat slot anggota bernama "Rianita" (tanpa user_id), undangan dapat ditargetkan untuk menautkan akun baru tersebut langsung ke slot `target_anggota_id` sehingga riwayat transaksi lama tidak hilang.

---

## 7. Berkas yang Terdampak (Files Affected)

1. **Database & Migrasi:**
   - `supabase/migrations/011_family_invitations.sql` *(Baru: tabel `family_invitations`, RLS, indeks)*
2. **Validasi & Skema:**
   - `app/lib/validations.ts` *(Menambahkan `CheckDuplicateFamilySchema`, `CreateInvitationSchema`, `AcceptInvitationSchema`)*
3. **API Endpoints:**
   - `app/api/auth/check-duplicate/route.ts` *(Baru: endpoint cek kemiripan keluarga sebelum onboard)*
   - `app/api/keluarga/invitations/route.ts` *(Baru: admin membuat dan melihat daftar undangan aktif)*
   - `app/api/keluarga/invitations/accept/route.ts` *(Baru: klaim kode undangan untuk bergabung ke keluarga)*
   - `app/api/auth/onboard/route.ts` *(Update: dukung parameter onboarding via kode undangan)*
   - `app/api/anggota/route.ts` *(Update: cek peringatan nama serupa dalam keluarga yang sama)*
4. **Frontend UI / UX:**
   - `app/register/page.tsx` *(Menambahkan deteksi duplikasi sebelum submit + modal warning + opsi masukkan kode undangan)*
   - `app/anggota/page.tsx` *(Menambahkan fitur "Undang Anggota via Kode" + deteksi duplikasi nama anggota di modal tambah)*
   - `app/components/InvitationModal.tsx` *(Baru: modal pembuatan kode undangan oleh admin)*
5. **Pengujian Otomatis:**
   - `tests/duplicate_detection_test.js` *(Baru: 17 skenario pengujian komprehensif)*

---

## 8. Migration Requirement & Zero-Downtime Strategy

- Migrasi `011_family_invitations.sql` murni berupa penambahan tabel baru dan indeks, tanpa mengubah tipe data kolom atau menghapus tabel yang sudah ada.
- Tidak mempengaruhi tabel inti finansial (`rekening`, `transaksi`, `audit_log`).
- Kompatibel 100% dengan Next.js 16 App Router dan database Supabase PostgreSQL saat ini.

---

## 9. Kesimpulan & Rekomendasi

1. **Prinsip Utama:** Deteksi duplikasi adalah alat bantu kesadaran pengguna (*awareness*), **bukan** eksekutor penggabungan otomatis.
2. **Tidak Ada Auto-Join:** Seluruh proses bergabung ke keluarga wajib diverifikasi lewat kode undangan (*invitation code*) sekali pakai yang diterbitkan secara sah oleh Admin keluarga pemilik tenant.
3. **Perlindungan Privasi Penuh:** Tidak ada data identitas keluarga lain yang dibocorkan kepada pihak yang belum terotentikasi dan terverifikasi.
