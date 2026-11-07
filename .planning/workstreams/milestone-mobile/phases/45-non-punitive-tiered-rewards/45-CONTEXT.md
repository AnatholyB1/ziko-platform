# Phase 45 CONTEXT - Non-Punitive Tiered Rewards (decisions locked 2026-11-07)
Reqs REWARD-01..05. Decisions (user-approved, recommended options):
- D-01 exceeded = actual >= 1.25 x target (constant EXCEEDED_MARGIN); met stays `actual >= target` (44 D-07), no tolerance for missing.
- D-02 points: met=10, exceeded=15, missed=0 (never negative); tier thresholds ~50/150/300 => tiers 1..4 (5 reserved), all constants in one config module.
- D-03 Phase 45 writes ONLY points+tier via record_athlete_decision v2 (GREATEST-ratcheted in DB). It does NOT write `level`; level is derived from tier on the read side (Phase 46).
- D-04 Rewards are non-monetary (badges/titles/themes), no resale value, no chance mechanic. New tables `ziko_reward_catalog` (tier, key, fr/en labels, sort_order, active, seed) and `ziko_athlete_rewards` (user_id, reward_id, tier, granted_at, decision_id; UNIQUE(user_id,reward_id); SELECT-only RLS, no UPDATE/DELETE policy). Separate from gamification coins/shop.
- D-05 Selection: `create_reward` tool (executor + schema in coachingEngineToolSchemas, registered in registry.ts) - AI (temperature 0) picks one reward_id from the tier's eligible unowned pool; code validates id in pool and unowned; invalid output => deterministic fallback = first unowned by sort_order. Cost logged via lib/autonomousCost.ts with SOURCES.reward_selection (no credit gate).
- D-06 Grant is a separate step AFTER the weekly decision (distinct `reward_grant` decision, same weekOf idempotency anchor; extend unique index if needed) so an LLM failure never loses the weekly decision and is retryable. Tier-up triggers the grant.
- D-07 Monotonic: tier/reward never revoked or downgraded even after a missed week.
- D-08 Surface: extend WeeklyReviewRevealOverlay (points earned, tier-up, reward reveal) only; no dedicated screen. Copy must say the reward is "chosen for you by Ziko" without implying luck.
- D-09 Migrations are FILES ONLY (new timestamped files, `ziko_` prefix); applied by orchestrator after user approval.
- Legal: ANJ/JONUM counsel review before broad release (DEPLOY-CHECKLIST).
Canonical refs: 44-CONTEXT.md, backend/api/src/coaching-engine/{apply,tools,types}.ts, tools/registry.ts, lib/autonomousCost.ts, REQUIREMENTS.md REWARD-*.
