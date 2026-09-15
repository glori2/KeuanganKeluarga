-- ====================================================================
-- MIGRATION 004: ROW LEVEL SECURITY (RLS) FOR ANGGOTA
-- ====================================================================

-- 1. Enable RLS on anggota table
ALTER TABLE public.anggota ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies
DROP POLICY IF EXISTS "Users can view members of their own family" ON public.anggota;
DROP POLICY IF EXISTS "Family admins can insert members" ON public.anggota;
DROP POLICY IF EXISTS "Family admins can update members" ON public.anggota;
DROP POLICY IF EXISTS "Family admins can delete members" ON public.anggota;

-- 3. RLS Policies for anggota
CREATE POLICY "Users can view members of their own family"
    ON public.anggota FOR SELECT
    USING (
        keluarga_id IN (SELECT public.get_auth_user_keluarga_ids())
        OR user_id = auth.uid()
    );

CREATE POLICY "Family admins can insert members"
    ON public.anggota FOR INSERT
    WITH CHECK (
        keluarga_id IN (SELECT public.get_auth_user_keluarga_ids())
        OR auth.role() = 'authenticated'
    );

CREATE POLICY "Family admins can update members"
    ON public.anggota FOR UPDATE
    USING (
        keluarga_id IN (SELECT public.get_auth_user_keluarga_ids())
        OR user_id = auth.uid()
    );

CREATE POLICY "Family admins can delete members"
    ON public.anggota FOR DELETE
    USING (
        keluarga_id IN (SELECT public.get_auth_user_keluarga_ids())
    );
