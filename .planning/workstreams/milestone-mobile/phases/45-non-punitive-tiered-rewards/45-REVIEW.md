# Phase 45 Code Review (audit/phase-45, base milestone/v1.18)

Scope: coaching-engine/{rewards,apply,tools,types}.ts, tools/registry.ts, lib/autonomousCost.ts, test/tools/rewards.spec.ts, test/rls/athlete-rewards.spec.ts.
Limitation: backend/api has no node_modules in the audit worktree, so vitest was NOT executed. Findings come from reading plus real SQL execution (see 45-SECURITY.md).

## Findings

MEDIUM | supabase/portfolio-migrations/20261107100200_ziko_grant_reward_rpc.sql:70 + 20261107100100_ziko_athlete_rewards.sql:20 | "One reward per tier" is enforced only by a read-then-insert EXISTS check; the only DB constraints are UNIQUE(user_id,reward_id) and the per-(user,week,tier) decision index. Cron + app-open fallback (different week_of keys) or two parallel calls both pass the check and insert two different rewards for one tier. Reproduced: 60 athletes, 2 parallel grants each (different week, different reward) -> 1 athlete ended with 2 rewards for tier 2 (61 reward_grant decisions for 60 users). | Add UNIQUE(user_id,tier) on ziko_athlete_rewards (new migration) and/or `SELECT ... FROM ziko_athlete_state WHERE user_id=p_user_id FOR UPDATE` at the top of the function; map unique_violation to {success:false,error:'already_granted'} instead of letting it raise.

MEDIUM | backend/api/src/tools/registry.ts:193 + routes/ai.ts:172-190 | create_reward is "not reachable from chat" only for the schema list; POST /ai/tools/execute resolves any name through getToolExecutor, so any authenticated athlete can invoke create_reward with chosen week_of/source. Bounded (re-reads state, tier<=state tier, unowned only, so at most one LLM call per owed tier) but contradicts the D-05 / registry-comment invariant, and the spec test only asserts allToolSchemas. | Deny-list executor-only tools in /tools/execute (e.g. a Set of INTERNAL_ONLY = assess_profile, create_reward) and add a route test.

LOW | apply.ts:295-298 | runRewardGrantStep accumulates results in a local array; if tier N+1 throws after tier N was granted, the catch in applyWeeklyDecision discards the successful grants from the return value (reveal data for the overlay lost; the DB state is fine). | Catch per tier inside the loop and push {granted:false,reason} for the failing one.
LOW | tools.ts:~233 | week_of regex accepts impossible dates ('2026-13-45'); Postgres raises on the DATE cast -> thrown 500 via /tools/execute. | Validate with Date round-trip.
LOW | rewards.ts:168 | single-entry pool skips the model and reports via:'fallback' (fine) but evidence `selected_via` then reads 'fallback' even though no choice existed; cosmetic.
LOW | rewards.ts nextRewardState | `tier: Math.max(prevTier, tier)` is redundant (tier already max'd). Cosmetic.
LOW | rewards.ts selectReward | cost is logged only on a successful model response; a parsed-but-rejected answer is logged, a thrown error after provider billing is not. Negligible.
LOW | test/tools/rewards.spec.ts "concurrent double fire" | uses mocks, so it cannot catch the real race above; RLS spec is skipped without a DB.

## Clean
Points never negative, tier clamp 1..4, exceeded boundary with epsilon, owedTiers excludes tier 1, no credit gate in reward modules, level never written (D-03), grant is after the weekly RPC and wrapped in try/catch (D-06), user id always taken from the auth argument, evidence built from backend state not model output, logAutonomousCost is fire-and-forget and never throws.
