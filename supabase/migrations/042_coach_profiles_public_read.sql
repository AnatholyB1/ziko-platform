-- ============================================================
-- 042 — coach_profiles: authenticated public read policy
-- Phase 25 gap fix: the existing "coach_profiles_own" policy
-- only lets coaches read their own row. Athletes who are linked
-- to a coach need to read the coach's display name / bio / photo
-- for the /redeem page (getActiveLink) and for any future CRM
-- surfaces. kyc_docs (sensitive) is not exposed via any API
-- endpoint and remains protected.
-- ============================================================

SET LOCAL lock_timeout = '5s';

-- Allow any authenticated user to SELECT coach_profiles rows.
-- INSERT/UPDATE/DELETE are still gated by the existing FOR ALL
-- "coach_profiles_own" policy (auth.uid() = user_id).
CREATE POLICY "coach_profiles_authenticated_read" ON public.coach_profiles
  FOR SELECT
  USING (auth.uid() IS NOT NULL);
