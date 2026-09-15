# 📋 INVENTARISASI & MATRIX AUDIT API (PHASE 4 STEP 1)
**Proyek:** KeuanganKeluarga  
**Waktu Audit:** 15 September 2026  

---

## 1. Matrix API Handlers (Next.js App Router)

| Endpoint | Method | Auth Required | Family Source | RLS Bound | Zod Validation | IDOR Risk | Client Identity Trusted | Status Target |
|---|:---:|:---:|---|:---:|:---:|:---:|:---:|---|
| `/api/transaksi` | `POST` | YES | `getUserFamily()` | YES | YES | Low | NO | Wajib Auth & Family Bound |
| `/api/transaksi/transfer` | `POST` | YES | `getUserFamily()` | YES | YES | Low | NO | Wajib Auth & Family Bound |
| `/api/transaksi/[id]` | `PUT` | YES | `getUserFamily()` | YES | YES | Low | NO | Wajib verify ownership transaksi milik keluarga |
| `/api/transaksi/[id]` | `DELETE` | YES | `getUserFamily()` | YES | YES | Low | NO | Wajib verify ownership transaksi milik keluarga |
| `/api/rekening` | `GET` | YES | `getUserFamily()` | YES | — | Low | NO | Wajib filter keluarga dari session (bukan query params) |
| `/api/rekening` | `POST` | YES | `getUserFamily()` | YES | YES | Low | NO | Injeksi `keluarga_id` dari session |
| `/api/rekening/[id]` | `PUT` | YES | `getUserFamily()` | YES | YES | Low | NO | Wajib verify ownership rekening milik keluarga |
| `/api/rekening/[id]` | `DELETE` | YES | `getUserFamily()` | YES | — | Low | NO | Wajib verify ownership rekening milik keluarga |
| `/api/anggota` | `GET` | YES | `getUserFamily()` | YES | — | Low | NO | Wajib filter keluarga dari session (bukan query params) |
| `/api/anggota` | `POST` | YES | `getUserFamily()` | YES | YES | Low | NO | Injeksi `keluarga_id` dari session |
| `/api/anggota/[id]` | `PUT` | YES | `getUserFamily()` | YES | YES | Low | NO | Wajib verify ownership anggota milik keluarga |
| `/api/anggota/[id]` | `DELETE` | YES | `getUserFamily()` | YES | — | Low | NO | Wajib verify ownership anggota milik keluarga |
| `/api/keluarga/[keluargaId]/laporan` | `GET` | YES | `getUserFamily()` | YES | — | Low | NO | Verify `keluargaId === ctx.keluarga.id` |
| `/api/keluarga/[keluargaId]/laporan/export` | `GET` | YES | `getUserFamily()` | YES | — | Low | NO | Verify `keluargaId === ctx.keluarga.id` |
| `/api/keluarga/[keluargaId]/anggota` | `GET` | YES | `getUserFamily()` | YES | — | Low | NO | Verify `keluargaId === ctx.keluarga.id` |
| `/api/auth/onboard` | `POST` | YES | `getAuthenticatedUser()` | YES | YES | Low | NO | Restricted to auth user UID |
| `/api/webhook` | `POST` | Webhook Secret | Bot User Link | YES | — | Low | NO | Handled via Telegram OTP / Secret |

---

## 2. Prinsip Otorisasi API yang Diterapkan
1. **Server-Side Identity:** `auth.uid()` didapat dari cookie session Supabase (`getAuthenticatedUser()`).
2. **Tenant Guard:** `getUserFamily()` memetakan `auth.uid() -> anggota -> keluarga`.
3. **No Client Trust:** Client tidak lagi diperbolehkan mengirimkan `keluarga_id` atau `user_id` untuk menentukan hak akses.
4. **Ownership Verification:** Operasi `PUT` / `DELETE` selalu menyertakan filter `WHERE id = [resourceId] AND keluarga_id = [userFamilyId]` atau verifikasi relasi keluarga sebelum mutasi dieksekusi.
