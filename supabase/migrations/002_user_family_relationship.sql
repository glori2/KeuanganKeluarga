-- ====================================================================
-- MIGRATION 002: USER TO FAMILY & ANGGOTA RELATIONSHIP
-- ====================================================================

-- 1. Add user_id column to anggota table to link with auth.users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' 
          AND table_name = 'anggota' 
          AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.anggota 
        ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Add created_at and updated_at to tables if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'keluarga' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.keluarga ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'anggota' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE public.anggota ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
    END IF;
END $$;

-- 3. Create index for fast family ownership resolution
CREATE INDEX IF NOT EXISTS idx_anggota_user_id ON public.anggota(user_id);
CREATE INDEX IF NOT EXISTS idx_anggota_keluarga_id ON public.anggota(keluarga_id);
CREATE INDEX IF NOT EXISTS idx_rekening_keluarga_id ON public.rekening(keluarga_id);
CREATE INDEX IF NOT EXISTS idx_transaksi_rekening_id ON public.transaksi(rekening_id);
CREATE INDEX IF NOT EXISTS idx_transaksi_anggota_id ON public.transaksi(anggota_id);
CREATE INDEX IF NOT EXISTS idx_transaksi_date ON public.transaksi(date);
