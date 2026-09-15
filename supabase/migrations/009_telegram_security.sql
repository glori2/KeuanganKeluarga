-- ====================================================================
-- Migration 009: Telegram Security & Account Linking Tables
-- ====================================================================

-- 1. Table for secure, time-limited, single-use Telegram linking OTP codes
CREATE TABLE IF NOT EXISTS telegram_link_codes (
    id SERIAL PRIMARY KEY,
    anggota_id INTEGER NOT NULL REFERENCES anggota(id) ON DELETE CASCADE,
    code VARCHAR(32) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for rapid OTP lookup & validation
CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_code ON telegram_link_codes(code);
CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_anggota ON telegram_link_codes(anggota_id);

-- 2. Table for Telegram Webhook Idempotency (Deduplication of update_id)
CREATE TABLE IF NOT EXISTS telegram_updates (
    update_id BIGINT PRIMARY KEY,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ DEFAULT NULL
);

-- Index on anggota.telegram_id for fast lookup during bot interactions
CREATE INDEX IF NOT EXISTS idx_anggota_telegram_id ON anggota(telegram_id);

-- Add telegram_chat_id column to anggota if it does not exist
ALTER TABLE anggota ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;

-- Enable RLS on telegram_link_codes
ALTER TABLE telegram_link_codes ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage link codes for anggota within their own family
DROP POLICY IF EXISTS "Users can manage link codes for their family members" ON telegram_link_codes;
CREATE POLICY "Users can manage link codes for their family members" ON telegram_link_codes
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM anggota a
            JOIN anggota my_a ON a.keluarga_id = my_a.keluarga_id
            WHERE a.id = telegram_link_codes.anggota_id
              AND my_a.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM anggota a
            JOIN anggota my_a ON a.keluarga_id = my_a.keluarga_id
            WHERE a.id = telegram_link_codes.anggota_id
              AND my_a.user_id = auth.uid()
        )
    );

-- Enable RLS on telegram_updates (Bot backend access via direct SQL or service role)
ALTER TABLE telegram_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service access for telegram updates" ON telegram_updates;
CREATE POLICY "Service access for telegram updates" ON telegram_updates
    FOR ALL
    USING (true)
    WITH CHECK (true);
