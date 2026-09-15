-- ====================================================================
-- MIGRATION 006: ROW LEVEL SECURITY (RLS) FOR TRANSAKSI
-- ====================================================================

-- 1. Enable RLS on transaksi table
ALTER TABLE public.transaksi ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies
DROP POLICY IF EXISTS "Users can view transactions of their own family" ON public.transaksi;
DROP POLICY IF EXISTS "Users can insert transactions for their family" ON public.transaksi;
DROP POLICY IF EXISTS "Users can update transactions of their family" ON public.transaksi;
DROP POLICY IF EXISTS "Users can delete transactions of their family" ON public.transaksi;

-- 3. RLS Policies for transaksi (verified via rekening ownership)
CREATE POLICY "Users can view transactions of their own family"
    ON public.transaksi FOR SELECT
    USING (
        rekening_id IN (
            SELECT id FROM public.rekening WHERE keluarga_id IN (SELECT public.get_auth_user_keluarga_ids())
        )
    );

CREATE POLICY "Users can insert transactions for their family"
    ON public.transaksi FOR INSERT
    WITH CHECK (
        rekening_id IN (
            SELECT id FROM public.rekening WHERE keluarga_id IN (SELECT public.get_auth_user_keluarga_ids())
        )
        AND anggota_id IN (
            SELECT id FROM public.anggota WHERE keluarga_id IN (SELECT public.get_auth_user_keluarga_ids())
        )
    );

CREATE POLICY "Users can update transactions of their family"
    ON public.transaksi FOR UPDATE
    USING (
        rekening_id IN (
            SELECT id FROM public.rekening WHERE keluarga_id IN (SELECT public.get_auth_user_keluarga_ids())
        )
    );

CREATE POLICY "Users can delete transactions of their family"
    ON public.transaksi FOR DELETE
    USING (
        rekening_id IN (
            SELECT id FROM public.rekening WHERE keluarga_id IN (SELECT public.get_auth_user_keluarga_ids())
        )
    );
