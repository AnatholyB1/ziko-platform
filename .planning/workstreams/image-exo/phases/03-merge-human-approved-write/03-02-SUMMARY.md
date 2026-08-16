---
phase: 03-merge-human-approved-write
plan: 02
subsystem: infra
tags: [sharp, image-processing, retry, vitest, exercise-import]

# Dependency graph
requires:
  - phase: 02-download-match-dry-run
    provides: exercise-import pipeline module-system conventions (lib/normalize.ts shape, README.md "Module System" constraints)
provides:
  - "capImage/capGif: pure Buffer -> Buffer 180x180 media cap enforcement (MEDIA-03)"
  - "withRetry: bounded exponential-backoff retry helper (D-07) for merge.ts's Storage/DB write call sites"
  - "sharp@0.34.5 pinned as explicit root dependency"
affects: [03-merge-row-plan, 03-05-merge-entrypoint]

# Tech tracking
tech-stack:
  added: ["sharp@0.34.5 (explicit root dependency, was already hoisted transitively via apps/web)"]
  patterns: ["Pure Buffer -> Buffer media transform with no I/O", "Hand-rolled bounded retry with exponential backoff for a small (2-3 call-site) transient-failure surface"]

key-files:
  created:
    - scripts/exercise-import/lib/media.ts
    - scripts/exercise-import/lib/media.test.ts
    - scripts/exercise-import/lib/retry.ts
    - scripts/exercise-import/lib/retry.test.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "sharp pinned at exact 0.34.5 (no caret) as an explicit root dependency, matching the fastest-levenshtein exact-pin convention, even though it already resolved transitively via apps/web's Next.js tree"
  - "Animated-GIF test fixtures built via sharp's array-input join API (sharp([buf1, buf2, ...], { join: { animated: true } })) rather than a manual composite-and-stack approach, which silently collapsed to a single page"

patterns-established:
  - "capImage/capGif: fit:'inside' + withoutEnlargement:true is the mandatory resize-option pair for any future media-cap work in this pipeline"
  - "withRetry is reserved for network-class I/O (Storage uploads, DB writes) only — never wrapped around pure in-memory work like sharp resizes"

requirements-completed: [MEDIA-03]

# Metrics
duration: ~30min active execution (session interrupted between Task 1 and Task 2 commits)
completed: 2026-08-16
---

# Phase 3 Plan 2: Media Cap & Retry Utilities Summary

**Pure `capImage`/`capGif` functions enforcing MEDIA-03's 180x180 ceiling via sharp, plus a hand-rolled `withRetry` exponential-backoff helper for merge.ts's upload/write call sites.**

## Performance

- **Duration:** ~30 min active execution
- **Tasks:** 2 completed
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments
- `sharp@0.34.5` promoted from transitive to explicit root dependency, exact-pinned per repo convention
- `lib/media.ts`: `capImage`/`capGif` structurally enforce the 180x180 license ceiling — `fit: 'inside'` + `withoutEnlargement: true` guarantee no upscale and no dimension overflow; `capGif` preserves GIF animation via `{ animated: true }` (Pitfall 6 documented inline)
- `lib/retry.ts`: `withRetry` — 3 attempts, 500ms/1000ms exponential backoff, rethrows the last error, no delay after the final attempt
- 16 new unit tests (8 media, 8 retry), all passing; full `npm run test:import` suite green (106 tests, 8 files, zero regressions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add sharp as an explicit root dependency and build lib/media.ts** - `aea3c2e` (feat)
2. **Task 2: Build lib/retry.ts with bounded exponential backoff** - `84031fd` (feat)

_Note: tdd="true" tasks here were executed as a single test+implementation commit per task rather than split RED/GREEN commits, since both plan-level TDD gate enforcement and MVP+TDD runtime gating did not apply to this phase — tests and implementation were written together and verified green before each commit._

## Files Created/Modified
- `scripts/exercise-import/lib/media.ts` - `capImage`/`capGif`/`MEDIA_CAP_PX`, pure sharp-based 180x180 cap enforcement
- `scripts/exercise-import/lib/media.test.ts` - 8 tests: cap ceiling, no-upscale (90x90 proof), exact-180 passthrough, PNG format, animated-GIF page preservation, GIF format
- `scripts/exercise-import/lib/retry.ts` - `withRetry`/`RETRY_ATTEMPTS`/`RETRY_BASE_DELAY_MS`
- `scripts/exercise-import/lib/retry.test.ts` - 8 tests under `vi.useFakeTimers()`: attempt counts, exact 500/1000ms backoff timing, last-error propagation, no post-final-attempt delay, argument overrides
- `package.json` - added `sharp: "0.34.5"` to `dependencies`
- `package-lock.json` - regenerated via `npm install sharp@0.34.5 --package-lock-only`, then hand-aligned the root package's `sharp` range from `^0.34.5` to the exact `0.34.5` pin to match `package.json`

## Decisions Made
- Used `npm install sharp@0.34.5 --package-lock-only` (no full `node_modules` reinstall) since sharp already resolved via the parent repo's hoisted `node_modules` — avoided a redundant network install and any risk of a parallel-worktree `node_modules` race with sibling plans 03-01/03-03 running concurrently in their own worktrees
- npm's `--package-lock-only` install added `sharp` with a caret range (`^0.34.5`) in both `package.json` and `package-lock.json`; manually edited both to the exact `0.34.5` pin per the `fastest-levenshtein` precedent the plan's `<action>` explicitly called for
- Reworded the mandatory-option comments in `media.ts` from repeating the literal `fit: 'inside'`/`withoutEnlargement: true` substrings to paraphrased prose, because the original comment text was itself matched by the plan's `grep -c` acceptance check and inflated the count from 2 to 4

## Deviations from Plan

None - plan executed exactly as written. The `package.json`/`package-lock.json` caret-vs-exact-pin correction and the animated-GIF test-fixture construction (see below) were normal implementation problem-solving within the task's own action/behavior spec, not scope changes.

## Issues Encountered
- Initial animated-GIF test fixture (manually compositing frames into a tall canvas, then re-encoding with `sharp(stacked, { animated: true, pageHeight })`) silently collapsed to a single-page GIF — `sharp`'s animated encode path expects frame-per-input via the array-input `join` option, not a pre-stacked single buffer with a `pageHeight` hint on encode. Fixed by switching to `sharp([framePng1, framePng2, ...], { join: { animated: true, across: 1 } }).gif().toBuffer()`, which correctly produces a multi-page GIF (verified `pages > 1` on both the fixture and `capGif`'s output before finalizing the test).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `capImage`/`capGif`/`MEDIA_CAP_PX` and `withRetry`/`RETRY_ATTEMPTS`/`RETRY_BASE_DELAY_MS` are exported exactly per the plan's target interfaces — ready for direct import by plan 03-04's `merge-row.ts`
- No blockers. `sharp` dependency and media/retry utilities are dependency-free of any Supabase/network code, matching the "pure function, caller supplies bytes" contract downstream merge logic requires

---
*Phase: 03-merge-human-approved-write*
*Completed: 2026-08-16*
