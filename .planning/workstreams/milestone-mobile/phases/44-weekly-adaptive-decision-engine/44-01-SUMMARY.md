---
phase: 44-weekly-adaptive-decision-engine
plan: 01
subsystem: database
tags: [postgres, supabase, rls, rpc, migrations, mcp]

# Dependency graph
requires:
  - phase: 42-decision-system-foundation
    provides: athlete_state, athlete_decisions tables + record_athlete_decision() 9-arg RPC
provides:
  - athlete_goals table (D-09) — dedicated goal_text/target_metric/target_value/target_date/status row, SELECT-only RLS, three-role write REVOKE — live on production
  - ai_cost_log.source column (ENGINE-05) — distinguishes opex-funded autonomous AI cost from user-initiated chat cost — live on production
  - record_athlete_decision() 10-arg RPC — p_new_goal atomic goal creation + goal_id stamping, next_review_due_at now also advances on onboarding_profile (D-02) — live on production, old 9-arg overload dropped and confirmed absent
affects: [44-weekly-adaptive-decision-engine (remaining plans 02-08 depend on this schema being live), 47-ops-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Live migration application via Supabase MCP apply_migration/execute_sql tools as a fallback path when CLI credentials (SUPABASE_ACCESS_TOKEN/SUPABASE_PROJECT_ID/SUPABASE_DB_PASSWORD) are unavailable in the executor's shell session"
    - "schema_migrations.version reconciliation after MCP apply — UPDATE the version column to match local migration file timestamps so a future supabase db push does not re-attempt already-applied files"

key-files:
  created:
    - supabase/migrations/20260902100000_athlete_goals.sql
    - supabase/migrations/20260902100100_ai_cost_log_source.sql
    - supabase/migrations/20260902100200_record_athlete_decision_v2.sql
  modified: []

key-decisions:
  - "DROP FUNCTION IF EXISTS on the exact 9-type signature before CREATE OR REPLACE with 10 args — Postgres treats a different arg count as a new overload, not a replacement, which would leave both signatures live and break every existing 9-named-param caller (onboarding.ts, onboarding-retroactive.ts)"
  - "athlete_goals insert happens after the duplicate early-return and before the athlete_state UPDATE inside record_athlete_decision(), so a duplicate weekly_focus retry never creates an orphan goal row"
  - "next_review_due_at widened to advance on both weekly_focus and onboarding_profile (not just weekly_focus) — implements D-02's cadence rolling from onboarding completion date"
  - "No CHECK constraint added on ai_cost_log.source — deliberately deferred to Phase 47 (OPS-03) which will add more autonomous sources"
  - "Task 3 executed via Supabase MCP (apply_migration + execute_sql) instead of the plan's literal supabase db push CLI instruction, because none of SUPABASE_ACCESS_TOKEN/SUPABASE_PROJECT_ID/SUPABASE_DB_PASSWORD were ever present in any available shell session; the MCP server carries its own credentials and required none of the three. See Deviations."
  - "After MCP apply_migration registered the three migrations under auto-generated MCP timestamps (20260903194647/194654/194728) rather than the local file names' timestamps, the version column in supabase_migrations.schema_migrations was UPDATEd to the local file prefixes (20260902100000/100100/100200) so a future CLI supabase db push recognizes these as already-applied instead of re-attempting them and hitting 'already exists' errors."

requirements-completed: [ENGINE-04, ENGINE-05, ENGINE-06]

# Metrics
duration: ~25min (Tasks 1-2) + Task 3 applied out-of-session via Supabase MCP by the orchestrator
completed: 2026-09-03
---

# Phase 44 Plan 01: Weekly Adaptive Decision Engine — Schema Foundation Summary

**Three new Supabase migrations (athlete_goals table, ai_cost_log.source column, record_athlete_decision v2 RPC) written, committed, and applied live to production project `slkobhavpwsubnsmuhya` — via Supabase MCP `apply_migration`/`execute_sql` rather than the CLI, since none of the three CLI credentials were ever available in an executor shell session.**

## Performance

- **Duration:** ~25 min (Tasks 1-2, this session) + Task 3 applied by the orchestrator via Supabase MCP after this session reported the credential blocker
- **Tasks:** 3/3 completed
- **Files modified:** 3 (all new migration files; Task 3 made zero additional repo file changes — it is a live-database action)

## Accomplishments
- `athlete_goals` table created: SELECT-only RLS, explicit three-role (`anon`, `authenticated`, `service_role`) write REVOKE in the same migration (avoiding the Phase 42 `athlete_state` follow-up-migration mistake), indexed for the "current active goal" lookup
- `ai_cost_log.source` column added, defaulting existing rows safely to `'user_chat'`
- `record_athlete_decision()` extended to a single 10-arg version: explicit `DROP FUNCTION IF EXISTS` on the 9-type signature prevents an ambiguous-overload break for existing callers; new `p_new_goal` param atomically writes `athlete_goals` and stamps the real `goal_id` into `current_focus_detail`; `next_review_due_at` now advances on `onboarding_profile` decisions too (D-02)
- All three migrations are now live on the production Supabase project, confirmed via `execute_sql` against `pg_proc`, `pg_class`, `has_table_privilege`, and `information_schema.columns`
- The Phase 43 onboarding call path (9 named params, no `p_new_goal`) confirmed still working against the new RPC signature, with `next_review_due_at` correctly stamped ~7 days out and `last_review_at` correctly left untouched for a non-`weekly_focus` decision

## Task Commits

Each task was committed atomically:

1. **Task 1: athlete_goals table + ai_cost_log.source column migrations** - `bb8025a4` (feat)
2. **Task 2: record_athlete_decision v2 — p_new_goal + onboarding review-clock stamp** - `8ebc1a09` (feat)
3. **Task 3: [BLOCKING] Apply migrations to the live Supabase project** - applied via Supabase MCP `apply_migration` (no new repo file diff; this task changes remote database state only)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified
- `supabase/migrations/20260902100000_athlete_goals.sql` - New `athlete_goals` table, SELECT-only RLS, three-role write REVOKE, `idx_athlete_goals_user_active` index, `trg_athlete_goals_updated` trigger — live on production
- `supabase/migrations/20260902100100_ai_cost_log_source.sql` - `ai_cost_log.source TEXT NOT NULL DEFAULT 'user_chat'` additive column — live on production
- `supabase/migrations/20260902100200_record_athlete_decision_v2.sql` - Drops 9-arg `record_athlete_decision`, creates 10-arg version with `p_new_goal`, atomic goal insert + `goal_id` stamp, widened `next_review_due_at` clock, re-asserted per-role EXECUTE lockdown, `NOTIFY pgrst, 'reload schema'` — live on production, confirmed as the only overload in `pg_proc`

## Decisions Made
- Followed the plan's explicit instruction to deviate from `44-PATTERNS.md`'s sketch by adding the `DROP FUNCTION IF EXISTS` step — the pattern map's sketch omits it, but the plan's task text calls this out explicitly as required (overload hazard).
- Kept every existing block ((a) evidence guard, (b) journal insert/ON CONFLICT, (c) duplicate early-return, (d) self-heal insert) byte-for-byte identical to the live 9-arg function, only inserting the new `athlete_goals` write and modifying the two `current_focus_detail`/`next_review_due_at` UPDATE assignments, per the plan's explicit "carry forward unchanged except where specified" instruction.
- Did not add a CHECK constraint on `ai_cost_log.source`, per the plan's explicit instruction to defer that to Phase 47 (OPS-03).
- Applied Task 3 via the Supabase MCP server instead of the CLI (see Deviations below) — the plan's action text names `supabase link` / `supabase db push`, but the CLI path was not usable in any session this plan ran in.

## Deviations from Plan

**1. [Rule 3 - Blocking, executed by orchestrator outside this executor's shell] Task 3 applied via Supabase MCP instead of the CLI**
- **Found during:** Task 3, after this session confirmed `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, and `SUPABASE_DB_PASSWORD` were all absent from `env` in the executor's Git Bash session (worktree at `C:\ziko-platform\.claude\worktrees\agent-aa469103488b68aed`) despite the Supabase CLI itself being installed and functional (`supabase 2.116.0`).
- **Issue:** The plan's Task 3 action text is written against the CLI procedure (`supabase link --project-ref`, `supabase migration list`, `supabase db push < /dev/null`). None of the three required CLI credentials were ever exported into any shell session available to this plan, so the CLI path was genuinely blocked — not a case of missing user approval (that had already been granted), but of the secrets themselves never being present.
- **Fix:** The orchestrator applied the three migrations directly via the Supabase MCP server's `apply_migration` tool, in file order (`athlete_goals` → `ai_cost_log_source` → `record_athlete_decision_v2`), against project `slkobhavpwsubnsmuhya`. The MCP server authenticates with its own credentials and required none of `SUPABASE_ACCESS_TOKEN`/`SUPABASE_PROJECT_ID`/`SUPABASE_DB_PASSWORD`. Post-push verification used the MCP `execute_sql` tool for the four live-project assertions and the Phase 43 backward-compatibility round-trip, in place of `psql`/CLI-based verification.
- **Files modified:** none in the repo — this is a live-database-only action, matching the plan's own `<files>` annotation for Task 3 (`(no file changes — deployment step)`).
- **Verification (reported by the orchestrator, executed via MCP tools this executor session does not have direct access to):**
  - `SELECT count(*) FROM pg_proc WHERE proname = 'record_athlete_decision'` → `1` (confirms the 9-arg `DROP FUNCTION` succeeded and no ambiguous overload exists)
  - `athlete_goals.relrowsecurity` → `true`
  - `has_table_privilege('service_role','public.athlete_goals','INSERT')` → `false`
  - `ai_cost_log.source` column default → `'user_chat'::text`
  - `get_advisors(type=security)` → zero findings mentioning `athlete_goals`, `ai_cost_log`, or `record_athlete_decision`
  - Phase 43 onboarding round-trip: called `record_athlete_decision` with the original 9 named params (no `p_new_goal`) against a disposable existing RLS-fixture test user (`rls-unlinked-55d2bb03@ziko.test`, no new `auth.users` row created) → `{"success":true,"decision_id":"74c7fb1f-5a04-4237-ae93-ce1627a9fd96","goal_id":null}`; `next_review_due_at` landed exactly 7.00 days out; `last_review_at` correctly stayed `NULL` since `decision_type` was `onboarding_profile`, not `weekly_focus`. Both the test `athlete_decisions` row and the test `athlete_state` row were deleted afterward — no residue on the test user.
  - No secret value was ever read, printed, or logged in either this executor's session or the orchestrator's MCP-based session — the MCP path required none of the three CLI env vars.
- **Committed in:** N/A for the live-push action itself (no repo diff); this SUMMARY commit documents it.

**2. [Rule 1 - Bug, executed by orchestrator] Migration version reconciliation in `schema_migrations`**
- **Found during:** Task 3, immediately after the MCP `apply_migration` calls completed.
- **Issue:** `apply_migration` registered the three migrations in `supabase_migrations.schema_migrations` under auto-generated MCP-session timestamps (`20260903194647`, `20260903194654`, `20260903194728`) rather than the local migration file names' timestamps (`20260902100000`, `20260902100100`, `20260902100200`). Left as-is, a future `supabase db push` from the repo's own migration files would not recognize these as already applied and would attempt to reapply them, hitting "already exists" errors on the table/column/function they create.
- **Fix:** The orchestrator ran an `UPDATE` on the `version` column in `supabase_migrations.schema_migrations` to change the three MCP-generated timestamps to the local file prefixes exactly, then confirmed via a follow-up `SELECT` that all three rows now show the local-file version strings.
- **Files modified:** none in the repo (metadata-table-only fix on the live project).
- **Verification:** follow-up `SELECT` against `schema_migrations` confirmed the version strings now match `20260902100000`/`20260902100100`/`20260902100200`.
- **Committed in:** N/A (live-database metadata fix, no repo diff).

---

**Total deviations:** 2 (1 Rule 3 — CLI-to-MCP execution path substitution due to unavailable credentials; 1 Rule 1 — migration version metadata reconciliation to keep local files and remote schema_migrations aligned for future CLI pushes)
**Impact on plan:** Both deviations were necessary to genuinely complete Task 3's stated outcome (three migrations live on production, verifiable via the plan's own acceptance criteria) rather than leaving it permanently blocked on unavailable local shell credentials. No scope creep — no schema, RLS, or grant behavior differs from what Tasks 1-2 wrote to disk; only the *mechanism* of application and the migration-history bookkeeping changed.

## Issues Encountered
None during Tasks 1-2; all automated verification greps and acceptance criteria passed on the first attempt for both. Task 3's only issue was the CLI-credential unavailability documented above, resolved by the orchestrator's MCP fallback.

## User Setup Required

None. Task 3's original credential requirement is now moot for this plan since the live push already happened via MCP; however, if this repo's CI-driven `migrate-supabase` job (`.github/workflows/ci.yml`) runs on a future merge to `main` that touches `supabase/migrations/`, it will use the CLI with `SUPABASE_ACCESS_TOKEN`/`SUPABASE_PROJECT_ID` from GitHub Actions secrets (already configured there, per the plan's own read of that job) and should recognize these three migrations as already applied thanks to the `schema_migrations.version` reconciliation performed in this plan.

## Next Phase Readiness

All three schema changes this plan exists to ship are now live on production (`slkobhavpwsubnsmuhya`):
- `athlete_goals` — SELECT-only, three-role write lockdown, RLS enabled, zero security-advisor findings
- `ai_cost_log.source` — defaulted, live
- `record_athlete_decision()` — single 10-arg version live, `p_new_goal` wired, `next_review_due_at` widened to `onboarding_profile`, old 9-arg overload confirmed dropped, Phase 43 onboarding callers confirmed still working unchanged

Phase 44's remaining plans (44-02 through 44-08) can now build against this live schema without a false-positive verification gap. No blockers carried forward.

---
*Phase: 44-weekly-adaptive-decision-engine*
*Plan: 01*
*Status: Complete — all 3 tasks done, migrations live on production*
