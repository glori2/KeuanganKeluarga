# PHASE 6 — FINANCIAL AUDIT TRAIL, VOID & REVERSAL AUDIT

**Target:** https://github.com/glori2/KeuanganKeluarga  
**Date:** September 2026  
**Status:** In Progress (Phase 6)

---

## 1. Executive Summary & Existing Transaction Lifecycle

In Phases 2-5, financial mutations were migrated to Supabase PostgreSQL, NUMERIC(19,2), and atomic transactions with FOR UPDATE locking.
However, the system lacked a permanent audit trail and relied on destructive physical deletion:

1. **Destructive Physical Deletions:** Calling DELETE /api/transaksi/[id] executed DELETE FROM transaksi WHERE id = . While balances were adjusted, the historical transaction record was permanently purged from the database, preventing regulatory audit and reconciliation tracking.
2. **Missing Status State Machine:** Transactions lacked a lifecycle status (e.g. posted vs oided). A voided/cancelled transaction could not be distinguished from a non-existent one.
3. **No Append-Only Audit Trail:** Neither creates, updates, transfers, nor deletions recorded the actor (ctor_user_id, 	elegram_id), timestamp, or before/after delta in an immutable audit ledger.
4. **No Double-Void Protection:** Because void was not distinct from delete, consecutive cancel attempts could either error on missing records or lead to uncontrolled state if modified.

---

## 2. Operation Lifecycle Comparison Matrix

| Operation | Current Behavior | Financial & Security Risk | Target Phase 6 Behavior |
| :--- | :--- | :--- | :--- |
| **Create (Income/Expense)** | Direct INSERT INTO transaksi with balance increment/decrement. | No actor attribution or creation timestamp audit log. | Inserts transaction with status = 'posted'; creates immutable udit_log record (CREATE). |
| **Transfer** | Direct INSERT of transfer record + dual balance update. | Dual account impacts not auditable via audit ledger. | Inserts transfer with status = 'posted'; creates immutable udit_log record (TRANSFER). |
| **Update** | Reverts old balance, overwrites fields, applies new balance. | No before/after diff; could allow updating a cancelled transaction. | Blocks updates on oided transactions; records old_data vs 
ew_data in udit_log (UPDATE). |
| **Delete / Void** | Hard physical DELETE FROM transaksi. | Destroys financial audit trail; history lost forever. | Replaces hard delete with atomic oidTransaksi: sets status = 'voided', reverts balance, logs VOID in udit_log. Record is preserved permanently. |
| **Transfer Reversal** | Non-existent (would require hard delete). | Inconsistent reversal risks. | Atomically reverses source debit and destination credit; marks status = 'voided' and logs VOID. |
| **Telegram Mutations** | Bot calls createTransaksi without identity context. | Impossible to distinguish web vs Telegram mutations. | Records Telegram actor (	elegram_id, member name, ctor_type = 'telegram') in udit_log. |

---

## 3. Minimal State Machine Design

`	ext
       [ CREATE / TRANSFER ]
                 │
                 ▼
          ┌─────────────┐
          │   POSTED    │ ───► UPDATE (Preserves POSTED, logs audit diff)
          └──────┬──────┘
                 │
                 ▼  [ VOID / REVERSE ] (Atomic balance restoration)
          ┌─────────────┐
          │   VOIDED    │ ───► TERMINAL STATE (Immutable, cannot be edited or re-voided)
          └─────────────┘
`

---

## 4. Phase 6 Implementation Checklist

- [ ] **Migration 010:** Add status, oided_at, oided_by, oid_reason to 	ransaksi; create immutable udit_log table with RLS.
- [ ] **Database Immutability Trigger:** Prevent UPDATE and DELETE operations on udit_log table at the PostgreSQL engine level.
- [ ] **Atomic Void & Reversal Logic:** Implement oidTransaksi in pp/lib/queries.ts supporting income, expense, and transfer reversals.
- [ ] **Audit Trail Integration:** Integrate udit_log writes in createTransaksi, createTransfer, updateTransaksi, and oidTransaksi.
- [ ] **API Endpoint Protection:** Update DELETE /api/transaksi/[id], add POST /api/transaksi/[id]/void, and GET /api/transaksi/[id]/audit.
- [ ] **Telegram Audit Attribution:** Pass Telegram actor context during bot financial recordings.
- [ ] **Automated Test Suite:** Create 	ests/audit_trail_test.js validating all 12+ audit & void security constraints.
