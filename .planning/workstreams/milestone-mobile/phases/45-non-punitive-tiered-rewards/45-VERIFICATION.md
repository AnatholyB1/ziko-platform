# Phase 45 Verification (goal-backward, vs 45-CONTEXT D-01..D-09)

Evidence level: code reading + real SQL execution on a throwaway local Postgres. vitest was not run (no node_modules in the audit worktree); builder test claims are therefore re-verified by reading, not by execution.

| Req | Verdict | Evidence |
|---|---|---|
| REWARD-01 points per outcome (D-01/D-02) | VERIFIED | computePointsOutcome: met 10, exceeded 15 at >=1.25x with epsilon, missed/no_target 0, never negative; constants in rewards.ts only; points ride the weekly ziko_record_athlete_decision patch (apply.ts ~L200). |
| REWARD-02 tiers (D-02/D-03) | VERIFIED | TIER_THRESHOLDS 50/150/300 -> tiers 1..4, tier 5 reserved (MAX_TIER 4); patch writes points+tier only, never level. |
| REWARD-03 tiered non-monetary rewards, AI selection (D-04/D-05/D-06) | PARTIAL | Catalog/rewards tables, seed (15), RLS and RPC verified live. Selection at temperature 0 with in-code validation and fallback verified by reading. Gaps: create_reward reachable through POST /ai/tools/execute (D-05 "not from chat" holds only for chat); one-reward-per-tier not DB-enforced (race reproduced). |
| REWARD-04 monotonic / never revoked (D-07) | VERIFIED | No UPDATE/DELETE grant or policy for any client role (proved); GREATEST ratchet proved; missed week leaves state unchanged. Caveat: the per-tier uniqueness race above is a duplicate-grant risk, not a revocation risk. |
| REWARD-05 surface (D-08) | HUMAN_NEEDED | Mobile overlay is out of scope for this backend part; apply.ts returns rewards[] for it. Copy "chosen for you by Ziko" must be checked in the Phase 46/mobile work. ANJ/JONUM legal review pending (CONTEXT). |

D-06 separate step: VERIFIED (grant after RPC, try/catch, owed tiers derived from state so retry is automatic; reward_grant index extended per (user,week,tier)).
D-09 migrations files only: VERIFIED (3 timestamped ziko_ files; not applied to any hosted DB by this audit).
Cost logging (SOURCES.rewardSelection, no credit gate): VERIFIED by reading.

Open items to close: add UNIQUE(user_id,tier) or row lock (MEDIUM); deny create_reward on /ai/tools/execute (MEDIUM); run the vitest suites in an environment with dependencies installed.
