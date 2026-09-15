# 🚨 DISASTER RECOVERY & INCIDENT RESPONSE RUNBOOK

**Application:** KeuanganKeluarga  
**Architecture:** Next.js 16 (Vercel) + PostgreSQL (Supabase Tokyo) + Telegram Webhook  
**Document Version:** 1.0 (Phase 8 Production Audit)  
**Date:** September 2026

---

## 1. Overview

This document provides actionable procedures for recovering from critical operational disruptions, credential leaks, deployment failures, and infrastructure outages.

---

## 2. Disaster Recovery Scenarios & Playbooks

### Scenario A: Accidental Data Corruption or Erroneous Transactions
- **Impact:** Erroneous transactions recorded or balances miscalculated.
- **Recovery Action:**
  1. Use the **Soft-Void Mechanism** via Web Dashboard or `POST /api/transaksi/[id]/void` to cancel the transaction.
  2. The system will automatically restore affected account balances atomically and preserve the audit record.
  3. For large-scale data repair, run the balance reconciliation query:
     ```sql
     -- Verify stored vs active transactions
     SELECT r.id, r.name, r.balance,
            COALESCE(SUM(CASE 
              WHEN t.type = 'income' THEN t.amount 
              WHEN t.type = 'expense' THEN -t.amount 
              ELSE 0 END), 0) AS calculated_balance
     FROM rekening r
     LEFT JOIN transaksi t ON t.rekening_id = r.id AND t.status = 'posted'
     GROUP BY r.id, r.name, r.balance;
     ```

---

### Scenario B: Credential Leak or Database Password Exposure
- **Impact:** Potential unauthorized access to PostgreSQL database.
- **Recovery Action:**
  1. Open **Supabase Dashboard** ➔ Project Settings ➔ Database.
  2. Click **Reset Database Password** and generate a strong password.
  3. Copy the updated connection pooler URI.
  4. Open **Vercel Dashboard** ➔ Project Settings ➔ Environment Variables.
  5. Update `DATABASE_URL` with the new URI.
  6. Trigger a redeployment in Vercel.

---

### Scenario C: Telegram Bot Token Compromise
- **Impact:** Malicious actors could intercept or forge Telegram messages.
- **Recovery Action:**
  1. Open Telegram and chat with `@BotFather`.
  2. Send `/revoke` and select your bot to immediately revoke the old token.
  3. Copy the newly generated token.
  4. In Vercel Environment Variables, update `TELEGRAM_BOT_TOKEN` and generate a fresh `TELEGRAM_WEBHOOK_SECRET`.
  5. Re-register the webhook with Telegram:
     ```text
     https://api.telegram.org/bot<NEW_TOKEN>/setWebhook?url=https://<VERCEL_DOMAIN>/api/webhook&secret_token=<NEW_SECRET>
     ```

---

### Scenario D: Vercel Deployment Failure / Rollback
- **Impact:** Application becomes inaccessible or throws 500 runtime errors.
- **Recovery Action:**
  1. Open **Vercel Dashboard** ➔ Deployments.
  2. Locate the last known good deployment (marked green).
  3. Click **Instant Rollback** to immediately direct production traffic to the previous stable build.
  4. Inspect build logs to debug the issue locally before redeploying.

---

### Scenario E: Supabase Outage / Regional Failure
- **Impact:** Database becomes unresponsive or read-only.
- **Recovery Action:**
  1. Check [status.supabase.com](https://status.supabase.com) for Tokyo AWS region incidents.
  2. If an outage is prolonged, provision a secondary Supabase project and execute idempotent migrations in order (`supabase/migrations/001_*.sql` through `010_*.sql`).
  3. Restore table data from the latest Supabase backup export (`pg_dump` / SQL dump).
  4. Update `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `DATABASE_URL` in Vercel.

---

## 3. Contact & Escalation Roster

| Role | Responsibility | Action Channel |
| :--- | :--- | :--- |
| **Project Owner** | Primary authorization for password rotation & DNS | GitHub / Supabase Admin |
| **Hosting Platform** | Edge hosting & runtime delivery | Vercel Support / Dashboard |
| **Database Provider** | PostgreSQL engine & connection pooler | Supabase Support / Dashboard |
| **Messaging Provider** | Telegram Bot API & webhook delivery | Telegram `@BotFather` |
