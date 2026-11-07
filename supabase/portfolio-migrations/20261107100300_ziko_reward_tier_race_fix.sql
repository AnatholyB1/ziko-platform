-- ============================================================
-- Phase 45 audit fix - close the one-reward-per-tier race (45-REVIEW MEDIUM).
--
-- The previous ziko_grant_reward() enforced "one reward per tier" with a
-- read-then-insert EXISTS check, so two parallel grants (cron + app-open
-- fallback, different week_of keys) could both pass it and insert two
-- different rewards for one tier.
--
-- Fix, defence in depth:
--   1. UNIQUE (user_id, tier) on ziko_athlete_rewards (hard DB invariant).
--   2. ziko_grant_reward() takes a row lock on the athlete's
--      ziko_athlete_state row (FOR UPDATE) so concurrent grants for one
--      athlete serialise; the loser then sees the committed reward and
--      returns already_granted.
--   3. unique_violation (from either constraint) is mapped to an
--      error-shaped JSONB {success:false,error:'already_granted'} instead of
--      raising (house convention).
--
-- Pre-existing rows: ziko_athlete_rewards is introduced by the (files-only,
-- not yet applied) Phase 45 migrations, so the table is fresh and no dedupe
-- is needed. If it were ever applied and populated with the race having
-- fired, ADD CONSTRAINT would fail loudly rather than silently delete a
-- granted reward (rewards are never revoked, D-07).
-- Files-only migration: applied by the orchestrator after user approval.
-- ============================================================

ALTER TABLE public.ziko_athlete_rewards
  ADD CONSTRAINT ziko_athlete_rewards_user_tier_key UNIQUE (user_id, tier);

CREATE OR REPLACE FUNCTION public.ziko_grant_reward(
  p_user_id   UUID,
  p_reward_id UUID,
  p_week_of   DATE,
  p_summary   TEXT,
  p_rationale TEXT,
  p_evidence  JSONB,
  p_source    TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reward      RECORD;
  v_state_tier  INTEGER;
  v_decision_id UUID;
  v_rows        INTEGER;
BEGIN
  IF p_evidence IS NULL OR jsonb_typeof(p_evidence) <> 'object' THEN
    RETURN jsonb_build_object('success', false, 'error', 'evidence_required');
  END IF;

  IF p_week_of IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'week_of_required');
  END IF;

  SELECT id, tier, key INTO v_reward
  FROM public.ziko_reward_catalog
  WHERE id = p_reward_id AND active;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'unknown_reward');
  END IF;

  -- Serialise concurrent grants for one athlete: lock the state row. A
  -- parallel call blocks here until this transaction commits, then re-reads
  -- committed rewards below (READ COMMITTED sees them).
  SELECT tier INTO v_state_tier
  FROM public.ziko_athlete_state
  WHERE user_id = p_user_id
  FOR UPDATE;
  IF v_state_tier IS NULL OR v_reward.tier > v_state_tier THEN
    RETURN jsonb_build_object('success', false, 'error', 'tier_not_reached');
  END IF;

  -- One reward per tier, and never the same reward twice.
  IF EXISTS (
    SELECT 1 FROM public.ziko_athlete_rewards
    WHERE user_id = p_user_id AND (reward_id = p_reward_id OR tier = v_reward.tier)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_granted');
  END IF;

  BEGIN
    INSERT INTO public.ziko_athlete_decisions
      (user_id, decision_type, week_of, summary, rationale, evidence, outcome, source)
    VALUES (
      p_user_id, 'reward_grant', p_week_of, p_summary, COALESCE(p_rationale, ''), p_evidence,
      jsonb_build_object('tier', v_reward.tier, 'reward_id', v_reward.id, 'reward_key', v_reward.key),
      COALESCE(p_source, 'weekly_review_cron')
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_decision_id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'duplicate');
    END IF;

    INSERT INTO public.ziko_athlete_rewards (user_id, reward_id, tier, decision_id)
    VALUES (p_user_id, v_reward.id, v_reward.tier, v_decision_id);
  EXCEPTION WHEN unique_violation THEN
    -- Sub-transaction rollback also discards the decision row inserted above.
    RETURN jsonb_build_object('success', false, 'error', 'already_granted');
  END;

  RETURN jsonb_build_object(
    'success', true,
    'decision_id', v_decision_id,
    'reward_id', v_reward.id,
    'tier', v_reward.tier
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ziko_grant_reward(UUID, UUID, DATE, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ziko_grant_reward(UUID, UUID, DATE, TEXT, TEXT, JSONB, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
