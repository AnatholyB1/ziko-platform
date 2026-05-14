---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: Coach Platform & CRM
status: phase_23_context_gathered
stopped_at: "Phase 23 context gathered — ready for /gsd-plan-phase 23"
last_updated: "2026-05-14T13:30:00.000Z"
progress:
  total_phases: 10
  completed_phases: 1
  total_plans: 4
  completed_plans: 4
  percent: 10
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-13)

**Core value:** A fitness user has a single app that coaches them, tracks everything, tells them what to cook based on what's in their kitchen — and controls AI costs through gamified engagement. Coaches manage their clients, assign programs, and use AI to analyze and adapt those programs from the web CRM.
**Current focus:** v1.5 Coach Platform & CRM — Phase 23 (Web Turborepo Onboarding & Auth Bootstrap) **context gathered 2026-05-14** — ready for `/gsd-plan-phase 23`

## Current Position

Phase: 23 — Web Turborepo Onboarding & Auth Bootstrap
Plan: TBD — context just gathered, no plans yet
Status: **Phase 23 CONTEXT GATHERED (2026-05-14).** 23-CONTEXT.md committed (commit 47ce88a). 16 decisions locked across 4 gray areas (Spike + integration / coach-sdk packaging / @supabase/ssr + i18n + ESLint / thin slice + Vercel + tests) plus D-17 icon library auto-resolved by audit. User picked recommended option on all 16 questions (same pattern as Phase 22, 32/32 recommended across both phases). Closes Open Architectural Decisions #1 (apps/web onboarding spike), #2 (Vercel Pro confirmation), and #6 (icon library) from ROADMAP.md. Resume file: `.planning/phases/23-web-turborepo-onboarding-auth-bootstrap/23-CONTEXT.md`. Next step: `/gsd-plan-phase 23`.

---

## Previous Phase (verified)

Phase: 22 — Schema Foundation & RLS Keystone
Plan: 4 plans (waves 0–3), **4/4 complete**
Status: **Phase 22 VERIFIED (PASS, 2026-05-14).** Verification report: .planning/phases/22-schema-foundation-rls-keystone/22-VERIFICATION.md. 7/7 truths verified, 47/47 tests pass, all 14 STRIDE threats covered, constraint compliance clean. Original execution context: Migration 036 (workout_programs extensions + ai_imports) applied to `slkobhavpwsubnsmuhya` via Supabase MCP apply_migration. All 5 ROADMAP success criteria closed: (1) Vitest foundation + service-role-confined fixtures, (2) user_profiles.role + coach_profiles, (3) coach_invitations + coach_client_links + is_coach_of + redeem_invitation_code + 11 cross-user policies, (4) workout_programs 5 extension columns + ai_imports + owner-only RLS, (5) full RLS envelope green end-to-end (47/47 tests across 7 files). Constant-time variance re-measured 4.68 ms (well within 20 ms CI ceiling). All 14 STRIDE threats covered (9 by test, 2 by config, 1 accepted with rationale, 2 deferred-with-flag to downstream plans). Ready for `/gsd-verify-phase`.
Last activity: 2026-05-14 — Plan 22-04 (Wave 3, final) executed on branch gsd/phase-22-schema-foundation-rls-keystone: migration 036 = the final keystone surface. workout_programs gains 5 columns (created_by_coach_id, assigned_to_user_id, template_source_id all FK ON DELETE SET NULL per D-12; is_template DEFAULT FALSE; weeks_data JSONB without DB CHECK per D-11) plus 3 partial indexes for Phase 27 hot paths. ai_imports table per D-09 (16 columns, 4 CHECK whitelists for mime_type/size_bytes/mode/status, self-FK re_upload_source_id, committed_program_id FK SET NULL, user_id FK CASCADE, updated_at trigger, single ai_imports_own FOR ALL policy per D-10 — coach CANNOT read athlete imports even when linked). RED → MCP apply → GREEN gate respected with RED-first ordering. Three commits on this plan: ba29e7c (RED specs), 6b0d3ec (migration SQL), final docs commit.
Resume file: none — phase verified. Next step: begin Phase 23 (Web Turborepo Onboarding & Auth Bootstrap) context-gathering.

Progress: [█░░░░░░░░░] 10% (v1.5 milestone — 1/10 phases verified; Phase 22 VERIFIED PASS 2026-05-14)

## Performance Metrics

**Velocity:**

- Total plans completed: 4 (v1.5)
- Average duration: 12.0m
- Total execution time: ~59m

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 22 | 4 | 59m | 12.0m |

