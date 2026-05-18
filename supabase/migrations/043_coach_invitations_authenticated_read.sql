-- Migration 043: allow authenticated users to SELECT coach_invitations rows.
-- Root cause: Supabase PostgREST forces row_security=on for all roles, including
-- postgres, so SECURITY DEFINER functions (peek_invitation, redeem_invitation_code)
-- cannot bypass RLS when called via the REST API. The athlete trying to redeem a
-- code needs to read the invitation row inside those RPCs.
-- INSERT/UPDATE/DELETE remain gated by the existing "coach_invitations_own" policy.
CREATE POLICY "coach_invitations_authenticated_read" ON public.coach_invitations
  FOR SELECT
  USING (auth.uid() IS NOT NULL);
