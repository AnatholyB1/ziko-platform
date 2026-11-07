# Phase 45 Review/Security Fixes (branch fix/phase-45-audit, base milestone/v1.18)

Gate: backend/api `tsc --noEmit` clean; `vitest run` 21 files passed, 267 tests passed (8 DB-gated files skipped).

| # | Sev | Finding | Disposition | Commit |
|---|-----|---------|-------------|--------|
| 1 | MEDIUM | One-reward-per-tier race (read-then-insert) | FIXED. New migration `20261107100300_ziko_reward_tier_race_fix.sql`: `UNIQUE(user_id,tier)`, `FOR UPDATE` lock on the `ziko_athlete_state` row in `ziko_grant_reward` (CREATE OR REPLACE), `unique_violation` mapped to `already_granted` (also closes the SECURITY LOW "raises instead of error-shaped JSONB"). Table is fresh (Phase 45 migrations are files-only, unapplied) so no dedupe is needed; if ever populated with a fired race, ADD CONSTRAINT fails loudly instead of deleting rewards. | 1ba60d95 |
| 2 | MEDIUM | `create_reward` / `assess_profile` callable via POST /ai/tools/execute | FIXED. `INTERNAL_ONLY_TOOLS` set exported from `tools/registry.ts`; route answers 404 "Unknown tool" before resolving the executor. Route test `test/routes/ai-tools-execute.spec.ts`. | 4b419c0e |
| 3a | LOW | apply.ts discarded earlier grants when a later tier threw | FIXED. Per-tier try/catch in `runRewardGrantStep`; loop stops at the failing tier, earlier grants returned, rest retried next cycle. Test added. | fe03773e |
| 3b | LOW | `week_of` regex accepted impossible dates (2026-13-45) | FIXED. Calendar round-trip check (`isRealIsoDate`); returns `{granted:false, reason:'invalid_week_of'}` (no throw, so no 500). Note: the tool is no longer client-reachable (fix 2), so there is no HTTP 4xx path; weekOf is backend-generated. Test added. | fe03773e |
| 4 | LOW | single-entry pool evidence `selected_via='fallback'` | DOCUMENT ONLY (cosmetic) | - |
| 5 | LOW | `Math.max(prevTier, tier)` redundant in nextRewardState | DOCUMENT ONLY (cosmetic) | - |
| 6 | LOW | cost not logged when model call throws after provider billing | DOCUMENT ONLY (negligible) | - |
| 7 | LOW | "concurrent double fire" unit test uses mocks, cannot catch the real race | DOCUMENT ONLY; race is now proven closed by the real-Postgres probe below. A live-DB RLS spec for concurrency remains a nice-to-have. | - |
| 8 | LOW | `p_source` bad value raises on decision CHECK | DOCUMENT ONLY (only reachable by direct service-role caller; TS clamps) | - |
| 9 | LOW | `reward_id` FK has no ON DELETE | DOCUMENT ONLY (matches never-revoke) | - |

## Race probe (real PostgreSQL 18.6, throwaway cluster on 127.0.0.1:54411, destroyed after; no hosted DB)
Stubbed auth/roles/state/decisions tables, applied the 3 Phase 45 migrations (+ the fix for the second run). 60 athletes at tier 2, 2 parallel `ziko_grant_reward` calls each (different reward, different week_of).

- Before fix: 63 successes, 57 already_granted; 3 athletes held 2 rewards for tier 2 (63 rewards for 60 users). Race reproduced.
- After fix (two independent runs): 60 successes, 60 already_granted; 0 (user,tier) duplicates; 60 rewards = 60 reward_grant decisions = 60 users.

Machine lock `C:\ziko-platform\.planning\.machine-lock` was taken for the run; it was already absent at release time (another actor removed it).
