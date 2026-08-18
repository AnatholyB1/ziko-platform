---
phase: 04-review-commit
plan: 03
subsystem: frontend
tags: [react, next-intl, state-machine, commit-flow, logic-only]

# Dependency graph
requires:
  - phase: 04-review-commit (04-01)
    provides: Working RTL infra + 9 Onboarding i18n keys (step4Review*, step4Commit*) consumed by t() calls added in this plan
  - phase: 04-review-commit (04-02)
    provides: The RED test harness (WizardStep4Import.test.tsx, 6 tests) this plan's logic must eventually satisfy once 04-04 wires up rendering
provides:
  - "FileState.parsedData/commitStatus/commitError fields, persisted for all four ready-branch classification outcomes (D-11)"
  - "view/reviewPhase state machine plus reviewDocs/committableCount/committedCount derived values (D-01, D-07)"
  - "setDocType(fileId, next) — coach type correction, clears commitStatus/commitError (D-06)"
  - "commitDoc(fileId, fileState) — never-throwing PUT /commit call; 409-with-program_id treated as success (D-08/D-09)"
  - "handleConfirm() — batches commitStatus:'pending' then Promise.all over commitDoc for all template_programme docs (D-08)"
  - "retryCommit(fileId) — single-doc scoped retry, no batch control (D-09)"
  - "Completion useEffect — reviewPhase 'committing' -> 'done' -> setTimeout(onSuccess, 1500) once every committable doc is committed (D-10)"
