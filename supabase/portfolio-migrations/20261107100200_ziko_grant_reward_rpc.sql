-- ============================================================
-- Phase 45 (v1.18) - Non-Punitive Tiered Rewards (REWARD-03, REWARD-04, D-06, D-07)
-- Adds: public.ziko_grant_reward() - the service-role-only write path for
--       ziko_athlete_rewards, plus the reward_grant idempotency index.
--
-- D-06: the grant is a separate step AFTER the weekly decision, journalled as
-- its own 'reward_grant' decision (already allowed by the decision_type
-- CHECK; source reuses the existing allowed values), so an LLM failure never
-- loses the weekly decision and the grant can be retried safely.
--
-- This function writes ONLY ziko_athlete_decisions + ziko_athlete_rewards.
-- It never touches ziko_athlete_state: points/tier are written by the weekly
-- ziko_record_athlete_decision() patch (GREATEST-ratcheted), level is never
-- written by Phase 45 (D-03).
--
-- Error-shaped JSONB returns, never RAISE (house convention). All early
-- returns happen BEFORE any insert, so a refused grant leaves no orphan
-- decision row.
-- Files-only migration: applied by the orchestrator after user approval.
-- ============================================================

-- Idempotency anchor for reward_grant decisions: one grant decision per
-- (athlete, week, tier). Extends the weekly_focus index pattern; the
-- weekly_focus index itself is untouched.
CREATE UNIQUE INDEX ziko_idx_athlete_decisions_reward_grant_idempotency
  ON public.ziko_athlete_decisions (user_id, week_of, ((outcome->>'tier')))
  WHERE decision_type = 'reward_grant' AND week_of IS NOT NULL;

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

  -- A reward can only be granted for a tier the athlete has actually reached.
  SELECT tier INTO v_state_tier FROM public.ziko_athlete_state WHERE user_id = p_user_id;
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

  RETURN jsonb_build_object(
    'success', true,
    'decision_id', v_decision_id,
    'reward_id', v_reward.id,
    'tier', v_reward.tier
  );
END;
$$;

COMMENT ON FUNCTION public.ziko_grant_reward(UUID, UUID, DATE, TEXT, TEXT, JSONB, TEXT) IS
  'Phase 45: the only write path to ziko_athlete_rewards. Journals a reward_grant decision and inserts the reward atomically; idempotent per (user, week, tier) and per reward; never touches ziko_athlete_state. service_role EXECUTE only.';

REVOKE ALL ON FUNCTION public.ziko_grant_reward(UUID, UUID, DATE, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ziko_grant_reward(UUID, UUID, DATE, TEXT, TEXT, JSONB, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
