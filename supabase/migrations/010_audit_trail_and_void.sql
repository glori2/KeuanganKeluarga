-- ====================================================================
-- Migration 010: Financial Audit Trail, Lifecycle Status & Void Support
-- ====================================================================

-- 1. Add Lifecycle & Void Fields to transaksi table
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'posted';
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES auth.users(id) DEFAULT NULL;
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS void_reason TEXT DEFAULT NULL;

-- Ensure status constraint is present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_transaksi_status'
    ) THEN
        ALTER TABLE transaksi ADD CONSTRAINT chk_transaksi_status 
            CHECK (status IN ('posted', 'voided'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transaksi_status ON transaksi(status);
CREATE INDEX IF NOT EXISTS idx_transaksi_rekening_status ON transaksi(rekening_id, status);

-- 2. Create Immutable Audit Log Table
CREATE TABLE IF NOT EXISTS audit_log (
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

CREATE INDEX IF NOT EXISTS idx_audit_log_keluarga_id ON audit_log(keluarga_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_transaksi_id ON audit_log(transaksi_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

-- 3. PostgreSQL Immutability Trigger (Prevent UPDATE and DELETE on audit_log)
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'IMMUTABILITY_VIOLATION: Audit log records cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_immutable ON audit_log;
CREATE TRIGGER trg_audit_log_immutable
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_modification();

-- 4. Enable Row Level Security (RLS) on audit_log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Allow users to SELECT only audit records belonging to their family
DROP POLICY IF EXISTS "Users can view audit log for their family" ON audit_log;
CREATE POLICY "Users can view audit log for their family" ON audit_log
    FOR SELECT
    USING (
        keluarga_id IN (SELECT get_auth_user_keluarga_ids())
    );

-- Allow inserting audit records (server functions and authenticated clients)
DROP POLICY IF EXISTS "Users can insert audit log for their family" ON audit_log;
CREATE POLICY "Users can insert audit log for their family" ON audit_log
    FOR INSERT
    WITH CHECK (true);
