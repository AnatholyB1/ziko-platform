---
phase: 43-coach-exercises-backend-ui
plan: 3
subsystem: apps/web/coach-exercise-components
tags: [react, next.js, supabase-storage, accessibility, upload, ui-components]
dependency_graph:
  requires: [43-01, 43-02]
  provides: [MuscleChipSelector, ExerciseMediaUpload, ExerciseRow, CoachExercise type]
  affects: [apps/web/src/components/coach, apps/web/src/types]
tech_stack:
  added: []
  patterns: [XHR progress upload, signed URL on demand (no stored signed URL), inline delete confirm, aria-pressed chips]
key_files:
  created:
    - apps/web/src/components/coach/MuscleChipSelector.tsx
    - apps/web/src/components/coach/ExerciseMediaUpload.tsx
    - apps/web/src/components/coach/ExerciseRow.tsx
    - apps/web/src/types/coach.ts
  modified: []
decisions:
  - "XHR upload (PUT to signed URL) used directly instead of supabase uploadToSignedUrl — enables real progress events"
  - "CoachExercise type created in apps/web/src/types/coach.ts to mirror backend types without coupling"
  - "Photo signed URL fetched client-side via useEffect with 3600s TTL — generated on demand, not stored"
metrics:
  duration: "11 minutes"
  completed: "2026-05-26"
  tasks_completed: 3
  files_created: 4
  files_modified: 0
---

# Phase 43 Plan 3: Coach Exercise UI Atoms — Summary

Three atom-level UI components for the coach exercise library: MuscleChipSelector (11 toggle chips), ExerciseMediaUpload (video+photo rows with XHR progress), and ExerciseRow (all 6 states with inline delete confirm).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | MuscleChipSelector.tsx | 8c994d4 | apps/web/src/components/coach/MuscleChipSelector.tsx |
| 2 | ExerciseMediaUpload.tsx | 742fd9c | apps/web/src/components/coach/ExerciseMediaUpload.tsx |
| 3 | ExerciseRow.tsx | 37e3446 | apps/web/src/components/coach/ExerciseRow.tsx, apps/web/src/types/coach.ts |

## Must-Haves Verification

- [x] MuscleChipSelector renders exactly 11 chips (Quadriceps…Corps entier)
- [x] MuscleChipSelector uses `aria-pressed` on each chip button
- [x] ExerciseMediaUpload handles video (mp4/quicktime/webm, 100MB) — separate upload row
- [x] ExerciseMediaUpload handles photo (jpeg/png/webp, 10MB) — separate upload row
- [x] Progress bar present: `h-1 bg-border rounded-full` + `bg-primary` fill
- [x] Success state: `IoCheckmarkCircle` with `text-success`
- [x] Error state: `IoAlertCircle` + French message + "Réessayer" link
- [x] Upload calls `/api/storage/upload-url?bucket=coach-exercises&path={userId}/...`
- [x] Stores path not URL (signed URLs expire)
- [x] ExerciseRow renders all 6 states (no-media, has-video, has-photo, has-both, hover-actions, delete-confirm)
- [x] Delete confirm uses inline expansion (no window.confirm)
- [x] `role="alert"` on delete confirm zone
- [x] `aria-label="Modifier {name}"` on edit button
- [x] `aria-label="Supprimer {name}"` on delete button
- [x] Muscle chips show max 3, then "+N" overflow
- [x] Photo signed URL fetched via `createClientSupabase().storage.from('coach-exercises').createSignedUrl`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] XHR used directly instead of supabase uploadToSignedUrl**
- **Found during:** Task 2
- **Issue:** Initial implementation aborted XHR immediately and used supabase uploadToSignedUrl — progress events were never fired
- **Fix:** Upload via XHR PUT to the Supabase signed upload URL directly; this enables real progress tracking as specified
- **Files modified:** apps/web/src/components/coach/ExerciseMediaUpload.tsx
- **Commit:** 742fd9c

**2. [Rule 2 - Missing functionality] CoachExercise type created for web layer**
- **Found during:** Task 3
- **Issue:** No `@/types/coach` file existed; the plan said "Import CoachExercise from '@/types/coach' or inline" — created the file for reuse by Plans 43-04+
- **Fix:** Created `apps/web/src/types/coach.ts` mirroring backend types
- **Files modified:** apps/web/src/types/coach.ts
- **Commit:** 37e3446

## Pre-existing Issues (Out of Scope)

- `apps/web/src/components/coach/vocal/VocalReview.test.tsx` — TS2307 import error for missing `VocalReview` module — pre-existing, logged to deferred-items

## Threat Surface Scan

No new network endpoints, auth paths, or trust-boundary schema changes introduced. ExerciseMediaUpload calls the existing `/api/storage/upload-url` endpoint (already in T-43-03-01/02 threat register). No new threat flags.

## Self-Check: PASSED

- [x] apps/web/src/components/coach/MuscleChipSelector.tsx exists
- [x] apps/web/src/components/coach/ExerciseMediaUpload.tsx exists
- [x] apps/web/src/components/coach/ExerciseRow.tsx exists
- [x] apps/web/src/types/coach.ts exists
- [x] Commits 8c994d4, 742fd9c, 37e3446 exist in git log
