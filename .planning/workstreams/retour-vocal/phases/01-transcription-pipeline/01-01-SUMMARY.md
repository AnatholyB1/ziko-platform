---
phase: 01-transcription-pipeline
plan: 01
subsystem: testing
tags: [vitest, testing-library, happy-dom, proxy, multipart, tdd, red-stubs]

# Dependency graph
requires: []
provides:
  - Binary-safe multipart proxy route (arrayBuffer passthrough, boundary preserved)
  - 4 RED test stubs for Wave 0 vocal feature contracts
  - Vitest config updated for .tsx tests with happy-dom environment
  - Test deps installed: @testing-library/react, @testing-library/user-event, happy-dom, @vitejs/plugin-react
affects: [01-02, 01-03, 01-04, 01-05]

# Tech tracking
tech-stack:
  added:
    - "@testing-library/react ^16.0.0"
    - "@testing-library/user-event ^14.5.2"
    - "happy-dom ^15.0.0"
    - "@vitejs/plugin-react ^4.3.1"
  patterns:
    - "RED-first TDD: import from non-existent module triggers module-not-found failure"
    - "isMultipart branch in proxy: detect multipart/form-data, use arrayBuffer() to preserve binary"
    - "vitest environmentMatchGlobs: tsx files use happy-dom, ts files stay in node"

key-files:
  created:
    - apps/web/src/components/coach/vocal/useVocalRecorder.test.ts
    - apps/web/src/components/coach/vocal/useVocalTimer.test.ts
    - apps/web/src/components/coach/vocal/vocalReducer.test.ts
    - apps/web/src/components/coach/vocal/VocalReview.test.tsx
  modified:
    - apps/web/src/app/api/coach/[...path]/route.ts
    - apps/web/vitest.config.ts
    - apps/web/package.json

key-decisions:
  - "Use req.arrayBuffer() for multipart bodies; forward original Content-Type verbatim to preserve boundary"
  - "RED stubs import from non-existent source files — fails with Cannot-find-module, not syntax error"
  - "environmentMatchGlobs targets *.test.tsx for happy-dom; default remains node"

patterns-established:
  - "Pattern 1: isMultipart detection before building headers — never construct new multipart boundary"
  - "Pattern 2: vocal/ component directory at apps/web/src/components/coach/vocal/"
  - "Pattern 3: RED stubs declared with clear comment 'does not exist yet, Wave N'"

requirements-completed: [VOICE-01, VOICE-02, VOICE-03]

# Metrics
duration: 12min
completed: 2026-05-26
---

# Phase 01-transcription-pipeline Plan 01: Foundation Summary

**Binary proxy fixed to pass multipart/form-data as arrayBuffer + 4 RED TDD stubs for vocal Wave 0 contracts established**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-26T10:10:00Z
- **Completed:** 2026-05-26T10:22:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Proxy route now detects `multipart/form-data` via `isMultipart` and reads body as `arrayBuffer()` — prevents silent audio corruption
- Original `Content-Type` header (including boundary) forwarded verbatim to Hono upstream
- Vitest picks up `.tsx` test files and applies `happy-dom` environment via `environmentMatchGlobs`
- 4 test stubs placed in `apps/web/src/components/coach/vocal/` — all fail RED with `Cannot find module` (no false greens)
- Test deps installed: `@testing-library/react`, `@testing-library/user-event`, `happy-dom`, `@vitejs/plugin-react`

## Task Commits

1. **Task 1: Fix binary proxy bug + update vitest config + add test deps** - `e3cbcfb` (feat)
2. **Task 2: Create 4 frontend test stubs (RED state)** - `9dfc873` (test)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `apps/web/src/app/api/coach/[...path]/route.ts` - isMultipart branch + arrayBuffer() for binary upload safety
- `apps/web/vitest.config.ts` - tsx glob + environmentMatchGlobs happy-dom + @vitejs/plugin-react plugin
- `apps/web/package.json` - added 4 test devDependencies
- `apps/web/src/components/coach/vocal/useVocalRecorder.test.ts` - RED stub: blob capture + mimeType negotiation
- `apps/web/src/components/coach/vocal/useVocalTimer.test.ts` - RED stub: auto-stop at 300s + mm:ss formatting
- `apps/web/src/components/coach/vocal/vocalReducer.test.ts` - RED stub: all 7 state machine transitions
- `apps/web/src/components/coach/vocal/VocalReview.test.tsx` - RED stub: transcript render + Valider/Relancer buttons

## Decisions Made
- Used `req.arrayBuffer()` (not `req.formData()`) for multipart bodies so the binary stream is passed through unchanged to Hono
- Content-Type forwarded verbatim from `req.headers.get('Content-Type')` — never rebuilt — to preserve the boundary parameter
- RED stubs import from non-existent files (preferred over `throw new Error`) to validate the import contract

## Deviations from Plan
None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Wave 0 RED gate satisfied: 4 stubs exist and fail cleanly
- Proxy unblocks Wave 1 backend (Plan 01-02): Hono `/coach/voice/transcribe` can now receive binary audio
- Plans 01-02 through 01-05 can proceed in order

---
*Phase: 01-transcription-pipeline*
*Completed: 2026-05-26*
