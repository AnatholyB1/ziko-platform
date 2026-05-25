-- ============================================================
-- 035 — Coach Invitations, Links, is_coach_of(), Redeem RPC,
--       11 cross-user FOR SELECT policies (THE RLS KEYSTONE)
-- Phase 22, milestone v1.5. Per D-15: one transactional unit.
-- Per D-RLS-02: SET LOCAL lock_timeout fails fast on contention.
-- ============================================================

SET LOCAL lock_timeout = '5s';

-- ───────────────────────────────────────────────────────────
-- 1. coach_invitations (D-07 — full Phase 25 column set)
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coach_invitations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code          TEXT NOT NULL UNIQUE
                  CHECK (code ~ '^[A-Z2-9]{6}$'),
  client_email  TEXT NULL,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  used_at       TIMESTAMPTZ NULL,
  used_by       UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at    TIMESTAMPTZ NULL,
  max_uses      INTEGER NOT NULL DEFAULT 1 CHECK (max_uses >= 1),
  use_count     INTEGER NOT NULL DEFAULT 0
                  CHECK (use_count >= 0 AND use_count <= max_uses),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coach_invitations_coach
  ON public.coach_invitations(coach_id);

ALTER TABLE public.coach_invitations ENABLE ROW LEVEL SECURITY;

-- Coach owns their invitations (FOR ALL).
CREATE POLICY "coach_invitations_own" ON public.coach_invitations
  FOR ALL
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

-- ───────────────────────────────────────────────────────────
-- 2. coach_client_links (D-01, D-04 — timestamp lifecycle)
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coach_client_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NULL,
  revoked_at  TIMESTAMPTZ NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (coach_id <> client_id)
);

-- D-04: single partial UNIQUE doubles as RLS hot-path index.
CREATE UNIQUE INDEX IF NOT EXISTS coach_client_links_active_uq
  ON public.coach_client_links (coach_id, client_id)
  WHERE revoked_at IS NULL;

