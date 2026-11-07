# DEPLOY-CHECKLIST v1.18 (AI Coach Core) - nothing below is applied yet

## Migrations (files only, apply after user approval, in order) - supabase/portfolio-migrations/
- [ ] 20261107100000_ziko_reward_catalog.sql (+15 seed rows)
- [ ] 20261107100100_ziko_athlete_rewards.sql
- [ ] 20261107100200_ziko_grant_reward_rpc.sql
- [ ] 20261107100300_ziko_reward_tier_race_fix.sql (UNIQUE(user_id,tier) + FOR UPDATE; verified on throwaway PG: 60 athletes x2 parallel => 0 duplicates)
Run the live specs (test/rls/athlete-rewards.spec.ts etc.) only after apply, against the target project.

## Legal / release
- [ ] ANJ/JONUM counsel review of tiered rewards before broad release (deterministic, non-monetary, no chance mechanic; copy "choisie pour toi par Ziko")
- [ ] Release copy: existing athletes are re-locked to tier 1 on upgrade (installs above tier 1 unregistered, data kept)

## Known limits
- Phase 46 gating is client-side only. Not enforced server-side: POST /plugins/:id/install, PATCH /plugins/:id/toggle, AI tool exposure, /ai/programs/generate, direct ziko_user_plugins upserts. Future phase if levels must be authoritative.
- Push (47b) uses category `coach`, type `ai_weekly_analysis`; per-type toggle is not honoured by notificationService (category toggle + quiet hours only).
- Plugin code imported outside (plugins) routes (ai/index.tsx -> community, workout/session.tsx -> gamification) is not route-guarded.

## Env / secrets
- No new env var introduced so far (diff process.env names again at close-out).
