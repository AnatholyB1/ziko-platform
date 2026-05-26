---
phase: 43-coach-exercises-backend-ui
plan: 4
subsystem: coach-web-ui
tags: [exercises, slideover, gsap, next.js, server-component, sidebar]
dependency_graph:
  requires: [43-01, 43-02, 43-03]
  provides: [exercises-page-ui, exercise-slideover, exercises-client, sidebar-exercises-nav]
  affects: [coach-sidebar, coach-web-exercises-route]
tech_stack:
  added: []
  patterns:
    - Next.js server component with auth guard (redirect on !session)
    - Client component with GSAP stagger animations
    - SlideOver drawer pattern (fixed panel, Escape key, focus trap)
    - Inline delete confirmation (no window.confirm)
key_files:
  created:
    - apps/web/src/components/coach/ExerciseSlideOver.tsx
    - apps/web/src/app/[locale]/(coach)/coach/exercises/ExercisesClient.tsx
    - apps/web/src/app/[locale]/(coach)/coach/exercises/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/exercises/loading.tsx
  modified:
    - apps/web/src/components/coach/CoachSidebar.tsx
decisions:
  - GSAP shake uses gsap.timeline() chaining instead of array x values (TypeScript compatibility)
  - page.tsx uses export function generateMetadata() for dynamic metadata export
  - ExerciseSlideOver uses useEffect with setTimeout for focus on open (waits for CSS transition)
metrics:
  duration: "~18 minutes"
  completed: "2026-05-26"
  tasks_completed: 4
  files_created: 4
  files_modified: 1
---

# Phase 43 Plan 4: Exercises Page UI Summary

**One-liner:** Complete exercises page UI — ExerciseSlideOver drawer (ARIA + GSAP validation shake), ExercisesClient (filter bar + GSAP stagger + empty state), Next.js server component, loading skeleton, and CoachSidebar nav item.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ExerciseSlideOver.tsx | a25abf7, fb7c0cd | `apps/web/src/components/coach/ExerciseSlideOver.tsx` |
| 2 | ExercisesClient.tsx + loading.tsx | 9b53afb | `exercises/ExercisesClient.tsx`, `exercises/loading.tsx` |
| 3 | page.tsx server component | 2dd1da4 | `exercises/page.tsx` |
| 4 | Add Exercices to CoachSidebar | e2ad374 | `CoachSidebar.tsx` |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] GSAP shake animation TypeScript error**
- **Found during:** TypeScript check after Task 1 (`rtk tsc --noEmit`)
- **Issue:** `gsap.to(ref, { x: [-6, 6, -4, 4, 0] })` — GSAP's `TweenValue` type does not accept `number[]` for the `x` property; only scalar values are valid.
- **Fix:** Replaced array syntax with `gsap.timeline()` chaining of 5 sequential `.to()` calls (each moving x to successive values), achieving the same visual shake effect while satisfying TypeScript.
- **Files modified:** `apps/web/src/components/coach/ExerciseSlideOver.tsx`
- **Commit:** fb7c0cd

**Note:** Pre-existing error in `src/components/coach/vocal/VocalReview.test.tsx` (TS2307 — missing VocalReview module) is out-of-scope for this plan and has been left untouched.

---

## Must-Haves Verification

| Must-Have | Status |
|-----------|--------|
| ExerciseSlideOver fixed right panel w-[480px] with translate-x-0/translate-x-full | PASS |
| role="dialog" aria-modal="true" aria-labelledby on panel | PASS |
| Focus trapped on open (name input via useRef + setTimeout) | PASS |
| Escape key via window.addEventListener('keydown') | PASS |
| Validates name + category on submit — French errors + GSAP shake | PASS |
| ExercisesClient filter bar 7 pills with active pill bg-primary text-white | PASS |
| GSAP stagger on exercise list (gsap.from('.exercise-row')) | PASS |
| page.tsx fetches /coach/exercises with Authorization Bearer | PASS |
| CoachSidebar has Exercices with IoBarbellOutline between Programmes and Imports | PASS |

---

## Known Stubs

None — all components are fully wired to real API endpoints and props.

---

## Threat Surface Scan

| Threat | Mitigation |
|--------|------------|
| T-43-04-01: page.tsx session check | PASS — `redirect('/login')` if `!session` before any data fetch |
| T-43-04-02: XSS in exercise.name | PASS — all JSX interpolations, no `dangerouslySetInnerHTML` |
| T-43-04-03: SlideOver form submission | PASS — client-side validation present (name required, category required) |

---

## Self-Check: PASSED

All 5 expected files exist on disk. All 5 commits (`a25abf7`, `9b53afb`, `2dd1da4`, `e2ad374`, `fb7c0cd`) verified in git log.