-- Companion lookup index for is_coach_of() — covers the same predicate.
CREATE INDEX IF NOT EXISTS idx_coach_client_links_pair_active
  ON public.coach_client_links (coach_id, client_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.coach_client_links ENABLE ROW LEVEL SECURITY;

-- Both coach and client can read their own link rows.
CREATE POLICY "coach_client_links_participant_read" ON public.coach_client_links
  FOR SELECT
  USING (auth.uid() = coach_id OR auth.uid() = client_id);

-- Client can revoke (UPDATE) their own links; coach can revoke their own links.
-- Insert happens only via redeem_invitation_code() (SECURITY DEFINER bypasses RLS),
-- so a base policy that denies direct INSERT is sufficient — we model it by
-- omitting FOR INSERT policies (default = deny).
CREATE POLICY "coach_client_links_participant_revoke" ON public.coach_client_links
  FOR UPDATE
  USING (auth.uid() = coach_id OR auth.uid() = client_id)
  WITH CHECK (auth.uid() = coach_id OR auth.uid() = client_id);

-- ───────────────────────────────────────────────────────────
-- 3. is_coach_of() — THE KEYSTONE (D-02, D-03)
-- LANGUAGE sql STABLE SECURITY DEFINER, search_path hardened.
-- Inline EXISTS predicate, no logging on the hot path.
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_coach_of(coach UUID, client UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coach_client_links
    WHERE coach_id = coach
      AND client_id = client
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_coach_of(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_coach_of(UUID, UUID) TO authenticated;

-- ───────────────────────────────────────────────────────────
-- 4. redeem_invitation_code() — constant-time RPC (D-08)
-- LANGUAGE plpgsql, single CTE collects all state, single CASE chain.
-- 6 error codes: INVALID_CODE, EXPIRED, REVOKED, ALREADY_USED, SELF_INVITATION, LINK_EXISTS
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.redeem_invitation_code(code_input TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id    UUID := auth.uid();
  v_inv          RECORD;
  v_new_link_id  UUID;
  v_error        TEXT := NULL;
BEGIN
  -- Single SELECT gathers ALL state (runs regardless of code validity).
  -- LIMIT 1 + UNIQUE index on code => O(log n) constant work.
  SELECT
    inv.id            AS id,
    inv.coach_id      AS coach_id,
    inv.expires_at    AS expires_at,
    inv.revoked_at    AS revoked_at,
    inv.used_at       AS used_at,
    inv.use_count     AS use_count,
    inv.max_uses      AS max_uses,
    EXISTS (
      SELECT 1 FROM public.coach_client_links l
      WHERE l.coach_id = inv.coach_id
        AND l.client_id = v_caller_id
        AND l.revoked_at IS NULL
        AND (l.expires_at IS NULL OR l.expires_at > now())
    )                  AS link_exists
  INTO v_inv
  FROM public.coach_invitations inv
  WHERE inv.code = code_input
  LIMIT 1;

  -- Single CASE chain (pure CPU; constant-time error classification).
  IF v_inv.id IS NULL THEN
    v_error := 'INVALID_CODE';
  ELSIF v_inv.coach_id = v_caller_id THEN
    v_error := 'SELF_INVITATION';
  ELSIF v_inv.revoked_at IS NOT NULL THEN
    v_error := 'REVOKED';
  ELSIF v_inv.expires_at <= now() THEN
    v_error := 'EXPIRED';
  ELSIF v_inv.use_count >= v_inv.max_uses THEN
    v_error := 'ALREADY_USED';
  ELSIF v_inv.link_exists THEN
    v_error := 'LINK_EXISTS';
  END IF;

  IF v_error IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'link_id', NULL, 'error_code', v_error);
  END IF;

  -- Happy path: atomic link insert + use_count increment.
  INSERT INTO public.coach_client_links (coach_id, client_id)
  VALUES (v_inv.coach_id, v_caller_id)
  RETURNING id INTO v_new_link_id;

  UPDATE public.coach_invitations
  SET use_count = use_count + 1,
      used_at   = COALESCE(used_at, now()),
      used_by   = COALESCE(used_by, v_caller_id)
  WHERE id = v_inv.id;

  RETURN jsonb_build_object('ok', true, 'link_id', v_new_link_id, 'error_code', NULL);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_invitation_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_invitation_code(TEXT) TO authenticated;

-- ───────────────────────────────────────────────────────────
-- 5. The 11 cross-user FOR SELECT policies (D-RLS-01)
--    Existing FOR ALL policies are UNCHANGED. Postgres OR-combines
--    permissive policies of the same command. Coaches gain SELECT
--    only; INSERT/UPDATE/DELETE still gated by the FOR ALL
--    USING (auth.uid() = user_id) policies.
-- ───────────────────────────────────────────────────────────

-- Direct user_id tables (10 of 11) — uniform pattern
CREATE POLICY "habits_coach_read" ON public.habits
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_coach_of(auth.uid(), user_id));

CREATE POLICY "habit_logs_coach_read" ON public.habit_logs
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_coach_of(auth.uid(), user_id));

CREATE POLICY "workout_sessions_coach_read" ON public.workout_sessions
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_coach_of(auth.uid(), user_id));

CREATE POLICY "body_measurements_coach_read" ON public.body_measurements
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_coach_of(auth.uid(), user_id));

CREATE POLICY "nutrition_logs_coach_read" ON public.nutrition_logs
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_coach_of(auth.uid(), user_id));

CREATE POLICY "sleep_logs_coach_read" ON public.sleep_logs
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_coach_of(auth.uid(), user_id));

CREATE POLICY "cardio_sessions_coach_read" ON public.cardio_sessions
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_coach_of(auth.uid(), user_id));

CREATE POLICY "hydration_logs_coach_read" ON public.hydration_logs
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_coach_of(auth.uid(), user_id));

CREATE POLICY "journal_entries_coach_read" ON public.journal_entries
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_coach_of(auth.uid(), user_id));

CREATE POLICY "stretching_logs_coach_read" ON public.stretching_logs
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_coach_of(auth.uid(), user_id));

-- Parent-chain table (1 of 11): session_sets has no user_id column
-- and inherits ownership from workout_sessions.user_id. The coach-read
-- policy mirrors the existing own_session_sets parent-chain shape.
CREATE POLICY "session_sets_coach_read" ON public.session_sets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_sessions ws
      WHERE ws.id = session_sets.session_id
        AND (auth.uid() = ws.user_id OR public.is_coach_of(auth.uid(), ws.user_id))
    )
  );

-- ───────────────────────────────────────────────────────────
-- End of migration 035.
-- ───────────────────────────────────────────────────────────
