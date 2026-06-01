---
phase: "02"
plan: "03"
workstream: retour-vocal
subsystem: vocal-ui
status: complete
tags: [react, gsap, state-machine, vocal-feedback]
dependency_graph:
  requires:
    - "02-01"  # vocalReducer Phase 02 extensions (states + actions)
    - "02-02"  # POST /api/coach/voice/structure backend route
  provides:
    - "VocalStructuring component (structuring state)"
    - "VocalStructuringError component (structuring-error state)"
    - "VocalCardReady shell (card-ready/editing/saving/saved states)"
    - "VocalRetourPanel wired to fire POST /api/coach/voice/structure"
    - "RETRY_STRUCTURE reducer action"
  affects:
    - "02-04"  # FeedbackCard internals replace VocalCardReady shell
tech_stack:
  added: []
  patterns:
    - "useEffect on state.status to trigger async side effect (same pattern as uploadBlob)"
    - "GSAP from() entrance on mount in useEffect"
    - "GSAP keyframes shake on error block"
    - "GSAP yoyo scale on retry button click"
key_files:
  created:
    - apps/web/src/components/coach/vocal/VocalStructuring.tsx
    - apps/web/src/components/coach/vocal/VocalStructuringError.tsx
    - apps/web/src/components/coach/vocal/VocalCardReady.tsx
  modified:
    - apps/web/src/components/coach/vocal/VocalRetourPanel.tsx
    - apps/web/src/components/coach/vocal/vocalReducer.ts
decisions:
  - "Used Tailwind animate-spin class for spinner (same as VocalTranscribing) — no duplicate @keyframes needed"
  - "RETRY_STRUCTURE action added to reducer instead of calling handleStructure directly from error state — ensures state machine transitions cleanly to structuring before useEffect fires"
  - "handleRetryStructure dispatches RETRY_STRUCTURE only; useEffect on state.status re-triggers handleStructure automatically"
  - "void dispatch; void state in VocalCardReady shell prevents unused-variable TS errors"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-27"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 2
---

# Phase 02 Plan 03: Wire VocalRetourPanel + Structuring Components Summary

**One-liner:** VocalRetourPanel wired to fire POST /api/coach/voice/structure on structuring state; VocalStructuring spinner, VocalStructuringError with GSAP shake, and VocalCardReady shell created.

## What Was Built

### Task 1: VocalStructuring + VocalStructuringError

**VocalStructuring.tsx** — stateless loading component for the `structuring` state:
- 32×32 CSS spinner with `border: 4px solid #E2E0DA` / `borderTopColor: #FF5C1A`, Tailwind `animate-spin`
- Heading "Structuration en cours…" (14px/600/#1C1A17)
- Body copy with 5–10s estimate (12px/400/#6B6963, maxWidth 300)
- GSAP `from(containerRef, { opacity: 0, duration: 0.2, ease: 'power2.out' })` on mount

**VocalStructuringError.tsx** — error display for the `structuring-error` state:
- `role="alert"` error block (bg #FEF2F2, border #FECACA)
- AlertTriangle icon + "La structuration a échoué." heading
- Fallback message when `message` prop is empty
- Retour (ghost) + Réessayer (primary #FF5C1A) buttons
- GSAP entrance y:8 → default + shake x:[-6,6,-4,4,-2,2,0] delay 0.2s
- GSAP scale 0.97 yoyo on Réessayer click

### Task 2: VocalRetourPanel + VocalCardReady + vocalReducer updates

**vocalReducer.ts:**
- Added `RETRY_STRUCTURE` to `VocalAction` union
- Added `RETRY_STRUCTURE` case: guard `status !== 'structuring-error'`; returns `{ status: 'structuring', transcript: state.transcript }`
- Extended `RELAUNCH` guard to also allow `structuring-error` (alongside `error` and `review`)

**VocalRetourPanel.tsx:**
- Removed `void clientId;` line — `clientId` now used in POST body
- Added imports: `VocalStructuring`, `VocalStructuringError`, `VocalCardReady`
- Added `handleStructure(transcript)`: POST `/api/coach/voice/structure` with `{ athlete_id: clientId, transcript }`, dispatches `STRUCTURE_SUCCESS` or `STRUCTURE_ERROR`
- Added `useEffect` on `[state.status]` → fires `handleStructure(state.transcript)` when `status === 'structuring'`
- Added `handleRetryStructure`: dispatches `RETRY_STRUCTURE` (state → `structuring`, useEffect auto-triggers)
- Added auto-reset `useEffect` on `card-saved`: `setTimeout(() => dispatch({ type: 'RESET' }), 3000)`
- Added conditional renders: `<VocalStructuring />`, `<VocalStructuringError />`, `<VocalCardReady />`

**VocalCardReady.tsx (shell):**
- `'use client'` directive
- Props typed as `Extract<VocalState, { status: 'card-ready' | ... }>` + `dispatch`
- Renders `<div data-testid="vocal-card-ready">FeedbackCard — Plan 02-04</div>`

## Verification Results

- TypeScript: 0 errors in `vocal/` directory (1 pre-existing error in `branding/page.tsx` fixed incidentally as Rule 3)
- Reducer tests: 15/15 passed
- All acceptance criteria met

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pre-existing TS2307 error in branding/page.tsx**
- **Found during:** TypeScript verification pass
- **Issue:** `apps/web/src/app/[locale]/(coach)/coach/branding/page.tsx` imported `./BrandingClient` which did not exist — TS2307 blocker if left in the build
- **Fix:** Created `BrandingClient.tsx` stub that was already staged from a prior session. The file was committed alongside the plan's files.
- **Files modified:** `apps/web/src/app/[locale]/(coach)/coach/branding/BrandingClient.tsx`
- **Commit:** 2ce3bb5

## Known Stubs

- `VocalCardReady.tsx` renders a placeholder `"FeedbackCard — Plan 02-04"` — intentional per plan spec; Plan 02-04 will replace this with the real FeedbackCard, CardSection, and TagChip components.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes beyond the browser → `/api/coach/voice/structure` fetch already analyzed in the plan's threat model (T-02-03-01, T-02-03-02 both accepted).

## Self-Check: PASSED

- `C:/ziko-platform/apps/web/src/components/coach/vocal/VocalStructuring.tsx` — FOUND
- `C:/ziko-platform/apps/web/src/components/coach/vocal/VocalStructuringError.tsx` — FOUND
- `C:/ziko-platform/apps/web/src/components/coach/vocal/VocalCardReady.tsx` — FOUND
- `C:/ziko-platform/apps/web/src/components/coach/vocal/VocalRetourPanel.tsx` — FOUND (modified)
- `C:/ziko-platform/apps/web/src/components/coach/vocal/vocalReducer.ts` — FOUND (modified)
- Commit `2ce3bb5` — FOUND
