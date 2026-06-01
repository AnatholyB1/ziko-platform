-- ============================================================
-- 058 — Form Trigger Engine (workstream formulaire-condi, Phase 02)
-- Adds:
--   1. create_form_instances_for_trigger — SECURITY DEFINER function
--      Shared engine for all 4 trigger types. Called via supabase.rpc()
--      from Hono without a user JWT. Bypasses the form_instances_insert
--      RLS policy (which requires auth.uid() = coach_id) by running as
--      the function owner (postgres role).
-- Grants:
--   EXECUTE to authenticated (supabase.rpc() calls from SDK)
--   EXECUTE to service_role (direct backend calls)
-- ============================================================

SET LOCAL lock_timeout = '5s';

-- ───────────────────────────────────────────────────────────
-- 1. create_form_instances_for_trigger
--
-- Parameters:
--   p_trigger_type  text     — one of: first_contact, after_n_sessions,
--                              fixed_date, manual
--   p_athlete_id    uuid     — the athlete to assign forms to
--   p_coach_id      uuid     — the coach whose active forms are queried
--   p_n_sessions    integer  — required for after_n_sessions type
--   p_date          text     — ISO date (YYYY-MM-DD) for fixed_date type
--
-- Returns: count of form_instances rows actually inserted.
--          Returns 0 when ON CONFLICT fires (duplicate pending guard).
--
-- Security model:
--   SECURITY DEFINER — runs as function owner, bypasses RLS.
--   Business rules enforced internally:
--     - coach_id = p_coach_id (prevents cross-coach escalation, T-02-01)
--     - status = 'active' (draft/archived forms never triggered)
--     - trigger_config->>'type' = p_trigger_type (correct trigger match)
--   ON CONFLICT DO NOTHING on form_instances_no_dup_pending index
--   ensures idempotency (T-02-02).
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_form_instances_for_trigger(
  p_trigger_type text,
  p_athlete_id   uuid,
  p_coach_id     uuid,
  p_n_sessions   integer DEFAULT NULL,
  p_date         text    DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form     RECORD;
  v_count    integer := 0;
  v_inserted integer;
BEGIN
  -- Iterate over every active form owned by p_coach_id that matches
  -- the requested trigger type and any type-specific filter.
  FOR v_form IN
    SELECT id
    FROM public.coach_forms
    WHERE coach_id = p_coach_id
      AND status = 'active'
      AND trigger_config->>'type' = p_trigger_type
      AND CASE p_trigger_type
            -- after_n_sessions: form's 'n' must equal the session count
            WHEN 'after_n_sessions' THEN
              (trigger_config->>'n')::integer = p_n_sessions
            -- fixed_date: form's date must be <= today (handles past-due)
            WHEN 'fixed_date' THEN
              trigger_config->>'date' <= p_date
            -- first_contact, manual: no extra filter beyond type match
            ELSE TRUE
          END
  LOOP
    -- Insert one pending instance per matching form.
    -- ON CONFLICT silently skips if a pending instance already exists
    -- for this (form_id, athlete_id) pair (TRIGGER-05 / D-09 guard).
    INSERT INTO public.form_instances(form_id, athlete_id, status)
    VALUES (v_form.id, p_athlete_id, 'pending')
    ON CONFLICT ON CONSTRAINT form_instances_no_dup_pending DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    v_count := v_count + v_inserted;
  END LOOP;

  RETURN v_count;

EXCEPTION WHEN OTHERS THEN
  -- Log the error with context then re-raise so the caller sees the
  -- failure. Using WARNING so it appears in Supabase logs without
  -- aborting the transaction at the RAISE level.
  RAISE WARNING '[create_form_instances_for_trigger] error for trigger_type=%, athlete=%, coach=%: %',
    p_trigger_type, p_athlete_id, p_coach_id, SQLERRM;
  RAISE;
END;
$$;

-- ───────────────────────────────────────────────────────────
-- 2. Permissions
--    Revoke default PUBLIC execute, then grant explicitly to the
--    two roles that need to call this function:
--      authenticated — SDK callers via supabase.rpc() with a JWT
--      service_role  — direct backend / cron callers (no JWT)
-- ───────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.create_form_instances_for_trigger(text, uuid, uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_form_instances_for_trigger(text, uuid, uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_form_instances_for_trigger(text, uuid, uuid, integer, text) TO service_role;

-- End of migration 058.
