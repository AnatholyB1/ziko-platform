-- Migration 044: allow coaches to SELECT user_profiles of their linked clients.
-- Root cause: migration 035 added 11 cross-user coach_read policies but missed
-- user_profiles, so coaches querying client name/avatar_url got empty rows.
-- INSERT/UPDATE/DELETE remain gated by the existing own-user policy.
CREATE POLICY "user_profiles_coach_read" ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = id OR public.is_coach_of(auth.uid(), id));
