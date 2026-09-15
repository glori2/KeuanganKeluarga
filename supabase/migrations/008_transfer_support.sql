-- ====================================================================
-- MIGRATION 008: TRANSFER SUPPORT & DUAL ACCOUNT INTEGRITY
-- ====================================================================

-- 1. Add destination_rekening_id to transaksi table for transfers
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' 
          AND table_name = 'transaksi' 
          AND column_name = 'destination_rekening_id'
    ) THEN
        ALTER TABLE public.transaksi
        ADD COLUMN destination_rekening_id INTEGER REFERENCES public.rekening(id) ON DELETE RESTRICT;
    END IF;
END $$;

-- 2. Create index on destination_rekening_id
CREATE INDEX IF NOT EXISTS idx_transaksi_destination_rekening_id 
ON public.transaksi(destination_rekening_id);

-- 3. Add CHECK Constraint ensuring transfer integrity
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_transaksi_transfer_validity'
    ) THEN
        ALTER TABLE public.transaksi
        ADD CONSTRAINT chk_transaksi_transfer_validity CHECK (
            (type = 'transfer' AND destination_rekening_id IS NOT NULL AND destination_rekening_id <> rekening_id)
            OR
            (type <> 'transfer' AND destination_rekening_id IS NULL)
        );
    END IF;
END $$;
