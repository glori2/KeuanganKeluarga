# 🧪 PRODUCTION SMOKE TEST PLAN

**Application:** KeuanganKeluarga  
**Target:** Live Production Environment (Vercel + Supabase)  
**Document Version:** 1.0 (Phase 8 Production Audit)  
**Date:** September 2026

---

## 1. Overview

This smoke test plan is designed to verify the operational readiness of a fresh production deployment while distinguishing between **Safe Read-Only Checks** and **Controlled Write Tests**.

---

## 2. Safe Read-Only Verification Checks (Zero Side-Effects)

Execute these checks immediately after deployment to verify routing, headers, and security boundaries without modifying production data.

| Step | Target Endpoint / Page | Expected Result | Pass Criteria |
| :--- | :--- | :--- | :---: |
| **1. HTTPS & Security Headers** | `GET https://<DOMAIN>/` | Redirects HTTP ➔ HTTPS. Returns security headers (`X-Content-Type-Options`, `Referrer-Policy`). | [ ] |
| **2. Auth Guard on Protected Route** | `GET https://<DOMAIN>/` (No cookies) | Server returns redirect (307/308) to `/login`. No dashboard or data is exposed. | [ ] |
| **3. Webhook Unauthenticated Reject** | `POST https://<DOMAIN>/api/webhook` | Request without `X-Telegram-Bot-Api-Secret-Token` header returns `401 Unauthorized`. | [ ] |
| **4. Webhook Invalid Secret Reject** | `POST https://<DOMAIN>/api/webhook` | Request with invalid secret header returns `401 Unauthorized`. | [ ] |
| **5. Client Bundle Secret Scan** | `View Page Source` on `/login` | Verified that `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, and `TELEGRAM_BOT_TOKEN` are completely absent. | [ ] |

---

## 3. Controlled Write Tests (Execute with Test Family Account)

Perform these tests with a designated test family user account to verify full multi-tenant end-to-end functionality.

| Step | Action | Expected Result | Pass Criteria |
| :--- | :--- | :--- | :---: |
| **1. Registration & Onboarding** | Register new account at `/register` | User created in `auth.users`, family created in `keluarga`, admin member created in `anggota`. | [ ] |
| **2. Create Wallet / Account** | Add wallet "Dompet Tunai" with initial balance Rp 500.000 | Record created in `rekening`, total saldo updates to Rp 500.000. | [ ] |
| **3. Record Expense** | Record expense "Makan Siang" Rp 50.000 | `transaksi` created with `status = 'posted'`, wallet balance decrements to Rp 450.000, `audit_log` records `CREATE`. | [ ] |
| **4. Record Transfer** | Add second wallet "BCA" Rp 1.000.000, transfer Rp 200.000 to "Dompet Tunai" | "BCA" balance becomes Rp 800.000, "Dompet Tunai" balance becomes Rp 650.000, `audit_log` records `TRANSFER`. | [ ] |
| **5. Void Transaction** | Click 🚫 to void "Makan Siang" Rp 50.000 | "Dompet Tunai" balance restores to Rp 700.000, transaction marked `Dibatalkan (Void)`, `audit_log` records `VOID`. | [ ] |
| **6. Inspect Audit Trail** | Click 📜 on voided transaction | Modal displays immutable timeline showing creation and void reversal with actor and timestamp. | [ ] |
| **7. Telegram OTP Linking** | Click "Kode OTP Telegram" in `/anggota` | Modal displays 8-character OTP code with 10-minute expiry countdown. | [ ] |
| **8. Telegram Bot Commands** | In Telegram, run `/link <CODE>`, then `/saldo` | Bot confirms account linked and displays current family wallet balances accurately. | [ ] |
| **9. CSV Export** | Download monthly report CSV from `/laporan` | CSV downloaded with semicolon separator, formulas sanitized with `'`, and status column present. | [ ] |
| **10. Logout** | Click "Keluar" in Navbar | Sesi cleared, protected routes inaccessible, redirected to `/login`. | [ ] |