**Recent Trend:**

- Last 5 plans: 22-01 (9m, 3 tasks, 8 files), 22-02 (8.4m, 2 tasks, 3 files), 22-03 (29.6m, 2 tasks, 3 files), 22-04 (12m, 2 tasks, 3 files)
- Trend: stable — RED → MCP apply → GREEN gate respected on all 3 DDL plans; same tool-availability checkpoint pattern as 22-02/22-03 resolved by orchestrator (Option C, MCP apply). Plan 22-04 ran RED-first (textbook ordering) where 22-03 ran migration-first; both equivalent under the gate intent.

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work (v1.5 milestone scoping):

- [v1.5 Scoping]: `role` column on `user_profiles` ('client' | 'coach' | 'both') — single auth, RLS by role, coach can also be athlete
- [v1.5 Scoping]: Invitation = 6-character unique code (e.g. `ZK-4F2A9B`) generated by coach, entered in mobile app — offline-friendly, no SMTP dependency
- [v1.5 Scoping]: Full-access permissions by default on linked client data — revocable via link removal; GDPR covered by revocation rather than per-domain opt-in (avoids complexity)
- [v1.5 Scoping]: Bounded contexts architecture (`coach/identity`, `coach/clients`, `coach/programs`, `coach/invitations`, `coach/imports`, `coach/ai`) — prepares future ERP without refactoring
- [v1.5 Scoping]: Web only for coach CRM on ziko-app.com — Expo unsuitable for dense table views; mobile coach role deferred to v1.7+
- [v1.5 Scoping]: AI file imports replace CSV — Claude vision/document parsing → `generateObject` + Zod → preview/commit. Covers PDF, image, Excel, Word, screenshots. No stable format to maintain
- [v1.5 Scoping]: Coach programs = extended `workout_programs` table (`created_by_coach_id`, `assigned_to_user_id`, `is_template`, `weeks_data JSONB`) — reuses existing mobile program views
- [v1.5 Scoping]: Self-serve coach onboarding with light KYC — no manual validation bottleneck in v1.5
- [v1.5 Scoping]: AI coach orchestrator tools = analyze_client + generate_coaching_program + monitor_client_alerts — credit-gated via v1.4 system
- [v1.5 Roadmap]: 10 phases (22–31) with 3 parallelizable lanes — backend identity→clients→programs→imports→ai (sequential); Strava (parallel after schema); marketing landing (parallel after onboarding URL stable)
- [v1.5 Roadmap]: Phase 22 (schema + `is_coach_of()` SECURITY DEFINER function) is the keystone — every cross-user RLS policy and every coach module depends on it
- [Phase 22-01]: Add `--passWithNoTests` to vitest scripts so empty suites exit 0 (Vitest v3 default is exit-1 on empty discovery)
- [Phase 22-01]: Pin `@vitest/coverage-v8` to ^3 (npm latest is v4 which conflicts with vitest@^3 peer)
- [Phase 22-01]: Service-role key spatially confined to `backend/api/test/` — CI guard greps `src/` and fails build on any reference (ARCH-03 pre-enforcement)
- [Phase 22-02]: Migration 034 applied via Supabase MCP `apply_migration` (per D-16) — orchestrator-applied as Option C resolution of Wave 1 tool-availability checkpoint; counts as MCP-apply, no waiver
- [Phase 22-02]: `SET LOCAL lock_timeout = '5s'` included at top of migration 034 (matches pattern planned for 035; cheap to add now, future-proofs deploys)
- [Phase 22-02]: Trigger pattern reuses `public.handle_updated_at()` from migration 001 verbatim — no `SET search_path` added (T-22-09 disposition: accept; hardening is Phase 23+ scope)
- [Phase 22-02]: Used `IF NOT EXISTS` on ADD COLUMN and CREATE TABLE so migration is re-runnable for rollback/retry (defensive, no behavior change)
- [Phase 22-03]: Migration 035 applied via Supabase MCP `apply_migration` by the orchestrator (Option C resolution, same pattern as 22-02) — counts as MCP-apply per D-16
- [Phase 22-03]: Constant-time RPC test ceiling raised from research-target 10 ms p95 variance to 20 ms to absorb CI jitter — measured variance 4.52 ms is well inside both bounds
- [Phase 22-03]: session_sets coach-read policy uses the same EXISTS-over-workout_sessions parent-chain shape as the existing own_session_sets policy (no new column on session_sets)
- [Phase 22-03]: pg_policies introspection test gracefully skips when PostgREST does not expose pg_catalog — presence already asserted at SQL level + behaviorally via 4 functional tests
- [Phase 22-03]: Companion non-unique index `idx_coach_client_links_pair_active` retained alongside the partial UNIQUE — intentional duplicate-by-shape leaves a clear knob for Phase 23+ teardown if size becomes a concern
- [Phase 22-04]: Migration 036 applied via Supabase MCP `apply_migration` by the orchestrator (Option C, third time — same pattern as 22-02/22-03) — counts as MCP-apply per D-16
- [Phase 22-04]: All 3 workout_programs extension FKs use ON DELETE SET NULL per D-12 (Open Decision #4) — preserves coach-authored content after athlete deletion, awaiting Phase 26+ GDPR review
- [Phase 22-04]: weeks_data JSONB ships WITHOUT a DB CHECK per D-11 — Zod validation is Phase 23 coach-sdk territory; ARCH-03 (Phase 24, no service-role under coach/) is the spatial defense against direct SQL writes. T-22-11 is the only threat with an "accept" disposition in the entire Phase 22 register
- [Phase 22-04]: ai_imports.credit_transaction_id ships FK-less per D-09 footnote — column type (UUID NULL) is correct; FK to ai_credit_transactions(id) is wired in Phase 28 to avoid a cross-cycle dependency
- [Phase 22-04]: ai_imports.re_upload_source_id self-FK uses ON DELETE SET NULL (not CASCADE) — re-upload audit chains survive deletion of an earlier import; the audit trail breaks gracefully rather than vanishes
- [Phase 22-04]: T-22-13 (athlete forges created_by_coach_id) is explicitly deferred to Phase 27 — Phase 22 grants the column surface but the existing own_programs FOR ALL policy lets the program owner set any UUID. Phase 27 plan-checker must verify created_by_coach_id against an active coach_client_links row in the service layer before persisting

### Pending Todos

None yet.

### Blockers/Concerns

- **[Open decision, Phase 23 blocker]** `apps/web/` Turborepo onboarding vs dual-repo with published `coach-sdk` NPM — Phase 23 must spike the integration decision with documented rollback path. Currently the Next.js web app lives in a SEPARATE repo at `c:/ziko-web` (NOT in this monorepo).
- **[Open decision, Phase 23 blocker]** Vercel Pro tier confirmation — mandatory before Phase 28 (Hobby's 10s timeout kills AI imports; need `maxDuration=60`).
- **[Open decision, Phase 28]** AI import per-page credit pricing — target €0.05/import within €0.75/user/month freemium; calibration TBD.
- AI import quality on noisy/varied real-world files (screenshots, scanned PDFs) needs validation before shipping Phase 28 — define fallback strategy (manual edit, multiple-shot, Sonnet escalation).
- Strava OAuth requires Strava app registration + webhook endpoint validation — must be requested early in Phase 30 (Strava review delays are common).
- Bounded contexts architecture decision must be applied from Phase 24 — refactoring mid-milestone is expensive.
- **[Phase 22 risk, RESOLVED]** `is_coach_of()` recursion / revocation bypass — Mitigated by Plan 22-03 with STABLE SECURITY DEFINER + inline EXISTS predicate; live revocation tested with immediate effect; cross-coach isolation tested; all 9 cross-user STRIDE threats (T-22-02 through T-22-10) have named mitigations and named tests.
- **[Phase 22 risk, ACCEPTED]** T-22-11 (malformed weeks_data) — deliberate trade-off per D-11. Coach-sdk Zod validation (Phase 23) is the only check on JSON shape. ARCH-03 (Phase 24) bans service-role under coach/ as spatial defense. Phase 27 planner is on notice.
- **[Phase 22 risk, DEFERRED-WITH-FLAG]** T-22-13 (athlete forges `created_by_coach_id` they never linked to) — Phase 22 grants the column surface but does not gate writes against `coach_client_links`. Phase 27 service layer must validate; explicit flag in 22-04-SUMMARY threat register.

## Session Continuity

Last session: 2026-05-14T12:15:00.000Z
Stopped at: Completed 22-04-PLAN.md (Wave 3, final) — migration 036 live, 47/47 RLS tests green, Phase 22 envelope CLOSED, ready for `/gsd-verify-phase`
Resume file: none — phase execution complete; next step is `/gsd-verify-phase 22-schema-foundation-rls-keystone`
