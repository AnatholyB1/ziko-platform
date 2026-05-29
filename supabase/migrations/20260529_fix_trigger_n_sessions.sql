-- ============================================================
-- 20260529 — Fix create_form_instances_for_trigger n_sessions key
--
-- Problem: Migration 058 reads `trigger_config->>'n'` in the
-- after_n_sessions CASE branch. TriggerConfig.tsx writes
-- `{ n_sessions: N }` — the key 'n' does not exist; the comparison
-- always fails and no form instances are ever created for
-- after_n_sessions triggers.
--
-- Fix: CREATE OR REPLACE FUNCTION replacing the function body from
-- migration 058 with the single change:
--   trigger_config->>'n'  →  trigger_config->>'n_sessions'
--
-- Data note: existing DB rows already store `n_sessions` as the key.
-- This is a read-side fix only — no data migration needed.
--
-- Idempotent: CREATE OR REPLACE is safe to re-run.
-- ============================================================

SET LOCAL lock_timeout = '5s';

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
            -- after_n_sessions: form's 'n_sessions' must equal the session count
            WHEN 'after_n_sessions' THEN
              (trigger_config->>'n_sessions')::integer = p_n_sessions
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
-- Permissions — identical to migration 058
-- ───────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.create_form_instances_for_trigger(text, uuid, uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_form_instances_for_trigger(text, uuid, uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_form_instances_for_trigger(text, uuid, uuid, integer, text) TO service_role;

-- End of migration 20260529.
