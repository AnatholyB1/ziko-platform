---
plan: 03-03
status: complete
date: 2026-05-27
phase: "03"
subsystem: retour-vocal
tags: [frontend, state-machine, supabase, history]
dependency_graph:
  requires: [03-01]
  provides: [MEM-01-frontend, MEM-03]
  affects: [VocalRetourPanel, VocalCardReady, vocalReducer]
tech_stack:
  added: []
  patterns: [useEffect-cancel-pattern, closure-capture-for-async-state]
key_files:
  created:
    - apps/web/src/components/coach/vocal/VocalFeedbackHistory.tsx
  modified:
    - apps/web/src/components/coach/vocal/vocalReducer.ts
    - apps/web/src/components/coach/vocal/vocalReducer.test.ts
    - apps/web/src/components/coach/vocal/VocalCardReady.tsx
    - apps/web/src/components/coach/vocal/VocalRetourPanel.tsx
decisions:
  - Capture editedCard in local variable before async closure to satisfy TypeScript narrowing (avoids 'does not exist on VocalState' error)
  - Update vocalReducer.test.ts fixture for card-saving to include card field (Rule 1 auto-fix)
metrics:
  duration: ~15min
  completed: 2026-05-27
  tasks_completed: 4
  files_changed: 5
---

# Phase 03 Plan 03: Frontend Save Wiring + History Component Summary

JWT auth with real Supabase save wired to /api/coach/voice/save and VocalFeedbackHistory component querying coach_vocal_feedbacks with inline expand.

## What was done

- **vocalReducer**: `card-saving` state now carries `card: StructuredCard` (alongside `editedCard`); `SAVE_ERROR` action added that transitions `card-saving` back to `card-ready` (enabling retry UX)
- **vocalReducer.test.ts**: Updated the `card-saving → card-saved on SAVE_COMPLETE` fixture to include the new required `card` field
- **VocalCardReady**: Removed the fake 500ms timeout that dispatched `SAVE_COMPLETE`; simplified `card` narrowing since `card-saving` now carries `card` directly
- **VocalRetourPanel**: `savedTranscript` captured at `handleValidate` before dispatch; `useEffect` on `card-saving` calls `POST /api/coach/voice/save`; dispatches `SAVE_ERROR` on failure (HTTP or network); dispatches `SAVE_COMPLETE` + increments `historyRefreshKey` on success; 3-second auto-reset timer removed
- **VocalFeedbackHistory**: New client component, queries `coach_vocal_feedbacks` by `athlete_id` (RLS-filtered); section divider "Feedbacks precedents"; rows with date (fr-FR locale) + tag chips + context preview (100 chars); inline expand (one row at a time) using `CardSection` + `TagChip` in read-only/disabled mode; hidden when empty, skeleton during load

## Acceptance

- Real save wired to /api/coach/voice/save (POST with athlete_id, transcript, card) ✓
- SAVE_ERROR transitions card-saving back to card-ready for retry ✓
- History list hidden when no feedbacks (returns null) ✓
- Inline expand: one row at a time, CardSection + TagChip disabled/read-only ✓
- All vocalReducer tests pass (15/15) ✓
- TypeScript compiles cleanly (0 errors) ✓

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript error: state.editedCard not accessible in async closure**
- **Found during:** Task 3 implementation
- **Issue:** TypeScript cannot narrow `state` inside an async closure after the guard check `if (state.status !== 'card-saving') return`. The async function `doSave` sees `state` typed as `VocalState` (full union), not the narrowed type.
- **Fix:** Captured `const editedCard = state.editedCard` before the closure — TypeScript narrows correctly at that synchronous point.
- **Files modified:** `apps/web/src/components/coach/vocal/VocalRetourPanel.tsx`
- **Commit:** 4ac08d7

**2. [Rule 1 - Bug] vocalReducer.test.ts fixture missing card field after type extension**
- **Found during:** Task 1 verification
- **Issue:** The test at line 130 used `{ status: 'card-saving', editedCard: mockCard }` which became invalid after adding `card` as a required field to the `card-saving` union member.
- **Fix:** Updated fixture to `{ status: 'card-saving', card: mockCard, editedCard: mockCard }`.
- **Files modified:** `apps/web/src/components/coach/vocal/vocalReducer.test.ts`
- **Commit:** 4ac08d7

## Integration notes

- Requires Plan 03-01 (DB migration + POST /api/coach/voice/save endpoint) to persist data
- Requires Plan 03-02 (memory injection) for Claude to use history in structuring prompts
- The `VocalFeedbackHistory` Supabase query relies on RLS policy `coach_vocal_feedbacks_own` filtering by `coach_id = auth.uid()` — no manual auth filter needed in the query

## Self-Check: PASSED

- `apps/web/src/components/coach/vocal/VocalFeedbackHistory.tsx` — FOUND
- `apps/web/src/components/coach/vocal/vocalReducer.ts` — FOUND
- `apps/web/src/components/coach/vocal/VocalRetourPanel.tsx` — FOUND
- `apps/web/src/components/coach/vocal/VocalCardReady.tsx` — FOUND
- commit 4ac08d7 — FOUND
