-- ====================================================================
-- MIGRATION 011: FAMILY INVITATIONS & SECURE JOIN MECHANISM
-- ====================================================================

-- 1. Create family_invitations table
CREATE TABLE IF NOT EXISTS public.family_invitations (
    id SERIAL PRIMARY KEY,
    keluarga_id INTEGER NOT NULL REFERENCES public.keluarga(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (target_role IN ('admin', 'member')),
    target_anggota_id INTEGER REFERENCES public.anggota(id) ON DELETE SET NULL,
    invitation_code VARCHAR(32) NOT NULL UNIQUE,
    code_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    used_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Indexes for fast lookup & security
CREATE INDEX IF NOT EXISTS idx_family_invitations_code ON public.family_invitations(invitation_code);
CREATE INDEX IF NOT EXISTS idx_family_invitations_hash ON public.family_invitations(code_hash);
CREATE INDEX IF NOT EXISTS idx_family_invitations_keluarga ON public.family_invitations(keluarga_id);
CREATE INDEX IF NOT EXISTS idx_family_invitations_used_at ON public.family_invitations(used_at);
CREATE INDEX IF NOT EXISTS idx_family_invitations_expires_at ON public.family_invitations(expires_at);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.family_invitations ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Family members can view invitations of their own family
DROP POLICY IF EXISTS "Users can view invitations of their own family" ON public.family_invitations;
CREATE POLICY "Users can view invitations of their own family"
    ON public.family_invitations FOR SELECT
    USING (
        keluarga_id IN (SELECT public.get_auth_user_keluarga_ids())
    );

-- Family admins can insert invitations for their family
DROP POLICY IF EXISTS "Family admins can create invitations" ON public.family_invitations;
CREATE POLICY "Family admins can create invitations"
    ON public.family_invitations FOR INSERT
    WITH CHECK (
        keluarga_id IN (SELECT public.get_auth_user_keluarga_ids())
    );

-- Family admins can update/cancel invitations of their family
DROP POLICY IF EXISTS "Family admins can update invitations" ON public.family_invitations;
CREATE POLICY "Family admins can update invitations"
    ON public.family_invitations FOR UPDATE
    USING (
        keluarga_id IN (SELECT public.get_auth_user_keluarga_ids())
    );

-- 5. Expand audit_log action check constraint for invitation events
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'audit_log_action_check'
    ) THEN
        ALTER TABLE public.audit_log DROP CONSTRAINT audit_log_action_check;
        ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_check 
            CHECK (action IN ('CREATE', 'UPDATE', 'VOID', 'TRANSFER', 'INVITATION_CREATE', 'INVITATION_ACCEPT'));
    END IF;
END $$;
