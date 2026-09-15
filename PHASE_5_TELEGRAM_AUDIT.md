# PHASE 5 — TELEGRAM SECURITY & SECURE ACCOUNT LINKING AUDIT

**Target:** https://github.com/glori2/KeuanganKeluarga
**Date:** September 2026
**Status:** In Progress (Phase 5)

---

## 1. Executive Summary

During Phase 0-4, the web application and core database layers were fully migrated to Supabase Auth, PostgreSQL RLS, multi-tenant isolation, and atomic numeric transactions.
However, the Telegram bot interface remained a critical attack surface with multiple high-risk vulnerabilities:

1. **Arbitrary Account Hijacking via Insecure Auto-Linking:** In pp/lib/telegram.ts, when an unknown Telegram user executed /start, the system matched the first available member in the database with 	elegram_id IS NULL and immediately bound the caller's Telegram ID to that member record. If no unlinked member existed, the caller was automatically inserted into Family 1.
2. **Missing Webhook Secret Verification:** pp/api/webhook/route.ts accepted unauthenticated POST requests without checking Telegram's X-Telegram-Bot-Api-Secret-Token header, allowing malicious actors to spoof updates.
3. **No Webhook Idempotency:** Telegram retries updates upon network timeouts. Without an idempotency store keyed on update_id, retried updates could cause duplicate financial mutations.
4. **Non-Atomic Financial Mutations:** Bot commands /catat and /masuk performed non-atomic INSERT and UPDATE statements without transaction blocks or row-level locking.

---

## 2. Vulnerability Assessment Matrix

| Vulnerability ID | Component | Severity | Description | Target Fix |
| :--- | :--- | :--- | :--- | :--- |
| **VULN-TG-01** | pp/lib/telegram.ts (/start) | **CRITICAL** | Insecure auto-linking allows arbitrary Telegram callers to take over unlinked member profiles or join Family 1 automatically. | Remove auto-linking. Require explicit OTP verification via /link <CODE>. |
| **VULN-TG-02** | pp/api/webhook/route.ts | **HIGH** | Missing secret token validation on webhook endpoint allows forged updates. | Enforce X-Telegram-Bot-Api-Secret-Token check using crypto.timingSafeEqual. |
| **VULN-TG-03** | pp/lib/telegram.ts | **HIGH** | No update deduplication (update_id) allows double transactions during network retries. | Store update_id in database table 	elegram_updates with unique constraint. |
| **VULN-TG-04** | pp/lib/telegram.ts (/catat, /masuk) | **MEDIUM** | Financial mutations executed without atomic transactions and row locks. | Wrap mutations in sql.begin with SELECT ... FOR UPDATE row locks. |
| **VULN-TG-05** | pp/lib/telegram.ts | **MEDIUM** | Missing link code expiration & single-use tracking. | Create 	elegram_link_codes table with 10-minute TTL and single-use used_at flag. |

---

## 3. Target Security Architecture

`	ext
[ Authenticated Web User ]
         │
         ▼  POST /api/telegram/link-code
[ Generate High-Entropy OTP (6-8 chars, 10-min TTL) ]
         │
         ▼  Stored in 	elegram_link_codes
[ User opens Telegram Bot: /link <OTP> ]
         │
         ▼  HTTPS POST to /api/webhook with Secret Token
[ Verify X-Telegram-Bot-Api-Secret-Token (Timing-Safe) ]
         │
         ▼  Check & record 	elegram_updates(update_id) (Idempotency)
[ Verify OTP in 	elegram_link_codes (not expired, not used) ]
         │
         ▼  Atomic Update
[ Bind 	elegram_id to nggota & mark OTP used_at = NOW() ]
         │
         ▼  Telegram Bot Ready
[ Strictly Isolated Financial Commands: /saldo, /catat, /masuk ]
`

---

## 4. Phase 5 Implementation Checklist

- [ ] **Migration 009:** Add 	elegram_link_codes and 	elegram_updates tables.
- [ ] **Webhook Authentication:** Validate secret token in pp/api/webhook/route.ts.
- [ ] **Secure Linking Flow:** Implement /link <code> and remove auto-linking on /start.
- [ ] **Idempotency Control:** Deduplicate updates via 	elegram_updates.
- [ ] **Atomic Financial Operations:** Ensure all bot financial entries execute atomically.
- [ ] **API Endpoint:** Create /api/telegram/link-code for authenticated web sessions.
- [ ] **Automated Test Suite:** Add 	ests/telegram_security_test.js verifying all security controls.
