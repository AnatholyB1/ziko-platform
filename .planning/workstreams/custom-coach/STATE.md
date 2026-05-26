---
gsd_state_version: 1.0
milestone: v1.10
milestone_name: Custom Coach Exercises
status: active
last_updated: "2026-05-26"
last_activity: 2026-05-26
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 1
  completed_plans: 1
  percent: 33
---

# Project State

## Current Position

Phase: 43 — Coach Exercise Library Backend + Web UI (plan 1/4 complete)
Status: Phase 43 executing — plan 43-01 committed, plans 43-02 through 43-04 pending
Last activity: 2026-05-26 — 43-01 executed: migration 055 + ALLOWED_BUCKETS updated

## Progress

```
[███░░░░░░░░░░░░░░░░░] 33% — 1/3 phases complete
```

**Phases Complete:** 1/3
**Last Completed:** 42-01 — getProgramsForClient fixed (coach filter removed, { active, history } shape)

## Accumulated Context

### Key Decisions

- Phase 42 is a fast audit (1-2 plans): confirm or fix athlete-created programs visibility in client detail tab
- Phase 43 needs a new `coach_exercises` table (migration) + `coach-exercises` Supabase Storage bucket (signed URL upload pattern, same as v1.3 pattern)
- Phase 44 touches two integration points: web ExerciseTypeahead (Next.js coach CRM) + mobile exercise detail screen (Expo athlete side)
- RLS pattern: `auth.uid() = coach_id` on `coach_exercises` table — consistent with all coach-bounded tables
- `coach_exercises` merges with global `exercises` in typeahead; custom ones get a visual badge distinguishing them

### Stack Reference

- Backend: `backend/api/src/coach/exercises/` (new bounded module to create)
- Web: `apps/web/src/app/(coach)/` — exercise library page + form with upload
- Mobile: athlete program detail screen (existing) — add media display
- Storage: new bucket `coach-exercises` — same signed URL pattern as `profile-photos`, `scan-photos`, `exports`
- DB migration: new `coach_exercises` table after migration 021 (latest known)

### Blockers

None.

## Session Continuity

**Stopped At:** Phase 43 plan 43-01 complete — migration 055, ALLOWED_BUCKETS updated
**Resume File:** .planning/workstreams/custom-coach/phases/43-coach-exercises-backend-ui/43-02-PLAN.md
**Next Action:** `/gsd:execute-phase 43 --ws custom-coach` (plan 43-02: Hono CRUD API)
