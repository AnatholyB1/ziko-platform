---
phase: 04-review-commit
plan: 02
subsystem: testing
tags: [vitest, testing-library, react-testing-library, next-intl, fake-timers, fetch-mocking, tdd-red]

# Dependency graph
requires:
  - phase: 04-review-commit (04-01)
    provides: Working RTL infra (@testing-library/dom materialized) + 9 Onboarding i18n keys (fr+en) the review/commit copy depends on
provides:
  - "apps/web/src/components/coach/WizardStep4Import.test.tsx — 6 named RED tests covering REVIEW-01, REVIEW-02, REVIEW-03, COMPLETE-01, COMPLETE-02, and D-09 (per-doc retry isolation)"
  - "A fetch-router test harness (vi.stubGlobal('fetch') + order-independent per-import-id dispatch table) reusable as a reference pattern for future .test.tsx files that mock the 6-call import pipeline"
  - "Exact expected failure messages for each test — the GREEN target plan 04-04 must satisfy"
affects: [04-review-commit (04-03 persists parsed_data on FileState; 04-04 implements the review screen and must turn these 6 tests GREEN)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vi.stubGlobal('fetch', vi.fn(routerImpl)) with an order-independent, URL+method dispatch table — first fetch-mocking pattern in this codebase (04-RESEARCH.md confirmed 'No Analog Found')"
    - "driveToReview() helper: act(selectFiles) -> act(advanceTimersByTimeAsync(3000)) -> act(click Continuer) — drives a multi-step async pipeline under fake timers without waitFor/userEvent"
    - "Per-import-id commitHandlers record, swappable mid-test (deferred promises for parallelism assertions, sync-resolved promises for pass/fail scenarios) — enables isolating retry/parallel-commit behavior without a call-sequence array"

key-files:
  created:
    - apps/web/src/components/coach/WizardStep4Import.test.tsx
  modified: []

key-decisions:
  - "Split the single test file into two atomic commits mirroring the plan's two tasks (harness + 3 render-level tests, then 3 commit-flow tests) rather than one combined commit — kept task-level commit granularity even though both tasks target the same file"

requirements-completed: []

# Metrics
duration: ~25min
completed: 2026-08-12
---

# Phase 04 Plan 02: Wave 0 RED Test Harness for Review/Commit Screen Summary

**Built the fetch-mocking RTL test harness the codebase previously lacked and wrote 6 named RED tests (REVIEW-01/02/03, COMPLETE-01/02, D-09) that drive `WizardStep4Import` through the full 6-call import pipeline up to the not-yet-built review screen — every test fails on a clean, review-screen-naming assertion, setting the GREEN target for plan 04-04.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-12T17:23:26Z
- **Completed:** 2026-08-12T17:35:00Z
- **Tasks:** 2 completed
- **Files modified:** 1 (`apps/web/src/components/coach/WizardStep4Import.test.tsx`, created)

## Accomplishments

- Created `apps/web/src/components/coach/WizardStep4Import.test.tsx` — the first test file in this codebase to mock `global.fetch` (`04-RESEARCH.md` confirmed "No Analog Found" for this pattern).
- `routerImpl(input, init)` dispatch table handles all 6 pipeline calls (create import, signed-URL upload, status, parse, poll, commit) keyed by URL pattern + HTTP method, order-independent so two files' pipelines can interleave freely; any unmatched route throws `unmocked fetch: ...` so a missed route fails loudly instead of hanging.
- `driveToReview()` helper reliably drives the component from empty state through file selection, the 3000ms poll tick, and the `"Continuer →"` click entirely inside `act()` + `vi.advanceTimersByTimeAsync`, with zero use of `waitFor` or `userEvent` per the plan's fake-timer constraints (both confirmed absent via `grep -c`).
- Six named tests collected and executed (verified via `grep -Ec` against the plan's exact required substrings — returned `12` against the union pattern, `>= 6` required):
  1. `renders a consolidated review list of every analysed doc` (REVIEW-01)
  2. `type correction updates count and the live commit set` (REVIEW-02)
  3. `skip on review screen exits without committing` (COMPLETE-01)
  4. `parallel commit fires only for template docs` (REVIEW-03, D-08, D-11)
  5. `auto-redirect after commit` (COMPLETE-02)
  6. `per-doc retry isolation` (D-09)
- The commit-body deep-equality assertion (`expect(JSON.parse(String(templateInit.body))).toEqual({ parsed_data: TEMPLATE_PARSED })`) proves the D-11 requirement under test: the FULL `parsed_data` object (`overall_confidence`, `name`, `weeks`) must be persisted, not just the narrowed display fields.
- The 1500ms redirect hold is asserted at both boundaries: unchanged at 1400ms, fires at exactly 1500ms (`grep -Ec "advanceTimersByTimeAsync(1500)|advanceTimersByTimeAsync(1400)"` returned `3`, `>= 2` required).
- Full `apps/web` suite: 7 other test files / 60 tests still pass unaffected; only the new file's 6 tests fail (RED, as designed).

## Expected Failure Messages (GREEN target for plan 04-04)

| # | Test name | Current (RED) failure |
|---|-----------|------------------------|
| 1 | `renders a consolidated review list of every analysed doc` | `TestingLibraryElementError: Unable to find an element with the text: Vérifie tes documents avant l'import.` |
| 2 | `type correction updates count and the live commit set` | `TestingLibraryElementError: Unable to find an element with the text: 1 programme sera importé.` |
| 3 | `skip on review screen exits without committing` | `AssertionError: expected "spy" to not be called at all, but actually been called 1 times` — the current `"Continuer →"` button still calls `onSuccess` directly (Phase 3 wiring); plan 04-04 must intercept this click to swap to the review view instead (D-01). |
| 4 | `parallel commit fires only for template docs` | `TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Template programme"` (on the review screen's pill toggle, not the chat-bubble pill from Phase 3) |
| 5 | `auto-redirect after commit` | `TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Confirmer et importer"` |
| 6 | `per-doc retry isolation` | `TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Template programme"` |

All six failures are clean, review-screen-naming assertion errors — no timeouts, no `TypeError`, no `unmocked fetch:`, no `Cannot find module`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the test harness and the three render-level tests (REVIEW-01, REVIEW-02, COMPLETE-01)** — `1dbb144` (test)
2. **Task 2: Add the commit-flow tests (REVIEW-03, COMPLETE-02, D-09)** — `af72737` (test)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified

- `apps/web/src/components/coach/WizardStep4Import.test.tsx` — new file, 315 lines. Contains `vi.stubGlobal('fetch'` (harness marker), zero `waitFor`, zero `userEvent`, a deep-equal assertion on the commit body containing the literal `overall_confidence`, and both `advanceTimersByTimeAsync(1400)`/`advanceTimersByTimeAsync(1500)` boundary assertions.

## Decisions Made

- Split the single test file's content across two commits to mirror the plan's two-task structure (Task 1: harness + 3 render-level tests; Task 2: 3 commit-flow tests appended) — written and verified as a task-1-only file first, committed, then extended and re-verified for Task 2, rather than writing the complete file once and committing it as a single change. This preserves per-task commit granularity and per-task verification evidence even though both tasks touch the same file.
- Used `Promise`-based deferred handles (`new Promise((resolve) => { resolveTemplate = resolve; })`) rather than a third-party deferred utility for the parallel-commit test's "assert 2 calls before either resolves" check — no new dependency, matches the plan's `{ promise, resolve }` deferred instruction.
- For the "second render" sub-case in `parallel commit fires only for template docs` (verifying `da_coach` docs never hit `/commit`), reset `commitHandlers` to `defaultCommitHandlers()` before the second `renderStep4` call and diffed the fetch mock's call list by index (`fetchMockCalls().length` boundary) rather than by call content, since both renders derive the same deterministic import IDs (`imp-template`/`imp-da`) from the fixed filenames — index-slicing isolates "this render's calls" cleanly without needing per-render unique IDs.

## Deviations from Plan

None — plan executed exactly as written. Both `<verify>` commands from the plan were run verbatim and their `grep -Ec` outputs matched or exceeded the required thresholds (Task 1: `6 >= 3`; Task 2: `12 >= 6`). All acceptance-criteria greps (`waitFor` count 0, `userEvent` count 0, `vi.stubGlobal('fetch'` present, `overall_confidence` present, 1400/1500ms boundary count 3) passed without modification.

## Issues Encountered

None. The harness worked on the first full run — no debugging of the mock router or timer-advancement sequencing was needed. The one non-obvious verification point was confirming that `await act(async () => { fireEvent.click(...) })` alone (without an explicit inner `await`) is sufficient to flush the multi-hop microtask chain from `fetch` → `res.json()` → `setFileStates` → `useEffect` for the default (non-deferred) `commitHandlers` case in `auto-redirect after commit` — verified true by the resulting failure message showing the code reached the review-screen-button lookup rather than stalling mid-pipeline.

## User Setup Required

None.

## Next Phase Readiness

- Plan 04-03 (persist `parsed_data` on `FileState`) and plan 04-04 (build the review screen) now have a concrete, already-passing-elsewhere-in-the-suite RED harness to target. `npx vitest run src/components/coach/WizardStep4Import.test.tsx -t "<test name>"` isolates any single requirement during 04-04 development.
- The exact failure-message table above is the GREEN target: 04-04 is done when all six tests in this file pass and the rest of the suite (`npm run test`, 7 files / 60 tests as of this plan) remains green.
- No blockers for 04-03 or 04-04.

---
*Phase: 04-review-commit*
*Completed: 2026-08-12*

## Self-Check: PASSED

- FOUND: apps/web/src/components/coach/WizardStep4Import.test.tsx
- FOUND: commit 1dbb144
- FOUND: commit af72737
