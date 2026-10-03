-- ============================================================
-- Phase 44 — Weekly Adaptive Decision Engine (ENGINE-04, ENGINE-05, ENGINE-06)
-- Extends: public.record_athlete_decision() — adds p_new_goal (D-09) and
--          widens the review-clock stamp to onboarding_profile (D-02).
--
-- CRITICAL — overload hazard: CREATE OR REPLACE FUNCTION with a different
-- argument count creates a NEW overload rather than replacing the old one.
-- Every existing 9-named-param caller (backend/api/src/tools/onboarding.ts,
-- backend/api/src/tools/onboarding-retroactive.ts) would become ambiguous
-- if both a 9-arg and 10-arg record_athlete_decision existed. The explicit
-- DROP FUNCTION below removes the 9-arg signature before the 10-arg
-- CREATE OR REPLACE runs (T-44-05).
-- ============================================================

DROP FUNCTION IF EXISTS public.record_athlete_decision(UUID, TEXT, DATE, TEXT, TEXT, JSONB, JSONB, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.record_athlete_decision(
  p_user_id       UUID,
  p_decision_type TEXT,
  p_week_of       DATE,
  p_summary       TEXT,
  p_rationale     TEXT,
  p_evidence      JSONB,
  p_outcome       JSONB,
  p_source        TEXT,
  p_state_patch   JSONB,
  p_new_goal      JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_decision_id UUID;
  v_goal_id     UUID;
  v_rows        INTEGER;
BEGIN
  -- (a) Guard first, before touching any table. Return an error-shaped
  -- JSONB, never RAISE EXCEPTION — matching grant_premium_credits's
  -- invalid_amount guard. FOUND-02: an ungrounded decision is unwritable.
  IF p_evidence IS NULL OR jsonb_typeof(p_evidence) <> 'object' THEN
    RETURN jsonb_build_object('success', false, 'error', 'evidence_required');
  END IF;

  -- (b) Journal insert. ON CONFLICT column list and predicate must match
  -- idx_athlete_decisions_week_idempotency character-for-character
  -- (20260831120100_athlete_decisions.sql) or Postgres cannot infer the
  -- arbiter index.
  INSERT INTO public.athlete_decisions
    (user_id, decision_type, week_of, summary, rationale, evidence, outcome, source)
  VALUES (
    p_user_id, p_decision_type, p_week_of, p_summary, p_rationale, p_evidence,
    COALESCE(p_outcome, '{}'::jsonb), COALESCE(p_source, 'weekly_review_cron')
  )
  ON CONFLICT (user_id, decision_type, week_of)
    WHERE decision_type = 'weekly_focus' AND week_of IS NOT NULL DO NOTHING
  RETURNING id INTO v_decision_id;

  -- (c) Duplicate detection. Zero rows affected means this athlete already
  -- has a weekly_focus decision recorded for this week — return immediately,
  -- before the goal insert or state patch is applied. This early return is
  -- the entire idempotency guarantee (ENGINE-04): moving either below it
  -- would silently re-apply the patch (or create an orphan goal row) on
  -- every at-least-once cron retry.
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'duplicate');
  END IF;

  -- (NEW, D-09) Insert athlete_goals BEFORE the state patch, inside the
  -- same transaction, so current_focus_detail.goal_id can reference the
  -- real row atomically rather than a placeholder.
  IF p_new_goal IS NOT NULL THEN
    INSERT INTO public.athlete_goals (user_id, goal_text, target_metric, target_value, target_date, status)
    VALUES (
      p_user_id,
      p_new_goal->>'goal_text',
      p_new_goal->>'target_metric',
      (p_new_goal->>'target_value')::numeric,
      (p_new_goal->>'target_date')::date,
      COALESCE(p_new_goal->>'status', 'active')
    )
    RETURNING id INTO v_goal_id;
  END IF;

  -- (d) Self-heal the parent row: the first-ever decision for an athlete
  -- (Phase 43 onboarding) creates athlete_state with schema defaults
  -- (readiness='fragile', level=1, tier=1, points=0, status='onboarding')
  -- before the UPDATE below patches it.
  INSERT INTO public.athlete_state (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- (e) Patch the state row. p_state_patch accepts any subset of the
  -- recognised keys below; an absent key leaves the column unchanged
  -- (COALESCE against the current column value).
  UPDATE public.athlete_state
  SET
    -- level: plain COALESCE, deliberately NOT ratcheted. ENGINE-03
    -- explicitly requires Phase 44's weekly engine to be able to
    -- de-escalate as well as escalate, so level must remain freely
    -- settable; the `level >= 1` CHECK on the column is the floor.
    level = COALESCE((p_state_patch->>'level')::int, level),

    -- points/tier: monotonic ratchet via GREATEST. REWARD-04 requires
    -- unlocked tiers/points to never be revoked or decreased, and this
    -- RPC is the only place that invariant can be enforced at the DB
    -- layer (research/PITFALLS.md Pitfall 5 — a buggy caller passing a
    -- lower value must not silently decrease either field).
    points = GREATEST(points, COALESCE((p_state_patch->>'points')::int, points)),
    tier   = GREATEST(tier, COALESCE((p_state_patch->>'tier')::int, tier)),

    readiness              = COALESCE(p_state_patch->>'readiness', readiness),
    status                 = COALESCE(p_state_patch->>'status', status),
    current_focus_summary  = COALESCE(p_state_patch->>'current_focus_summary', current_focus_summary),
    -- JSONB-valued keys use the `->` arrow (not `->>`) to preserve the
    -- JSONB type rather than casting to text. Delta 1 (D-09): fold in the
    -- real goal id instead of relying on a caller-supplied placeholder —
    -- callers never pass a $NEW_GOAL_ID marker; they pass the merged
    -- detail object without goal_id and this RPC stamps the real id
    -- atomically once the athlete_goals row above exists.
    current_focus_detail   = COALESCE(p_state_patch->'current_focus_detail', current_focus_detail)
                              || CASE WHEN v_goal_id IS NOT NULL
                                   THEN jsonb_build_object('goal_id', v_goal_id)
                                   ELSE '{}'::jsonb
                                 END,
    onboarding_profile     = COALESCE(p_state_patch->'onboarding_profile', onboarding_profile),
    rolling_summary        = COALESCE(p_state_patch->>'rolling_summary', rolling_summary),

    -- last_review_at/next_review_due_at: last_review_at keeps its current
    -- weekly_focus-only behaviour unchanged. Delta 2 (D-02/Pitfall-4 fix):
    -- next_review_due_at now ALSO stamps on 'onboarding_profile', so the
    -- cadence rolls from the athlete's onboarding completion date instead
    -- of only after the second-ever decision. goal_created, program_created,
    -- reward_grant and level_change must NOT move the clock.
    last_review_at     = CASE WHEN p_decision_type = 'weekly_focus' THEN NOW() ELSE last_review_at END,
    next_review_due_at = CASE WHEN p_decision_type IN ('weekly_focus', 'onboarding_profile') THEN NOW() + INTERVAL '7 days' ELSE next_review_due_at END,

    -- Belt-and-braces alongside trg_athlete_state_updated.
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- (f) Success.
  RETURN jsonb_build_object('success', true, 'decision_id', v_decision_id, 'goal_id', v_goal_id);
END;
$$;

COMMENT ON FUNCTION public.record_athlete_decision(UUID, TEXT, DATE, TEXT, TEXT, JSONB, JSONB, TEXT, JSONB, JSONB) IS
  'The one and only write path to public.athlete_state, public.athlete_decisions, and public.athlete_goals (FOUND-03, FOUND-04, D-09). '
  'p_state_patch accepts any subset of these recognised keys — an absent key leaves the column unchanged — so '
  'Phase 43+ callers never need this migration touched again: level, points, tier, readiness, status, '
  'current_focus_summary, current_focus_detail, onboarding_profile, rolling_summary. '
  'The first call for a new athlete self-creates the athlete_state row with schema defaults '
  '(readiness=''fragile'', level=1, tier=1, points=0, status=''onboarding'') before applying the patch. '
  'points and tier are ratcheted via GREATEST(current, incoming) and can never be decreased through this RPC '
  '(REWARD-04); level has no such guard and remains freely settable both up and down (ENGINE-03). '
  'p_evidence is required (NULL or non-object is rejected with error ''evidence_required'') and must carry the '
  'real activity data the decision was based on — the schema can require its presence but cannot verify its '
  'truthfulness; that verification is a Phase 43+ tool-executor code-review obligation. '
  'p_new_goal (Phase 44, ENGINE-06/D-09) optionally creates a public.athlete_goals row atomically in the same '
  'transaction and stamps its real id into current_focus_detail.goal_id — callers never pass a placeholder id. '
  'next_review_due_at now advances on both weekly_focus and onboarding_profile decisions (Phase 44, ENGINE-04/D-02), '
  'so the weekly review cadence rolls from the athlete''s onboarding completion date.';

-- ── Function EXECUTE lockdown ──────────────────────────────────────────
-- Every role named explicitly (a bare REVOKE ... FROM PUBLIC is proven
-- insufficient on this project — see 20260831120200_athlete_decisions_rpc.sql
-- header comment). Re-asserted explicitly on the NEW 10-type signature (T-44-02).
REVOKE EXECUTE ON FUNCTION public.record_athlete_decision(UUID, TEXT, DATE, TEXT, TEXT, JSONB, JSONB, TEXT, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_athlete_decision(UUID, TEXT, DATE, TEXT, TEXT, JSONB, JSONB, TEXT, JSONB, JSONB) TO service_role;

-- Reload PostgREST's schema cache immediately so it picks up the changed
-- function signature without waiting for its own cache TTL.
NOTIFY pgrst, 'reload schema';
