---
phase: 04-review-commit
plan: 01
subsystem: testing
tags: [vitest, testing-library, react-testing-library, next-intl, i18n, icu-plural]

# Dependency graph
requires:
  - phase: 04-review-commit (04-UI-SPEC.md, 04-PATTERNS.md)
    provides: Copywriting Contract (locked French copy) and 8/9-key i18n table for the review/commit screens
provides:
  - Working RTL test infrastructure (`@testing-library/dom` materialized) — `render`/`screen` no longer crash at module load
  - Nine new Onboarding-namespace i18n keys (fr+en) for the Phase 4 review/commit screens, including two ICU plural strings
affects: [04-review-commit (all subsequent plans in this phase), any future plan adding `.test.tsx` files anywhere in apps/web]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ICU plural syntax `{count, plural, =0 {...} one {...} other {...}}` in next-intl message files (first use in this codebase)"

key-files:
  created: []
  modified:
    - package-lock.json
    - apps/web/messages/fr.json
    - apps/web/messages/en.json

key-decisions:
  - "04-RESEARCH.md/04-VALIDATION.md's claim that no framework install was needed was incorrect — @testing-library/dom was declared in apps/web/package.json devDependencies but never materialized in node_modules; fixed via root `npm install` (manifest-reconciliation, not a new install) rather than editing the manifest"

patterns-established:
  - "ICU plural for count-dependent i18n strings via next-intl's native `{count, plural, ...}` syntax — no new dependency required"

requirements-completed: [REVIEW-01, REVIEW-02, REVIEW-03, COMPLETE-02]

# Metrics
duration: ~10min
completed: 2026-08-12
---

# Phase 04 Plan 01: Test Infra Fix + i18n Keys Summary

**Materialized the undeclared-but-uninstalled `@testing-library/dom` peer dependency via root `npm install` (fixing a real RTL module-resolution crash), and added nine locked-copy Onboarding i18n keys (fr+en, including two ICU plural strings) needed by the upcoming review/commit screens.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-08-12T17:07:38Z
- **Completed:** 2026-08-12T17:16:49Z
- **Tasks:** 2 completed
- **Files modified:** 3 (package-lock.json, apps/web/messages/fr.json, apps/web/messages/en.json)

## Accomplishments

- Fixed a real, verified test-infrastructure bug: `VocalReview.test.tsx` was failing at module load with `Cannot find module '@testing-library/dom'` even though the package was declared (`^10.0.0`) in `apps/web/package.json` devDependencies — it had simply never been installed into `node_modules`. Root `npm install` materialized it (hoisted to root `node_modules/@testing-library/dom`); `apps/web/package.json` remains byte-identical (verified via empty `git diff --stat`).
- Full `apps/web` vitest suite now green: 7 test files, 60 tests, 0 failures (was 6 passing / 1 failing to load before this plan).
- Added all 9 required Onboarding-namespace keys (`step4ReviewHeading`, `step4ReviewSubtitle`, `step4ReviewNoAction`, `step4ReviewCount`, `step4ReviewConfirm`, `step4CommitError`, `step4CommitRetry`, `step4CommitRetryAria`, `step4CommitSuccess`) to both `fr.json` and `en.json`, with fr/en key-set parity verified programmatically.
- `step4ReviewCount` and `step4CommitSuccess` use ICU plural syntax (`{count, plural, ...}`) — the first use of ICU plural anywhere in these message files; confirmed native to the already-installed next-intl v4.8.3 (no new dependency).

## Task Commits

Each task was committed atomically:

1. **Task 1: Materialize the missing @testing-library/dom peer dependency** - `366628e` (fix)
2. **Task 2: Add the nine Phase 4 i18n keys to fr.json and en.json** - `1418c85` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `package-lock.json` - Reconciled to materialize the already-declared `@testing-library/dom@^10.0.0` devDependency into `node_modules` (100 insertions, 60 deletions; no new manifest entries)
- `apps/web/messages/fr.json` - Added 9 Onboarding keys after `step4Continue` (locked French copy per 04-UI-SPEC.md)
- `apps/web/messages/en.json` - Added the same 9 Onboarding keys with English values

## Decisions Made
- Confirmed and corrected an incorrect assumption in `04-RESEARCH.md`/`04-VALIDATION.md` ("no framework install needed — Vitest, RTL, and happy-dom are already devDependencies"). This was false for `@testing-library/dom`: declared in the manifest but absent from `node_modules` everywhere in the monorepo. Fixed via a manifest-reconciliation `npm install` at the repo root rather than an `apps/web`-scoped install or a manifest edit, per the plan's supply-chain constraint (T-04-SC) — verified with an empty `git diff --stat apps/web/package.json`.
- Used the plan's exact locked French copy and the plan-specified English copy verbatim; no additional i18n keys were added beyond the 9 specified (`step4ReviewSkip` deliberately omitted per plan — it reuses the existing `step4Skip` key).

## Deviations from Plan

None - plan executed exactly as written. The Task 1 action's contingency step ("if not resolved after step 1, run a scoped `npm install --workspace apps/web`") was not needed — the root `npm install` alone resolved `@testing-library/dom` for `apps/web`.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- RTL test infrastructure is confirmed working monorepo-wide; any future `.test.tsx` file using `render`/`screen` will resolve correctly.
- All 9 i18n keys the upcoming review/commit screen implementation depends on now exist in both locales with verified fr/en parity and correct ICU plural syntax on the two count-dependent keys.
- No blockers for subsequent Phase 4 plans.

---
*Phase: 04-review-commit*
*Completed: 2026-08-12*

## Self-Check: PASSED

- FOUND: apps/web/messages/fr.json
- FOUND: apps/web/messages/en.json
- FOUND: package-lock.json
- FOUND: commit 366628e
- FOUND: commit 1418c85
