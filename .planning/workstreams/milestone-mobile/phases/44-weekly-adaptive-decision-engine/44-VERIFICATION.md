---
phase: 44-weekly-adaptive-decision-engine
verified: 2026-09-04T13:35:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 44: Weekly Adaptive Decision Engine — Verification Report

**Phase Goal:** Each week, every active athlete's next focus is decided from what they actually did, not a fixed calendar — and the decision self-corrects onboarding profiling errors over time.
**Verified:** 2026-09-04
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Weekly review compares actually-logged activity (not self-declared) against the assigned focus | ✓ VERIFIED | `context.ts` `fetchFocusScopedActivity()` queries real per-focus source tables only (`workout_sessions`, `habit_logs`/`journal_entries`, `nutrition_logs`, `hydration_logs`, `sleep_logs`, `cardio_sessions` per `FOCUS_SOURCE_MAP`), reduced to counts/sums — never reads a self-report field. `FocusComparison` in `fetchWeeklyReviewContext` computes `met` deterministically (`actualValue >= focus.target_value`) in backend arithmetic, not by the model. |
| 2 | AI decides next week's focus from that comparison + decision history, and can escalate/de-escalate independent of onboarding profile | ✓ VERIFIED | `decide.ts`'s `WEEKLY_REVIEW_SYSTEM_PROMPT` explicitly instructs "escalation is fast... de-escalation is slow... the onboarding-inferred profile is a starting hypothesis, not a constraint." `buildWeeklyReviewPrompt` feeds `recentDecisions` (last 4) and `missPattern` (2-of-last-3, computed from the raw 12-row window, filtered by `decision_type='weekly_focus'` before slicing) into the prompt. `context.ts` reads `readiness`/`current_focus_summary` from `athlete_state`, never re-derives from the onboarding profile. |
| 3 | Running the weekly review twice for the same athlete/week produces exactly one recorded decision | ✓ VERIFIED | DB: `idx_athlete_decisions_week_idempotency` unique partial index on `(user_id, decision_type, week_of)` (migration `20260831120100`); `record_athlete_decision()` v2 inserts with `ON CONFLICT (...) WHERE decision_type='weekly_focus' AND week_of IS NOT NULL DO NOTHING`, checks `ROW_COUNT`, and returns `{success:false, error:'duplicate'}` **before** the state patch or goal insert runs. Code: `applyWeeklyDecision` short-circuits on `error==='duplicate'` before any `create_program` call or `ai_cost_log` insert (`apply.ts:204-206`). `week_of` is captured once in `context.ts` from `athlete_state.next_review_due_at` — never re-derived from wall-clock time in either trigger path, so both triggers agree on the same idempotency key for the same cycle. Unit tests (`test/tools/coaching-engine.spec.ts`, mocked RPC) explicitly assert the duplicate-short-circuit path and the "1 RPC call total, no second write" invariant. Live integration test (`test/rls/weekly-review-duplicate-fire.spec.ts`, drives real `runWeeklyReview` twice) exists and is correctly written but reports `skipped` in this environment (no `SUPABASE_TEST_URL`/`.env.test`, a known pre-existing environment gap, not a phase defect) — DB logic and RPC signature confirmed correct by direct migration inspection. |
| 4 | The weekly engine's AI cost is logged to `ai_cost_log` under a source never deducted from the athlete's own credit balance | ✓ VERIFIED | Migration `20260902100100_ai_cost_log_source.sql` adds `ai_cost_log.source TEXT NOT NULL DEFAULT 'user_chat'`. `apply.ts` inserts `{ user_id, model, input_tokens, output_tokens, source }` with `source` always one of `'weekly_review_cron'`/`'app_open_fallback'` (never the credit-gated default). Grepped the entire `coaching-engine/` module: zero references to `creditCheck`/`creditDeduct`/`creditGate` (only a comment explaining the deliberate absence). Route-level test asserts the cost-logging behavior with the trigger-specific source; passes. |
| 5 | `create_goal`/`create_program` registered in the orchestrator tool registry, callable identically from cron and interactive chat, one shared write path | ✓ VERIFIED | `tools/registry.ts` imports `CoachingEngineTools` and registers both `create_goal`/`create_program` in the executor map (line 188-189) **and** spreads `coachingEngineToolSchemas` into `allToolSchemas` (line 612), so both `/ai/chat`, `/ai/chat/stream`, and `GET /ai/tools` expose them identically to the cron path. `apply.ts`'s `applyWeeklyDecision` imports `create_program` directly from `./tools.js` (same function the registry calls) — there is no second implementation. Both executors write exclusively through the single `record_athlete_decision()` RPC (`tools.ts` lines 116-142, 177-204), matching `apply.ts`'s own RPC call shape. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/api/src/coaching-engine/context.ts` | Real-activity aggregation, focus-scoped, deterministic comparison | ✓ VERIFIED | Substantive (392 lines), wired into `apply.ts`/`decide.ts` |
| `backend/api/src/coaching-engine/decide.ts` | `generateObject` structured decision call | ✓ VERIFIED | Schema-sanitized for Anthropic, D-11 hold-guard present |
| `backend/api/src/coaching-engine/apply.ts` | Single shared write path + rolling-summary compaction | ✓ VERIFIED | `applyWeeklyDecision`/`runWeeklyReview`, duplicate short-circuit, cost logging |
| `backend/api/src/coaching-engine/tools.ts` | `create_goal`/`create_program` executors + AITool schemas | ✓ VERIFIED | Both write through `record_athlete_decision()`, real re-derived evidence |
| `backend/api/src/coaching-engine/routes.ts` | `/review-check` (lazy) + `/cron/weekly-review` (Sunday safety net) | ✓ VERIFIED | CR-01 fail-open bug fixed (`if (!cronSecret \|\| ...)`), confirmed by direct read and by a passing regression test |
| `supabase/migrations/20260902100200_record_athlete_decision_v2.sql` | RPC v2: `p_new_goal`, idempotent insert, atomic goal-id stamping | ✓ VERIFIED | `DROP FUNCTION` overload-hazard handled correctly; `EXECUTE` locked to `service_role` |
| `supabase/migrations/20260902100100_ai_cost_log_source.sql` | `ai_cost_log.source` column | ✓ VERIFIED | Present, documented, safe default |
| `supabase/migrations/20260902100000_athlete_goals.sql` | `athlete_goals` table | ✓ VERIFIED (existence + shape, not re-verified live — see note) | Referenced correctly by RPC and `tools.ts` |
| `apps/mobile/src/components/WeeklyReviewRevealOverlay.tsx` | D-03 in-app reveal moment | ✓ VERIFIED (wired) / ⚠️ known UX gap | Mounted in `apps/mobile/app/(app)/_layout.tsx:289`; queries `athlete_state`. WR-01 (redundant `dismissed` flag suppresses re-reveal after the first show per app-process lifetime) is present as documented in 44-REVIEW.md — deliberately left open per prior user decision, not a new finding. |
| `backend/api/src/tools/registry.ts` | Tool registration | ✓ VERIFIED | Executor map + `allToolSchemas` both updated |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `apps/mobile/app/(app)/_layout.tsx` | `GET /coaching-engine/review-check` | `fetch` in `useQuery` bootstrap hook | ✓ WIRED | Sends bearer token, fire-and-forget on the backend via `waitUntil` |
| `routes.ts` (`/review-check`, `/cron/weekly-review`) | `apply.ts` `runWeeklyReview` | direct import | ✓ WIRED | Both triggers funnel through the identical function |
| `apply.ts` | `context.ts` → `decide.ts` → RPC | direct imports, sequential composition | ✓ WIRED | No parallel/alternate write path found |
| `tools/registry.ts` | `coaching-engine/tools.ts` `create_goal`/`create_program` | executor map + schema array | ✓ WIRED | Confirmed both registrations present |
| `vercel.json` crons | `POST /coaching-engine/cron/weekly-review` | cron declaration `0 10 * * 0` (Sunday) | ✓ WIRED | Entry present, route mounted in `app.ts:91` |
| `apply.ts` `ai_cost_log` insert | `ai_cost_log.source` column | direct insert with `source` field | ✓ WIRED | No credit-gate middleware in the call chain |

### Behavioral Spot-Checks / Test Execution

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit + route test suite for coaching-engine | `npx vitest run test/tools/coaching-engine.spec.ts test/routes/coaching-engine.spec.ts` | 60/60 tests passed (46 + 14) | ✓ PASS |
| `CRON_SECRET` unset → fails closed (401) | Test: "POST /cron/weekly-review with CRON_SECRET unset fails closed (401)..." | Passed | ✓ PASS |
| Duplicate RPC response short-circuits before any second write | Unit test asserting `mockRpc` called exactly once on `duplicate` | Passed | ✓ PASS |
| Live-DB idempotency / RLS integration tests | `npx vitest run test/rls/athlete-goals.spec.ts test/rls/weekly-review-duplicate-fire.spec.ts test/rls/athlete-decisions.spec.ts` | 22 tests, all `skipped` (no `SUPABASE_TEST_URL`) | ? SKIP (known pre-existing env gap, not a phase-44 defect — confirmed by direct SQL/migration inspection instead) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No `TBD`/`FIXME`/`XXX`/`TODO`/placeholder markers found in any Phase 44 source file (`coaching-engine/*.ts`, `WeeklyReviewRevealOverlay.tsx`) | — | none |

Note: `WeeklyReviewRevealOverlay.tsx`'s `dismissed`-flag redundancy (WR-01 in `44-REVIEW.md`) and `decide.ts`'s missing defensive guard for `call_create_program: true` + null `new_focus_detail` (WR-02) and `tools.ts`'s wall-clock evidence-window inconsistency for the direct `create_program` call path (WR-03) are all still present exactly as documented in the code review. Per the task instructions, these were deliberately left open by user decision post-review and are not re-flagged here as new gaps — they do not affect any of the 5 phase success criteria.

### CR-01 Regression Confirmation

`backend/api/src/coaching-engine/routes.ts:47-52` reads:
```ts
router.post('/cron/weekly-review', async (c) => {
  const authHeader = c.req.header('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  ...
```
This is the fail-closed form (confirmed by direct read, matching the requested check) — the critical finding from `44-REVIEW.md` (CR-01) is fixed, and a dedicated regression test (`CRON_SECRET unset fails closed`) now exists and passes.

### Human Verification Required

None. The one item that required human/device verification (Plan 44-08 Task 3's 8-step device checklist covering the reveal overlay + interactive-chat `create_goal` reaching the real orchestrator) was approved by the user on 2026-09-04, per the task context — treated as closed, not re-tested here.

### Gaps Summary

No blocking gaps. All 5 phase success criteria are verified against actual shipped code (not SUMMARY claims): real-activity comparison, AI decision with escalate/de-escalate independent of onboarding profile, DB-enforced exactly-once idempotency via unique partial index + RPC early-return, opex-only cost logging via the `source` column with zero credit-gate coupling, and a single shared `create_goal`/`create_program` write path reachable identically from the cron and from interactive chat via the shared tool registry.

The three warnings from `44-REVIEW.md` (WR-01/02/03) remain unresolved in the code exactly as the review found them — this is expected and was a deliberate user decision to leave open, not a regression or an oversight in this verification pass.

The 27 pre-existing backend test failures in `test/coach/*`/`test/rls/*` (missing `.env.test` credentials) are a known environment gap predating this phase and are not counted against it.

---

_Verified: 2026-09-04_
_Verifier: Claude (gsd-verifier)_
