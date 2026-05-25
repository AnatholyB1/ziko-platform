---
phase: 28-ai-file-imports
plan: 08
subsystem: testing
tags: [vitest, hono, mocking, ai-imports, unit-tests]

requires:
  - phase: 28-ai-file-imports/28-04
    provides: importsRouter (service.ts) with all 6 HTTP routes

provides:
  - All 10 requirement tests passing (IMPORT-01 through IMPORT-10)
  - imports.spec.ts with 8 implemented tests covering full route behavior
  - pdf.spec.ts and excel.spec.ts already passing from prior waves

affects:
  - Any future phase that modifies coach/imports service.ts or db.ts (regression suite)

tech-stack:
  added: []
  patterns:
    - "vi.mock hoisting pattern: use _mockImpl variable + fn wrapper to avoid before-initialization errors"
    - "Hono test pattern: importsRouter.request(path, { method, headers, body }) — no external test client"
    - "Admin Supabase mock: mock @supabase/supabase-js createClient at module level to prevent live calls on import"

key-files:
  created: []
  modified:
    - backend/api/test/coach/imports.spec.ts

key-decisions:
  - "Mocked all external dependencies (db, creditService, supabase-js, parse modules) to make tests hermetic"
  - "Used _mockStorageFromImpl indirection to avoid vi.fn() hoisting before-initialization error"
  - "IMPORT-09 diff algorithm implemented inline — PreviewClient.tsx diff is client-side, not backend-importable"
  - "Pre-existing Supabase auth rate limit failures in rls/ and identity.spec.ts are out-of-scope (not caused by plan 28-08)"

requirements-completed:
  - IMPORT-01
  - IMPORT-02
  - IMPORT-03
  - IMPORT-04
  - IMPORT-05
  - IMPORT-06
  - IMPORT-07
  - IMPORT-08
  - IMPORT-09
  - IMPORT-10

duration: 6min
completed: 2026-05-21
---

# Phase 28 Plan 08: Test Suite Implementation Summary

**8 Vitest tests replacing it.todo stubs in imports.spec.ts — full mock-based coverage of Hono route behavior for all 10 IMPORT requirements**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-21T16:29:22Z
- **Completed:** 2026-05-21T16:35:00Z
- **Tasks:** 3 completed + 1 checkpoint
- **Files modified:** 1

## Accomplishments

- Replaced all 7 `it.todo` stubs in `imports.spec.ts` with passing test implementations (1 was already passing from Wave 0)
- Implemented full mock stack: `@supabase/supabase-js`, `db.js`, `creditService.js`, all parse modules, auth middleware
- All 8 tests in imports.spec.ts pass; pdf.spec.ts and excel.spec.ts (IMPORT-07/08) were already passing from prior waves
- Backend/api TypeScript check exits 0 with no errors

## Task Commits

1. **Task 1: Implement imports.spec.ts — 8 passing tests** - `158dde8` (test)
2. **Task 2: pdf.spec.ts and excel.spec.ts** — already passing from Wave 2 (no changes needed)
3. **Task 3: Full test suite + TypeScript check** — verification only, no file changes

## Files Created/Modified

- `backend/api/test/coach/imports.spec.ts` - Replaced 7 it.todo stubs with full test implementations for IMPORT-01 through IMPORT-10 (excluding IMPORT-07/08 in parse/ files)

## Decisions Made

- Used `_mockStorageFromImpl` indirection pattern: Vitest hoists `vi.mock()` before variable initialization, so `mockStorageFrom = vi.fn()` causes a before-initialization error if referenced inside the mock factory. Solution: define a module-level `_mockImpl` variable and wrap it in a closure inside the mock factory.
- IMPORT-09 diff algorithm: the diff logic lives in `PreviewClient.tsx` (web, client-side) and is not importable from backend tests. Implemented inline in the test to verify the algorithm's correctness, consistent with the plan's guidance.
- `IMPORT-02` (credit-cost) was already implemented as a passing test in Wave 0 — preserved exactly as-is.

## Deviations from Plan

None - plan executed exactly as written.

The only unexpected finding was the vi.mock hoisting issue (ReferenceError: Cannot access before initialization), which was fixed inline via the `_mockStorageFromImpl` indirection pattern. This is a standard Vitest limitation documented in their mocking guide, not a codebase bug.

## Issues Encountered

**Supabase auth rate limits in pre-existing tests:** The full `npm test` suite shows failures in `test/rls/workout-programs.spec.ts` and `test/coach/identity.spec.ts` with `Error: getAuthedClient: Request rate limit reached`. These tests make real HTTP calls to Supabase Auth (not mocked) and fail due to Supabase's free-tier rate limits being hit during the test run. These failures are:
- Pre-existing (from Phase 22-24, before Plan 28-08)
- Not caused by our changes (confirmed via `git log` on those files)
- Environment-dependent (only fail when Supabase rate limit is active)
- Out of scope per deviation rule scope boundary

All import-related tests (`test/coach/imports.spec.ts`, `test/coach/parse/`) pass 100%.

## Known Stubs

None - all test assertions are real logic with proper mocks.

## Next Phase Readiness

- All 10 IMPORT requirements have automated test coverage
- Phase 28 is complete — human smoke test in Task 4 checkpoint is the final gate
- Phase 28 produced: 6 backend routes, web preview UI, mobile import screen, Supabase migration, credit deduction

---
*Phase: 28-ai-file-imports*
*Completed: 2026-05-21*
