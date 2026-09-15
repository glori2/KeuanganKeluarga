-- ====================================================================
-- MIGRATION 003: ROW LEVEL SECURITY (RLS) FOR KELUARGA
-- ====================================================================

-- 1. Helper Security Definer function to get family IDs of authenticated user
CREATE OR REPLACE FUNCTION public.get_auth_user_keluarga_ids()
RETURNS SETOF INTEGER AS $$
BEGIN
    RETURN QUERY
    SELECT keluarga_id 
    FROM public.anggota 
    WHERE user_id = auth.uid() AND keluarga_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Enable RLS on keluarga table
ALTER TABLE public.keluarga ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to prevent duplicates
DROP POLICY IF EXISTS "Users can view their own family" ON public.keluarga;
DROP POLICY IF EXISTS "Admins can update their own family" ON public.keluarga;
DROP POLICY IF EXISTS "Authenticated users can create family" ON public.keluarga;

-- 4. Create Tenant Isolation Policies for keluarga
CREATE POLICY "Users can view their own family"
    ON public.keluarga FOR SELECT
    USING (id IN (SELECT public.get_auth_user_keluarga_ids()));

CREATE POLICY "Admins can update their own family"
    ON public.keluarga FOR UPDATE
    USING (id IN (SELECT public.get_auth_user_keluarga_ids()));

CREATE POLICY "Authenticated users can create family"
    ON public.keluarga FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
