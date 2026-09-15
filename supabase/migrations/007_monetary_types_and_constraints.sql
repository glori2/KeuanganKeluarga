-- ====================================================================
-- MIGRATION 007: MONETARY TYPES (NUMERIC 19,2) & INTEGRITY CONSTRAINTS
-- ====================================================================

-- 1. Ensure all existing NULL balances/amounts are safely normalized before altering types
UPDATE public.rekening SET balance = 0.0 WHERE balance IS NULL;
UPDATE public.transaksi SET amount = 0.01 WHERE amount IS NULL OR amount <= 0;
UPDATE public.rekening SET name = 'Dompet' WHERE name IS NULL OR name = '';
UPDATE public.transaksi SET category = 'Lain-lain' WHERE category IS NULL OR category = '';

-- 2. Alter column types for Rekening (Money precision: NUMERIC(19, 2))
ALTER TABLE public.rekening
    ALTER COLUMN balance TYPE NUMERIC(19, 2) USING ROUND(balance::numeric, 2),
    ALTER COLUMN balance SET DEFAULT 0.00,
    ALTER COLUMN balance SET NOT NULL,
    ALTER COLUMN name SET NOT NULL,
    ALTER COLUMN keluarga_id SET NOT NULL;

-- 3. Alter column types for Transaksi (Money precision: NUMERIC(19, 2))
ALTER TABLE public.transaksi
    ALTER COLUMN amount TYPE NUMERIC(19, 2) USING ROUND(amount::numeric, 2),
    ALTER COLUMN amount SET NOT NULL,
    ALTER COLUMN rekening_id SET NOT NULL,
    ALTER COLUMN anggota_id SET NOT NULL,
    ALTER COLUMN type SET NOT NULL,
    ALTER COLUMN category SET NOT NULL;

-- 4. Convert timestamp naive to timestamptz for time-zone consistency
ALTER TABLE public.transaksi
    ALTER COLUMN date TYPE TIMESTAMP WITH TIME ZONE USING timezone('utc'::text, date),
    ALTER COLUMN date SET DEFAULT timezone('utc'::text, now()),
    ALTER COLUMN date SET NOT NULL;

ALTER TABLE public.keluarga
    ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING timezone('utc'::text, created_at),
    ALTER COLUMN created_at SET DEFAULT timezone('utc'::text, now()),
    ALTER COLUMN name SET NOT NULL;

-- 5. Add CHECK Constraints for Business Integrity
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_transaksi_amount_positive'
    ) THEN
        ALTER TABLE public.transaksi
        ADD CONSTRAINT chk_transaksi_amount_positive CHECK (amount > 0);
    END IF;
END $$;
