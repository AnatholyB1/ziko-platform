---
gsd_state_version: 1.0
milestone: v1.16
milestone_name: Exercise Library Import
status: executing
stopped_at: Phase 4 UI-SPEC approved
last_updated: "2026-08-17T18:08:34.785Z"
last_activity: 2026-08-17 -- Phase 4 planning complete
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 17
  completed_plans: 13
  percent: 75
---

# Project State

## Project Reference

See: .planning/PROJECT.md and .planning/workstreams/image-exo/REQUIREMENTS.md

**Core value:** Coaches et athlètes disposent d'une bibliothèque d'exercices fiable et complète — données riches, GIFs et thumbnails réels et self-hébergés, sans dépendance à un CDN tiers cassé.
**Current focus:** Phase 4 — mobile consumption & attribution

## Current Position

Phase: 4
Plan: Not started
Status: Ready to execute
Last activity: 2026-08-17 -- Phase 4 planning complete

Progress: [██████████] 100%

## Accumulated Context

### Decisions

- Strict 4-phase dependency chain (schema → download/match dry-run → human-approved merge → mobile consumption); not parallelizable — each phase consumes the prior phase's committed output (research-derived, roadmap-confirmed)
- Match/merge split into separate phases specifically to enforce a human review gate between dry-run report and any production write (mitigates false-positive/false-negative matching risk)
- [Phase 3]: 6 unmatched-new exercises left unresolved after the real merge run — dataset uses muscle-group categories (chest/upper arms/upper legs/lower legs) with no 1:1 mapping to production's training-modality CHECK constraint (category.ts has no fuzzy/default mapping by design); follow-up decision needed (alias mapping vs manual insert) before non-custom exercises count reaches 1324

### Pending Todos

None yet.

### Blockers/Concerns

- Exact dataset field names (`exercises.schema.json`) not independently verified — verify before Phase 2 planning/matcher implementation
- Live `exercises.name` uniqueness constraint should be double-checked against production (`\d exercises`) before Phase 2/3 planning
- 180×180 resolution-cap legal interpretation needs explicit sign-off before Phase 4 is marked done
- Attribution badge visual design deferred to a UI-SPEC pass — needed before/during Phase 4 planning (ui_safety_gate applies, Phase 4 has UI hint)
- 6 unmatched-new exercises (dataset ids 1371,1394,1628,1766,0576,0656) blocked on category taxonomy mismatch — dataset category values (chest/upper arms/upper legs/lower legs) don't map to production's strength/cardio/flexibility/balance/sports/stretching CHECK constraint. Needs human decision: extend lib/category.ts alias mapping (recommended: -> strength) and re-run merge.ts, or manual INSERT.
- [Code review, 03-REVIEW.md, accepted as tracked gap] `merge-row.ts`'s `buildExercisePayload` never writes the dataset's `muscle_group` field — production `muscle_groups` column (read by `backend/api/src/coach/exercises/db.ts` and mobile `ExercisePicker`) left at its default `'{}'` for all 1,318 rows already merged in the Phase 3 real run. Needs a follow-up fix (write `muscle_group` in `buildExercisePayload`) plus a targeted backfill for the already-merged rows (a plain re-run of `merge.ts` will skip them — they're already logged `matched` in `exercise_import_log`).
- [Code review, 03-REVIEW.md, accepted as tracked gap] `merge.ts` never reads `row.human_decision` on ambiguous rows — hard-codes every ambiguous row to `needs_review` regardless of a reviewer's approved match/insert/skip decision. Did not affect the real run (0 ambiguous rows in the approved report), but is a real bug for any future re-run against a report containing ambiguous rows.

## Session Continuity

Last session: 2026-08-17T12:58:55.529Z
Stopped at: Phase 4 UI-SPEC approved
Resume file: .planning/workstreams/image-exo/phases/04-mobile-consumption-attribution/04-UI-SPEC.md
