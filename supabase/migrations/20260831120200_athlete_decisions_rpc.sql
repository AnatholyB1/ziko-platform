-- ============================================================
-- Phase 42 — Decision-System Foundation (FOUND-02, FOUND-03, FOUND-04)
-- Adds: public.record_athlete_decision() — the ONE AND ONLY write path
--       to public.athlete_state and public.athlete_decisions.
--
-- D-06/D-07 intent: this RPC is the sole code path capable of writing
-- either table, including from backend code holding the service-role
-- key. That claim is enforced below at the Postgres GRANT layer, not
-- left as a code-review convention — see the table-level lockdown at
-- the bottom of this file, which revokes INSERT/UPDATE/DELETE from
-- BOTH `authenticated` AND `service_role` on both tables.
--
-- REVOKE FROM PUBLIC alone is NOT sufficient on this project: ALTER DEFAULT
-- PRIVILEGES for schema public grants EXECUTE to anon/authenticated/service_role
-- directly at CREATE FUNCTION time (verified live — this also affects
-- is_coach_of() / redeem_invitation_code() / peek_invitation(), a pre-existing
-- gap outside this phase's scope, and is independently confirmed by
-- 20260813182644_waitlist_founder_offer.sql and 20260818190601_premium_credit_grant.sql).
-- PUBLIC-only revoke never touches an already-materialized per-role grant, so
-- every role must be revoked explicitly, by name, on every new function.
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_athlete_decision(
  p_user_id       UUID,
  p_decision_type TEXT,
  p_week_of       DATE,
  p_summary       TEXT,
  p_rationale     TEXT,
  p_evidence      JSONB,
  p_outcome       JSONB,
  p_source        TEXT,
  p_state_patch   JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_decision_id UUID;
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
  -- before the state patch is applied. This early return is the entire
  -- idempotency guarantee (ENGINE-04): moving the state UPDATE above it
  -- would silently re-apply the patch on every at-least-once cron retry.
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'duplicate');
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
    -- JSONB type rather than casting to text.
    current_focus_detail   = COALESCE(p_state_patch->'current_focus_detail', current_focus_detail),
    onboarding_profile     = COALESCE(p_state_patch->'onboarding_profile', onboarding_profile),
    rolling_summary        = COALESCE(p_state_patch->>'rolling_summary', rolling_summary),

    -- last_review_at/next_review_due_at only advance for weekly reviews —
    -- an onboarding or reward-grant decision must not silently reset the
    -- weekly review clock.
    last_review_at     = CASE WHEN p_decision_type = 'weekly_focus' THEN NOW() ELSE last_review_at END,
    next_review_due_at = CASE WHEN p_decision_type = 'weekly_focus' THEN NOW() + INTERVAL '7 days' ELSE next_review_due_at END,

    -- Belt-and-braces alongside trg_athlete_state_updated.
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- (f) Success.
  RETURN jsonb_build_object('success', true, 'decision_id', v_decision_id);
END;
$$;

COMMENT ON FUNCTION public.record_athlete_decision(UUID, TEXT, DATE, TEXT, TEXT, JSONB, JSONB, TEXT, JSONB) IS
  'The one and only write path to public.athlete_state and public.athlete_decisions (FOUND-03, FOUND-04). '
  'p_state_patch accepts any subset of these recognised keys — an absent key leaves the column unchanged — so '
  'Phase 43+ callers never need this migration touched again: level, points, tier, readiness, status, '
  'current_focus_summary, current_focus_detail, onboarding_profile, rolling_summary. '
  'The first call for a new athlete self-creates the athlete_state row with schema defaults '
  '(readiness=''fragile'', level=1, tier=1, points=0, status=''onboarding'') before applying the patch. '
  'points and tier are ratcheted via GREATEST(current, incoming) and can never be decreased through this RPC '
  '(REWARD-04); level has no such guard and remains freely settable both up and down (ENGINE-03). '
  'p_evidence is required (NULL or non-object is rejected with error ''evidence_required'') and must carry the '
  'real activity data the decision was based on — the schema can require its presence but cannot verify its '
  'truthfulness; that verification is a Phase 43+ tool-executor code-review obligation.';

-- ── Function EXECUTE lockdown ──────────────────────────────────────────
-- Every role named explicitly (a bare REVOKE ... FROM PUBLIC is proven
-- insufficient on this project — see header comment above).
REVOKE EXECUTE ON FUNCTION public.record_athlete_decision(UUID, TEXT, DATE, TEXT, TEXT, JSONB, JSONB, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_athlete_decision(UUID, TEXT, DATE, TEXT, TEXT, JSONB, JSONB, TEXT, JSONB) TO service_role;

-- ── Lock down every direct write path (D-06/D-07) ──────────────────────
-- SECURITY DEFINER functions run as the function owner and are therefore
-- unaffected by these revocations — record_athlete_decision() keeps
-- working after this runs.
--
-- D-06 names UPDATE on athlete_state and INSERT on athlete_decisions as
-- the required minimum; this migration revokes all three write verbs on
-- BOTH tables because D-06's stated purpose is that record_athlete_decision()
-- be "the only code path capable of writing either table" and D-07 forbids
-- any carve-out (e.g. a future manual/admin correction tool must also call
-- this RPC — via source = 'manual_admin' — never bypass it).
--
-- SELECT is deliberately NOT revoked here: the RLS SELECT-own policies from
-- plan 42-01 are the read-scoping layer and must keep working, and
-- service_role needs SELECT for Phase 46's gating reader and Phase 47's
-- context query.
REVOKE INSERT, UPDATE, DELETE ON public.athlete_state FROM authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE ON public.athlete_decisions FROM authenticated, service_role;
