-- ============================================================
-- Phase 45 (v1.18) - Non-Punitive Tiered Rewards (REWARD-03, REWARD-04, D-04, D-07)
-- Adds: public.ziko_athlete_rewards - rewards an athlete has been granted.
--
-- Monotonic by construction (D-07): there is NO UPDATE or DELETE policy and
-- no UPDATE/DELETE table grant for any client role, so a reward is never
-- revoked. UNIQUE (user_id, reward_id) guarantees a reward is granted at
-- most once. The only INSERT path is public.ziko_grant_reward() (next
-- migration, SECURITY DEFINER, service_role-only EXECUTE).
-- Files-only migration: applied by the orchestrator after user approval.
-- ============================================================

CREATE TABLE public.ziko_athlete_rewards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id   UUID NOT NULL REFERENCES public.ziko_reward_catalog(id),
  tier        INTEGER NOT NULL CHECK (tier >= 2),
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decision_id UUID REFERENCES public.ziko_athlete_decisions(id),
  CONSTRAINT ziko_athlete_rewards_user_reward_key UNIQUE (user_id, reward_id)
);

COMMENT ON TABLE public.ziko_athlete_rewards IS
  'Phase 45 D-04/D-07: rewards granted to an athlete. Insert only via public.ziko_grant_reward(); never updated or deleted (rewards are never revoked).';

CREATE INDEX ziko_idx_athlete_rewards_user_granted
  ON public.ziko_athlete_rewards (user_id, granted_at DESC);

ALTER TABLE public.ziko_athlete_rewards ENABLE ROW LEVEL SECURITY;

-- SELECT-only. The explicit FOR SELECT restriction is load-bearing: a policy
-- without it would also cover writes. No INSERT/UPDATE/DELETE policy exists.
CREATE POLICY "athlete_rewards_select_own" ON public.ziko_athlete_rewards
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "athlete_rewards_service_select" ON public.ziko_athlete_rewards
  AS PERMISSIVE FOR SELECT TO service_role
  USING (true);

REVOKE ALL ON TABLE public.ziko_athlete_rewards FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.ziko_athlete_rewards TO authenticated;
GRANT SELECT ON TABLE public.ziko_athlete_rewards TO service_role;

NOTIFY pgrst, 'reload schema';
