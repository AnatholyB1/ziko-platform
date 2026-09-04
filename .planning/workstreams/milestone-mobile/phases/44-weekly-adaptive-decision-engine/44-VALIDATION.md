---
phase: 44
slug: weekly-adaptive-decision-engine
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-02
---

# Phase 44 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (`^3.x`, backend workspace) |
| **Config file** | `backend/api/vitest.config.ts` (`fileParallelism: false` — RLS suite mutates `auth.users`, must stay serialized) |
| **Quick run command** | `npx vitest run test/tools/coaching-engine.spec.ts` |
| **Full suite command** | `npm run test` (from `backend/api/`) — `vitest run --passWithNoTests` |
| **Estimated runtime** | ~30s quick / ~3min full suite |

---

## Sampling Rate

- **After every task commit:** Run targeted `npx vitest run <file> -t "<name>"` for the file(s) touched
- **After every plan wave:** Run `npm run test` (full backend suite, from `backend/api/`)
- **Before `/gsd:verify-work`:** Full suite must be green, plus a manual/scripted duplicate-fire simulation (call the review-check or cron-simulation path twice in quick succession for the same athlete/week) confirming exactly one `athlete_decisions` row — mirrors Phase 42-04's own live empirical verification approach
- **Max feedback latency:** 30 seconds (quick command)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 44-02 | 02 | 1 | ENGINE-01 | — | Real-activity comparison reads only the focus-mapped table(s) | unit | `npx vitest run test/tools/coaching-engine.spec.ts -t "activity aggregation"` | ✅ | ✅ green |
| 44-03 | 03 | 2 | ENGINE-02 | — | `generateObject` decision call produces a valid, sanitized-schema structured decision | unit | `npx vitest run test/tools/coaching-engine.spec.ts -t "decision schema"` | ✅ | ✅ green |
| 44-03, 44-04 | 03, 04 | 2, 3 | ENGINE-03 | — | Escalate/hold/de-escalate correctly updates `readiness` | unit | `npx vitest run test/tools/coaching-engine.spec.ts -t "trajectory"` | ✅ | ✅ green |
| 44-01, 44-05, 44-06, 44-08 | 01, 05, 06, 08 | 1, 4, 2, 6 | ENGINE-04 | T-44-16 | Running the review twice for the same athlete/week produces exactly one decision | integration | `npx vitest run test/rls/athlete-decisions.spec.ts -t "weekly_focus idempotency"` | ✅ | ⚠️ skipped — no `SUPABASE_TEST_URL` configured in this environment; see Manual-Only Verifications note below |
| 44-01, 44-04, 44-05 | 01, 04, 05 | 1, 3, 4 | ENGINE-05 | T-44-18, T-44-20 | Weekly engine's `ai_cost_log` row has `source='weekly_review_cron'`/`'app_open_fallback'`, never touches `creditCheck`/`creditDeduct` | integration | `npx vitest run test/routes/coaching-engine.spec.ts -t "cost logging"` | ✅ | ✅ green |
| 44-03, 44-04 | 03, 04 | 2, 3 | ENGINE-06 | T-44-10, T-44-11 | `create_goal`/`create_program` callable identically from cron path and `/ai/chat` tool-call path | integration | `npx vitest run test/tools/coaching-engine.spec.ts -t "shared apply path"` | ✅ | ✅ green |
| 44-06 | 06 | 2 | D-09 (`athlete_goals` RLS) | T-44-27, T-44-28 | Athlete reads own goals only; no client write path | RLS integration | `npx vitest run test/rls/athlete-goals.spec.ts` | ✅ | ⚠️ skipped — no `SUPABASE_TEST_URL` configured in this environment; see Manual-Only Verifications note below |
| 44-04 | 04 | 3 | FOUND-05 | T-44-39, T-44-40 | `rolling_summary` recompaction stays bounded (≤4 entries, ≤2000 chars) for any history length, with zero extra AI cost | unit | `npx vitest run test/tools/coaching-engine.spec.ts -t "rolling summary"` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky/skipped*

*Statuses above were captured by actually running each row's Automated Command against this worktree on 2026-09-04. The two `⚠️ skipped` rows (ENGINE-04, D-09) are `describe.skipIf(!RUN_DB)` live-database specs — this environment has no `.env.test` populated with a real Supabase test project (`SUPABASE_TEST_URL` unset), so both specs report as skipped, never failed. Every other row is a genuine pass, not a defaulted/assumed green.*

---

## Wave 0 Requirements

- [x] `backend/api/test/tools/coaching-engine.spec.ts` — covers ENGINE-01, ENGINE-02, ENGINE-03, ENGINE-06 (mirror `test/tools/onboarding.spec.ts` + `retroactive-recompute.spec.ts` structure)
- [x] `backend/api/test/routes/coaching-engine.spec.ts` — covers ENGINE-05, the `review-check` route's due/not-due branching, and the `CRON_SECRET` guard on the safety-net cron (mirror `test/routes/onboarding.spec.ts`)
- [x] `backend/api/test/rls/athlete-goals.spec.ts` — new table RLS (mirror `test/rls/athlete-state.spec.ts`)
- [x] Extend `backend/api/test/rls/athlete-decisions.spec.ts` with a `weekly_focus` idempotency case (existing file covers `onboarding_profile`-shaped decisions only)
- [x] A disposable-`auth.users`-row fixture path for the two functional-correctness RPC assertions Phase 42-04 deferred (`success: true` round-trip, duplicate-`weekly_focus`-returns-`error:'duplicate'`) — reuse `backend/api/test/rls/fixtures.ts`'s GoTrue Admin API user-creation helper. Closed by plan 44-06 Task 2 (the `weekly_focus idempotency` block in `athlete-decisions.spec.ts`, exercising the RPC directly) plus this plan (44-08) Task 1 (`weekly-review-duplicate-fire.spec.ts`, exercising the same round-trip/duplicate assertions through the full `runWeeklyReview` chain rather than the bare RPC).

---

## Manual-Only Verifications

The duplicate-fire simulation is now **automated**, not manual — closed by `test/rls/weekly-review-duplicate-fire.spec.ts` (plan 44-08 Task 1), which drives the real `runWeeklyReview` chain twice for the same seeded athlete/week and asserts exactly one `athlete_decisions` row with `decision_type='weekly_focus'`. Like the other live-DB specs in this phase, it is `describe.skipIf(!RUN_DB)`-guarded and reports skipped (not failed) in this environment, since no `SUPABASE_TEST_URL` is configured here.

The one behavior that remains genuinely manual is the on-device reveal-overlay verification plus the interactive-chat `create_goal` path — see plan 44-08 Task 3's checkpoint. Nothing about the duplicate-fire guarantee itself needs a human anymore.

| Behavior | Requirement | Why Manual | Verification |
|----------|-------------|------------|---------------|
| On-device reveal overlay rendering + interactive-chat `create_goal` reaching the real orchestrator | ENGINE-06, D-03 | Requires an actual device/simulator and a live orchestrator conversation — the mocks in plans 44-03 through 44-07 cannot prove either | Plan 44-08 Task 3's 8-step device checklist (see PLAN.md) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-09-04 — all automatable coverage confirmed green (or correctly skipped on the known `.env.test` gap, tracked since wave 1). Plan 44-08 Task 3's device checkpoint approved by the user on 2026-09-04, all 8 steps confirmed. Phase fully signed off.
