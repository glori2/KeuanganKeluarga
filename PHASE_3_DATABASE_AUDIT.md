# 📊 AUDIT SKEMA DATABASE & FINANCIAL DATA TYPE (PHASE 3 STEP 1)
**Proyek:** KeuanganKeluarga  
**Waktu Audit:** 15 September 2026  
**Target:** Supabase PostgreSQL  

---

## 1. Tabel Audit Kolom Finansial & Data Types

| Table | Column | Current Type | Financial Meaning | Target Type | Nullable | Risk & Mitigation |
|---|---|---|---|---|:---:|---|
| `rekening` | `balance` | `double precision` (`float8`) | Saldo akumulatif rekening | `NUMERIC(19, 2)` | `NOT NULL DEFAULT 0.00` | **High Risk:** Floating point arithmetic rounding issue. Wajib dimigrasikan ke Decimal 19,2 |
| `rekening` | `name` | `varchar` | Nama dompet/rekening | `VARCHAR(255)` | `NOT NULL` | **Medium Risk:** Nama rekening kosong menyebabkan error UI |
| `rekening` | `keluarga_id` | `integer` | Kepemilikan tenant keluarga | `INTEGER` | `NOT NULL` | **Critical Risk:** Nullable foreign key bisa membocorkan/mengaburkan tenant |
| `transaksi` | `amount` | `double precision` (`float8`) | Nilai uang mutasi transaksi | `NUMERIC(19, 2)` | `NOT NULL` + `CHECK (amount > 0)` | **High Risk:** Akumulasi desimal tidak presisi & nominal negatif merusak saldo |
| `transaksi` | `rekening_id` | `integer` | Rekening sumber mutasi | `INTEGER` | `NOT NULL` | **Critical Risk:** Transaksi tanpa rekening merusak integritas saldo |
| `transaksi` | `anggota_id` | `integer` | Anggota pencatat transaksi | `INTEGER` | `NOT NULL` | **Medium Risk:** Transaksi tanpa pembuat merusak laporan per anggota |
| `transaksi` | `destination_rekening_id` | *(Belum ada)* | Rekening tujuan saat transfer | `INTEGER REFERENCES rekening(id)` | `NULL` (kecuali `type = 'transfer'`) | **High Risk:** Fitur transfer uang belum memiliki wadah rekening penerima |
| `transaksi` | `date` | `timestamp` | Waktu transaksi terjadi | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | **Medium Risk:** Timezone naive menyebabkan pergeseran tanggal laporan |

---

## 2. Baseline Financial Metrics (Sebelum Migrasi)

Data eksisting pada database Supabase live dihitung secara presisi sebelum eksekusi migrasi:

### Rekening
- **Total Baris:** `1`
- **Total Balance:** `-119000.00`
- **Min Balance:** `-119000.00`
- **Max Balance:** `-119000.00`
- **NULL Balance:** `0`

### Transaksi
- **Total Baris:** `3`
- **Total Amount:** `119000.00`
- **Min Amount:** `15000.00`
- **Max Amount:** `70000.00`
- **NULL Amount:** `0`

*Semua nilai wajib diverifikasi sama persis 100% setelah proses migrasi selesai.*
