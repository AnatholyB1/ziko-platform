# Phase 45 Security Audit

Method: the 3 migrations were executed for real on a throwaway local PostgreSQL 18.6 (127.0.0.1:54405, temp data dir, now destroyed; no hosted DB touched). Prerequisites: auth.users/auth.uid()/roles stubbed; the real 20261001101852 schema applied clean (0 errors); the real ziko_record_athlete_decision function extracted from 20261001101853 (the full functions file needs pg_net). Machine lock was taken for the run (it was already absent when I went to release it; another actor may have removed it).

## Proven
- All 3 migrations apply without error; catalog seed = 15 rows (5 each for tiers 2-4); the new unique indexes exist.
- ziko_grant_reward: first call success (tier 2, then tier 3); identical second call -> `already_granted` (no new rows; counts stayed 2 rewards / 2 decisions); different reward, same tier, other week -> `already_granted`; tier above state -> `tier_not_reached` with no decision row; unknown id -> `unknown_reward`.
- Direct duplicate reward_grant decision for same (user,week,tier) -> unique violation on ziko_idx_athlete_decisions_reward_grant_idempotency.
- RLS / grants: authenticated can SELECT only own rewards (other user sees 0) and the active catalog; INSERT/UPDATE/DELETE on rewards and catalog, and EXECUTE of ziko_grant_reward, all "permission denied" for authenticated and anon. service_role: direct INSERT/UPDATE/DELETE on rewards and INSERT on catalog denied; EXECUTE on the RPC allowed; a second RPC call is a no-op. No client self-grant or revoke path.
- Function: SECURITY DEFINER, search_path=public,pg_temp, ACL = postgres + service_role only.
- Monotonic: ziko_record_athlete_decision with {tier:1,points:5} left tier 4 / points 160 unchanged (GREATEST ratchet).

## Findings
MEDIUM | 20261107100200:70 | one-reward-per-tier race (see 45-REVIEW.md, reproduced 1/60). Integrity, not privilege escalation.
MEDIUM | routes/ai.ts:172-190 + registry.ts:193 | create_reward executable by any authenticated athlete through POST /ai/tools/execute (not chat). Bounded to owed tiers; fix with an internal-only deny-list.
LOW | grant function raises unique_violation (not error-shaped JSONB) if the same reward is inserted concurrently, contradicting the house convention; the TS caller treats it as a thrown error and retries next cycle.
LOW | p_source is passed to the decision CHECK; a bad value would raise. TS normaliseSource clamps it, so only reachable by a direct service-role caller.
LOW | ziko_athlete_rewards.reward_id FK has no ON DELETE; catalog row deletion is blocked while owned (acceptable, matches never-revoke).

## Prompt injection / id validation
Model prompt contains only catalog-controlled strings (uuid, kind, key); no athlete free text. The model answer is a bare string validated by pool membership in code (resolveSelection) with a deterministic fallback; the RPC re-validates the id (active, tier reached, unowned). Clean.
