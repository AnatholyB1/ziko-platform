---
phase: 01-transcription-pipeline
plan: 04
subsystem: ui
tags: [react, typescript, mediarecroder, state-machine, vitest, vocal]

requires:
  - phase: 01-01
    provides: RED test stubs for vocalReducer, useVocalRecorder, useVocalTimer
  - phase: 01-03
    provides: backend route POST /api/coach/voice/transcribe

provides:
  - vocalReducer: pure state machine function + VocalState/VocalAction TypeScript types
  - useVocalRecorder: MediaRecorder factory hook with mimeType negotiation
  - useVocalTimer: timer factory with formatElapsed helper and auto-stop at 300s
  - VocalRetourPanel: state machine root component with upload to /api/coach/voice/transcribe

affects: [01-05-plan, retour-vocal-wave-3]

tech-stack:
  added: []
  patterns:
    - "Factory pattern for browser API hooks: useVocalRecorder/useVocalTimer return plain objects, not React state — tests work without renderHook"
    - "useReducer + discriminated union: VocalState exhaustive switch in vocalReducer.ts"
    - "Stable ref pattern for circular deps: handleStopRef prevents stale closure in onAutoStop"

key-files:
  created:
    - apps/web/src/components/coach/vocal/vocalReducer.ts
    - apps/web/src/components/coach/vocal/useVocalRecorder.ts
    - apps/web/src/components/coach/vocal/useVocalTimer.ts
    - apps/web/src/components/coach/vocal/VocalRetourPanel.tsx
  modified:
    - apps/web/src/components/coach/vocal/useVocalRecorder.test.ts

key-decisions:
  - "Factory pattern over React hook for useVocalRecorder/useVocalTimer — tests call them without renderHook (Wave 0 stubs designed this way)"
  - "Dual timer: useVocalTimer factory handles auto-stop logic; VocalRetourPanel has local React setInterval for elapsedSeconds state"
  - "VocalRetourPanel placeholder renders — data-testid attributes preserved for Plan 01-05 styled sub-components"

patterns-established:
  - "Discriminated union state machine: vocalReducer.ts as pure function, no React dependency"
  - "FormData upload without manual Content-Type — browser sets multipart boundary automatically"

requirements-completed: [VOICE-01, VOICE-02]

duration: 13min
completed: 2026-05-26
---

# Phase 01 Plan 04: Logic Layer Summary

**Pure vocalReducer state machine + MediaRecorder hook + timer factory + VocalRetourPanel orchestrator wiring FormData upload to /api/coach/voice/transcribe**

## Performance

- **Duration:** 13 min
- **Started:** 2026-05-26T10:50:45Z
- **Completed:** 2026-05-26T11:04:24Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `vocalReducer.ts` — pure state machine with all 7 transitions (idle→recording→transcribing→review/error, retry/relaunch/validate) + VocalState + VocalAction TypeScript types
- `useVocalRecorder.ts` — factory hook with mimeType negotiation via `MediaRecorder.isTypeSupported(['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', ''])`
- `useVocalTimer.ts` — factory with `start()`/`stop()`/`formatElapsed(seconds)`, auto-stop at 300s
- `VocalRetourPanel.tsx` — state machine root: useReducer + beforeunload guard (recording-only) + FormData upload + blob.size > 4MB warn
- All 3 Wave 0 test stubs GREEN (11 tests passing)

## Task Commits

1. **Task 1: vocalReducer + useVocalRecorder + useVocalTimer** — `25d95aa` (feat — files included in prior commit)
2. **Task 2: VocalRetourPanel** — `e7ba863` (feat)

**Plan metadata:** _(docs commit below)_

## Files Created/Modified

- `apps/web/src/components/coach/vocal/vocalReducer.ts` — Pure reducer function, VocalState + VocalAction types
- `apps/web/src/components/coach/vocal/useVocalRecorder.ts` — MediaRecorder factory with mimeType negotiation + mic release
- `apps/web/src/components/coach/vocal/useVocalTimer.ts` — Timer factory with auto-stop at 300s + mm:ss formatter
- `apps/web/src/components/coach/vocal/VocalRetourPanel.tsx` — State machine root component, FormData upload, beforeunload guard
- `apps/web/src/components/coach/vocal/useVocalRecorder.test.ts` — Added MediaRecorder + navigator mocks for node test environment

## Decisions Made

- **Factory pattern for hooks**: Wave 0 test stubs call `useVocalRecorder()` and `useVocalTimer({ onAutoStop })` directly without `renderHook` — the implementations are factory functions returning plain objects, making them testable in node environment without a React testing harness.
- **Dual timer approach**: `useVocalTimer` handles the auto-stop logic (interval + callback), while `VocalRetourPanel` maintains a separate React `useState` + `setInterval` for the `elapsedSeconds` display state. This separates concerns cleanly.
- **Stable ref for onAutoStop**: `handleStopRef` + `useCallback` prevents circular dependency between `handleStop` and `onAutoStop`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added MediaRecorder + navigator.mediaDevices mocks to useVocalRecorder.test.ts**
- **Found during:** Task 1 (running tests in node environment)
- **Issue:** Wave 0 test stub lacked browser API mocks — `MediaRecorder is not defined` + `Cannot read properties of undefined (reading 'getUserMedia')` errors in node test environment
- **Fix:** Added `MockMediaRecorder` class with `isTypeSupported`, `start()`, `stop()`, `ondataavailable`/`onstop` callbacks, and `Object.defineProperty` for `global.MediaRecorder` + `global.navigator.mediaDevices`
- **Files modified:** `apps/web/src/components/coach/vocal/useVocalRecorder.test.ts`
- **Verification:** Both recorder tests GREEN after fix
- **Committed in:** `25d95aa` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug in test stub)
**Impact on plan:** Required for correctness of test infrastructure. No scope creep.

## Issues Encountered

- `VocalReview.test.tsx` has a pre-existing TypeScript error (`Cannot find module './VocalReview'`) — this is a Wave 0 RED stub for Plan 01-05. Out of scope for this plan. TS check for vocal files passes when scoped to `VocalRetourPanel.tsx` and the 3 logic files.

## Known Stubs

- `VocalRetourPanel.tsx` placeholder renders — `<div data-testid="vocal-{status}">` divs are intentional stubs per plan spec. Plan 01-05 replaces them with styled `VocalIdle`, `VocalRecording`, `VocalTranscribing`, `VocalReview` sub-components.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 3 logic files exported and type-safe
- VocalRetourPanel orchestrates full flow: idle → recording → transcribing → review/error
- Wave 0 tests all GREEN
- Plan 01-05 can import and replace placeholder renders with styled sub-components

---
*Phase: 01-transcription-pipeline*
*Completed: 2026-05-26*
