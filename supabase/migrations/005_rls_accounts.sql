-- ====================================================================
-- MIGRATION 005: ROW LEVEL SECURITY (RLS) FOR REKENING
-- ====================================================================

-- 1. Enable RLS on rekening table
ALTER TABLE public.rekening ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies
DROP POLICY IF EXISTS "Users can view accounts of their own family" ON public.rekening;
DROP POLICY IF EXISTS "Users can insert accounts for their family" ON public.rekening;
DROP POLICY IF EXISTS "Users can update accounts of their family" ON public.rekening;
DROP POLICY IF EXISTS "Users can delete accounts of their family" ON public.rekening;

-- 3. RLS Policies for rekening
CREATE POLICY "Users can view accounts of their own family"
    ON public.rekening FOR SELECT
    USING (keluarga_id IN (SELECT public.get_auth_user_keluarga_ids()));

CREATE POLICY "Users can insert accounts for their family"
    ON public.rekening FOR INSERT
    WITH CHECK (keluarga_id IN (SELECT public.get_auth_user_keluarga_ids()));

CREATE POLICY "Users can update accounts of their family"
    ON public.rekening FOR UPDATE
    USING (keluarga_id IN (SELECT public.get_auth_user_keluarga_ids()));

CREATE POLICY "Users can delete accounts of their family"
    ON public.rekening FOR DELETE
    USING (keluarga_id IN (SELECT public.get_auth_user_keluarga_ids()));
