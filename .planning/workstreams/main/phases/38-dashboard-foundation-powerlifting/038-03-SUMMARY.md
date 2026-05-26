---
phase: "38"
plan: "038-03"
subsystem: "coach-web / dashboard data layer"
tags: [powerlifting, data-transforms, tdd, supabase, vitest]
dependency_graph:
  requires: ["038-01"]
  provides: ["038-04"]
  affects: []
tech_stack:
  added: []
  patterns: ["TDD RED/GREEN", "pure transform functions", "Epley 1RM formula", "ISO week grouping"]
key_files:
  created:
    - apps/web/src/lib/dashboard/powerlifting.ts
    - apps/web/src/lib/dashboard/powerlifting.test.ts
  modified: []
decisions:
  - "SupabaseClient type imported from @supabase/supabase-js (not @supabase/ssr which does not re-export it)"
  - "SBD exercise matching done at JS layer via toLowerCase().includes() — no SQL ILIKE on joined column"
  - "buildTonnageData uses ISO Monday-based week key, then relabels sequentially as 'Sem. N'"
metrics:
  duration_seconds: 791
  completed_date: "2026-05-26"
  tasks_completed: 2
  files_created: 2
---

# Phase 38 Plan 03: Powerlifting data fetching utilities + unit tests Summary

## One-liner
Epley 1RM utility + 4 pure transform functions (SBD/RPE/tonnage/intensity) with Supabase fetch, 17 unit tests all green.

## What was done

**Task 1 (RED):** Created `powerlifting.test.ts` with 17 unit tests covering all 5 pure functions. Imports from the non-existent source file — vitest failed with import error confirming RED state. Committed as `test(038-03)`.

**Task 2 (GREEN):** Created `powerlifting.ts` implementing:
- `estimate1RM(weight, reps)` — Epley formula; returns weight unchanged when reps=1
- `buildSBDData(rows)` — groups by date, picks max estimated 1RM per SBD lift using JS-layer keyword matching
- `buildRPEData(rows)` — averages RPE per date, excludes null RPE rows
- `buildTonnageData(rows)` — sums `weight_kg * reps` per ISO Monday-based week, labels sequentially as `Sem. N`
- `buildIntensityData(rows)` — computes `(avgWeight / estimate1RM(avgWeight, avgReps)) * 100` per session date
- `fetchPowerliftingData(supabase, clientId, dateRange)` — single Supabase query joining `session_sets → workout_sessions + exercises`, filters by `workout_sessions.started_at` (not `session_date`)

All 17 tests pass. TypeScript clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed SupabaseClient import source**
- **Found during:** Task 2 type-check
- **Issue:** Plan specified `import type { SupabaseClient } from '@supabase/ssr'` but `@supabase/ssr` does not export `SupabaseClient` — that type lives in `@supabase/supabase-js`
- **Fix:** Changed import to `import type { SupabaseClient } from '@supabase/supabase-js'`
- **Files modified:** apps/web/src/lib/dashboard/powerlifting.ts
- **Commit:** 6efedc7 (included in the same feat commit)

## TDD Gate Compliance

- RED gate: `ead0562` — `test(038-03): add failing tests for powerlifting data transforms`
- GREEN gate: `6efedc7` — `feat(038-03): implement powerlifting data transforms and fetch function`

## Artifacts

- `apps/web/src/lib/dashboard/powerlifting.ts` — exports: `fetchPowerliftingData`, `estimate1RM`, `buildSBDData`, `buildRPEData`, `buildTonnageData`, `buildIntensityData`, `PowerliftingData`, `SBDDataPoint`, `RPEDataPoint`, `TonnageDataPoint`, `IntensityDataPoint`, `SBD_KEYWORDS`
- `apps/web/src/lib/dashboard/powerlifting.test.ts` — 17 unit tests, all passing

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. `fetchPowerliftingData` enforces `clientId` scoping via `.eq('workout_sessions.user_id', clientId)` as required by T-038-04.

## Self-Check: PASSED