affects: [04-review-commit (04-04 wires the review screen JSX to every function/state variable listed above by name)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Derived-boolean idiom reused for reviewDocs/committableCount/committedCount — plain .filter().length recomputed every render, matching the existing canAdvance pattern, no useMemo"
    - "Never-throwing async handler + functional setFileStates idiom extended from runPipeline to commitDoc — catch-all try/catch, no rejection ever reaches Promise.all"

key-files:
  created: []
  modified:
    - apps/web/src/components/coach/WizardStep4Import.tsx

key-decisions: []

requirements-completed: [REVIEW-02, REVIEW-03, COMPLETE-02]

# Metrics
duration: ~10min
completed: 2026-08-12
---

# Phase 04 Plan 03: Review/Commit Logic Layer Summary

**Added the Phase 4 state machine and commit logic to `WizardStep4Import.tsx` (parsed_data persistence, review view state, parallel commit with per-doc retry, and the reactive 1500ms auto-redirect effect) with zero JSX changes — a pure logic layer mirroring Phase 3's own 03-01/03-02 split.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-08-12T17:42:33Z
- **Completed:** 2026-08-12T17:47:34Z
- **Tasks:** 2 completed
- **Files modified:** 1 (`apps/web/src/components/coach/WizardStep4Import.tsx`)

## Accomplishments

- **Task 1 (D-11):** Extended `FileState` with `parsedData?: Record<string, unknown>`, `commitStatus?: CommitStatus`, `commitError?: string`. Captured `importRow.parsed_data` verbatim as `rawParsedData` (double-cast through `unknown`, per 04-RESEARCH.md Pattern 1/Pitfall 1) at the top of the `ready`-branch and threaded it into all four `setFileStates` outcomes (null-confidence-ambiguous, `<0.4` da_coach, `>=0.6` template_programme, and the `0.4–0.6` ambiguous else-branch) — not just the confident-template path, since an ambiguous or da_coach doc can be coach-corrected to `template_programme` on the review screen and needs its parsed data at commit time.
- **Task 2 (D-06–D-10):** Added the full review/commit logic layer:
  - `view: 'import' | 'review'` and `reviewPhase: 'editing' | 'committing' | 'done'` state (D-01/D-02)
  - `reviewDocs`, `committableCount`, `committedCount` — plain derived expressions, no memoization (D-04/D-07)
  - `setDocType(fileId, next)` — pill-toggle type correction that resets `commitStatus`/`commitError` on change but does not touch chat messages (D-06)
  - `commitDoc(fileId, fileState)` — fires `PUT {apiUrl}/coach/imports/{importId}/commit` with `{ parsed_data }` and the caller's Bearer JWT; never throws; treats `409` with a truthy `program_id` in the response body as success (idempotent retry, matches Pitfall 2); guards on missing `importId`/`parsedData` without a recovery fetch
  - `handleConfirm()` — marks every `template_programme` doc `commitStatus: 'pending'` in one batched update before firing `Promise.all(toCommit.map(commitDoc))`, and does not inspect `fileStates` after the await (avoids the stale-closure anti-pattern from 04-RESEARCH.md)
  - `retryCommit(fileId)` — sets `commitStatus: 'pending'` synchronously (so the button disables itself before the fetch starts) then calls `commitDoc` for that one doc only; no batch "retry all" exists anywhere in the file
  - A completion `useEffect` (deps `[fileStates, reviewPhase, onSuccess]`) that gates on `reviewPhase === 'committing'`, `.every(f => f.commitStatus === 'committed')` across committable docs (never on "at least one started," per Pitfall 3), sets `reviewPhase: 'done'`, and schedules `setTimeout(onSuccess, 1500)` with a `clearTimeout` cleanup

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend FileState and persist full parsed_data in the polling closure (D-11)** — `cdef37a` (feat)
2. **Task 2: Add review view state, commit functions, and the completion effect (D-06 to D-10)** — `a0bc4a6` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified

- `apps/web/src/components/coach/WizardStep4Import.tsx` — Task 1 added 9 lines (type extension + 4 `parsedData` threads); Task 2 added 102 lines (state, derived values, 4 functions, 1 effect). Zero changes inside the component's `return (` JSX block (verified: all diff hunks end at line 384, JSX return starts at line 533).

## Decisions Made

None beyond what the plan specified — implementation followed 04-RESEARCH.md Patterns 1-3 and the plan's exact function signatures verbatim (no deviations needed).

## Deviations from Plan

None — plan executed exactly as written. All acceptance-criteria greps and the `tsc --noEmit` gate passed on the first implementation pass with no fix-up iterations required.

## Verification Evidence

- `grep -c "parsedData: rawParsedData"` → `4` (required: exactly 4)
- `grep -c "commitStatus?: CommitStatus"` → `1`, `grep -c "commitError?: string"` → `1`, `grep -c "parsedData?: Record<string, unknown>"` → `1`
- `npx tsc --noEmit 2>&1 | grep -c "WizardStep4Import"` → `0` (both after Task 1 and after Task 2)
- `grep -c "setTimeout(onSuccess, 1500)"` → `1`
- `grep -c 'coach/imports/\${fileState.importId}/commit'` → `1`
- `grep -c "Promise.allSettled"` → `0`; `grep -c "retryAll\|retryAllCommits"` → `0`
- `git diff` hunk boundaries confirmed all changes are above the JSX `return (` (line 533) — zero JSX touched
- `res.status === 409` present with a `program_id` check inside that branch setting `commitStatus: 'committed'`
- `cd apps/web && npx vitest run` → 7 pre-existing test files / 60 tests pass unaffected; `WizardStep4Import.test.tsx` (6 tests, from plan 04-02) fails exactly as expected — all 6 failures are the same "review screen element not found" assertions documented in 04-02-SUMMARY.md's Expected Failure Messages table, no new failure modes introduced (no `TypeError`, no `unmocked fetch:`, no timeout)

## Known Stubs

None. This is a logic-only plan by design — the functions/state added here have no JSX consumer yet (that's plan 04-04's scope), so nothing renders a stub; nothing renders at all for the new code paths. `noUnusedLocals` is not enabled in `apps/web/tsconfig.json`, so the currently-unreferenced `view`, `reviewPhase`, `reviewDocs`, `committableCount`, `committedCount`, `setDocType`, `handleConfirm`, `retryCommit` do not break the type-check, exactly as anticipated by the plan.

## Issues Encountered

None. Both tasks' verification commands passed on the first attempt with no debugging required.

## User Setup Required

None.

## Next Phase Readiness

- Plan 04-04 has a complete, type-checked set of handlers to wire into JSX by name: `view`, `setView`, `reviewPhase`, `reviewDocs`, `committableCount`, `committedCount`, `setDocType`, `handleConfirm`, `retryCommit`, and per-doc `commitStatus`/`commitError`/`parsedData` fields on `FileState`.
- The existing "Continuer →" button still calls `onSuccess` directly (Phase 3 wiring, unchanged in this plan) — 04-04 must intercept that click to call `setView('review')` instead (D-01), per 04-02-SUMMARY.md's documented RED failure for the `skip on review screen exits without committing` test.
- 04-04's GREEN target is the exact failure-message table already published in 04-02-SUMMARY.md; no changes to that target were introduced by this plan.
- No blockers for 04-04.

---
*Phase: 04-review-commit*
*Completed: 2026-08-12*

## Self-Check: PASSED

- FOUND: apps/web/src/components/coach/WizardStep4Import.tsx
- FOUND: commit cdef37a
- FOUND: commit a0bc4a6
