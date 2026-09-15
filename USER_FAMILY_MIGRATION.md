# 👥 DOKUMENTASI MIGRASI DATA & PEMETAAN USER (PHASE 2)
**Proyek:** KeuanganKeluarga  
**Waktu Penyusunan:** 15 September 2026  

---

## 1. Status Data Eksisting di Supabase

Berdasarkan inspeksi database live saat ini, terdapat record eksisting sebagai berikut:

### Tabel `keluarga`
- **ID 1:** `"Keluarga Utama"` (created_at: 2026-09-14)

### Tabel `anggota`
- **ID 1:** `name = "Masruri"`, `telegram_id = "884906190"`, `role = "admin"`, `user_id = NULL`
- **ID 2:** `name = "Muh Masruri - 08562896918"`, `telegram_id = "45528063"`, `role = "member"`, `user_id = NULL`
- **ID 3:** `name = "Rianita - 085600003918"`, `telegram_id = "6429122452"`, `role = "member"`, `user_id = NULL`

### Tabel `rekening`
- **ID 1:** `"Dompet Utama"`, `keluarga_id = 1`, `type = "cash"`

### Tabel `transaksi`
- **ID 5:** `amount = 15000`, `anggota_id = 1`, `category = "Makan"`, `desc = "Mie Ayam"`
- **ID 7:** `amount = 70000`, `anggota_id = 2`, `category = "Makan"`, `desc = "Mbakmi Media ansor omah kleben"`
- **ID 8:** `amount = 34000`, `anggota_id = 2`, `category = "Indomaret"`, `desc = "Roti"`

---

## 2. Strategi Pemetaan Tanpa Asumsi (No Guessing / No Blind Assignment)

Sesuai aturan keamanan:
1. **Tidak ada data yang dihapus.**
2. **Tidak ada user_id yang di-assign secara otomatis/tebak-tebakan.**
3. Saat Owner (misal: Masruri) mendaftar/login via Supabase Auth dengan email resminya di `/login` atau `/register`, sistem menyediakan mekanisme linking akun:
   - Jika admin mendaftar dengan emailnya, ia dapat menautkan akun auth-nya ke profil anggota eksisting (ID 1) atau membuat profil keluarga baru.
   - Anggota lain (ID 2 & ID 3) dapat didaftarkan emailnya dan ditautkan ke `user_id` masing-masing saat mereka membuat login Supabase Auth.

---

## 3. SQL Query untuk Menautkan Manual oleh Owner (Opsional)

Jika Owner sudah mengetahui UUID `auth.users` miliknya setelah mendaftar di `/register`, Owner dapat menjalankan query berikut via SQL Editor Supabase:

```sql
-- Tautkan profil admin utama ke akun Supabase Auth
UPDATE public.anggota 
SET user_id = '<AUTH_USER_UUID_OWNER>'
WHERE id = 1;
```
