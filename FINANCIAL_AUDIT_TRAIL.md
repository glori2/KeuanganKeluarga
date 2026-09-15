# 📜 FINANCIAL AUDIT TRAIL, VOID & REVERSAL ARCHITECTURE

**Application:** KeuanganKeluarga  
**Database:** PostgreSQL / Supabase  
**Status:** Production-Ready & Formally Verified (Phase 6)

---

## 1. Overview & Core Philosophy

In financial systems, posted ledger records must never be destructively purged from the database. Deleting posted transactions destroys the historical audit trail and makes financial auditing impossible.

**Phase 6 implements a robust, immutable audit trail with soft-void and atomic balance reversal semantics:**

`	ext
       [ CREATE / TRANSFER ]
                 │
                 ▼
          ┌─────────────┐
          │   POSTED    │ ───► UPDATE (Preserves POSTED, logs before/after diff)
          └──────┬──────┘
                 │
                 ▼  [ VOID / REVERSE ] (Atomic balance restoration)
          ┌─────────────┐
          │   VOIDED    │ ───► TERMINAL STATE (Immutable, cannot be edited or re-voided)
          └─────────────┘
`

---

## 2. Database Schema & Immutability

### A. Lifecycle Fields on 	ransaksi
`sql
ALTER TABLE transaksi ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'voided'));
ALTER TABLE transaksi ADD COLUMN voided_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE transaksi ADD COLUMN voided_by UUID REFERENCES auth.users(id) DEFAULT NULL;
ALTER TABLE transaksi ADD COLUMN void_reason TEXT DEFAULT NULL;
`

### B. Append-Only udit_log Table
`sql
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    keluarga_id INTEGER NOT NULL REFERENCES keluarga(id) ON DELETE CASCADE,
    transaksi_id INTEGER REFERENCES transaksi(id) ON DELETE SET NULL,
    actor_user_id UUID REFERENCES auth.users(id) DEFAULT NULL,
    actor_type VARCHAR(20) NOT NULL DEFAULT 'web' CHECK (actor_type IN ('web', 'telegram', 'system', 'api')),
    actor_name VARCHAR(100) DEFAULT NULL,
    telegram_id VARCHAR(64) DEFAULT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'VOID', 'TRANSFER')),
    old_data JSONB DEFAULT NULL,
    new_data JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`

### C. Engine-Level Immutability Trigger
To guarantee that audit logs can never be tampered with (even by direct SQL execution or bugs), a PostgreSQL trigger enforces immutability:
`sql
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS 
BEGIN
    RAISE EXCEPTION 'IMMUTABILITY_VIOLATION: Audit log records cannot be updated or deleted.';
END;
 LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_log_immutable
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_modification();
`

---

## 3. Actor Tracking & Identity Resolution

Audit records attribute all actions to verified identity sources:
- **Web App Users:** Resolves ctor_user_id from the authenticated Supabase session (uth.uid()) and member profile name.
- **Telegram Bot Users:** Resolves ctor_type = 'telegram', 	elegram_id = '<SENDER_ID>', and bound member name.
- **Client Spoofing Protection:** Identity attributes are strictly generated on the server side and never accepted blindly from request payloads.

---

## 4. Atomic Void & Reversal Semantics

When a transaction is voided:
1. Row lock acquired on 	ransaksi and affected ekening(s) (FOR UPDATE).
2. Double-void protection verifies status != 'voided'.
3. Balance effect is reversed:
   - **Income Void:** ekening.balance = balance - amount
   - **Expense Void:** ekening.balance = balance + amount
   - **Transfer Reversal:** source_rekening.balance = balance + amount and dest_rekening.balance = balance - amount
4. Transaction is marked status = 'voided', oided_at = NOW(), oid_reason = reason.
5. Audit log records ction = 'VOID' with previous and voided snapshots.
6. The entire operation executes atomically inside sql.begin.

---

## 5. API Endpoints

| Endpoint | Method | Authorization | Description |
| :--- | :--- | :--- | :--- |
| /api/transaksi | POST | Family Member | Creates a new transaction with CREATE audit log. |
| /api/transaksi/transfer | POST | Family Member | Processes inter-account transfer with TRANSFER audit log. |
| /api/transaksi/[id] | PUT | Family Member | Updates transaction fields with UPDATE audit log (before/after diff). Rejects voided records. |
| /api/transaksi/[id] | DELETE | Family Member | Soft-voids transaction preserving history. |
| /api/transaksi/[id]/void | POST | Family Member | Explicit void endpoint with optional reason payload ({ reason: ... }). |
| /api/transaksi/[id]/audit | GET | Family Member | Retrieves chronological audit trail for the transaction. |

---

## 6. Automated Verification Summary

All audit trail features are tested via 	ests/audit_trail_test.js:
- ✅ Transaction creation records immutable CREATE audit log.
- ✅ Transaction update records before/after diff in UPDATE audit log.
- ✅ Voiding expense restores account balance atomically.
- ✅ Void status, reason, and timestamp properly saved.
- ✅ Double-void attempts are rejected and balance is preserved.
- ✅ Editing a voided transaction is strictly forbidden.
- ✅ Direct UPDATE and DELETE on udit_log are blocked by PostgreSQL trigger.
- ✅ Transfer reversal atomically refunds source and debits destination.
- ✅ Telegram bot mutations accurately record ctor_type=telegram and 	elegram_id.
- ✅ Tenant isolation ensures Family A cannot access Family B's audit logs.
- ✅ Financial reconciliation sums only status = 'posted' transactions.
