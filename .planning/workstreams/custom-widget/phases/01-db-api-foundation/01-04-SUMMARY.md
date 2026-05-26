---
phase: 01-db-api-foundation
plan: "01-04"
subsystem: coach-dashboards
tags: [widget-data, aggregation, kpi, charts, hono-api]
dependency_graph:
  requires: [01-01, 01-02, 01-03]
  provides: [widget-data-endpoint]
  affects: [coach/dashboards/db.ts, coach/clients/service.ts]
tech_stack:
  added: []
  patterns: [switch-dispatch, recursive-aggregation, supabase-rls-passthrough]
key_files:
  modified:
    - backend/api/src/coach/dashboards/db.ts
    - backend/api/src/coach/clients/service.ts
decisions:
  - Appended getWidgetData as 6th function in db.ts (APPEND-only — no overwrite)
  - threshold_indicator recurse into kpi_tile via self-call (no code duplication)
  - athlete_list scopes to coach_id = coachId via coach_client_links (authorization boundary preserved)
  - period validation throws before any DB query (fail-fast)
metrics:
  duration: "~10 min"
  completed: "2026-05-26"
  tasks_completed: 2
  files_modified: 2
---

# Phase 01 Plan 04: getWidgetData — 7-type widget aggregation endpoint Summary

One-liner: Endpoint GET /coach/clients/:clientId/widget-data with switch-dispatch over 7 widget types (line_chart, bar_chart, kpi_tile, table, athlete_list, threshold_indicator, callout) backed by Supabase RLS-passthrough queries.

## What Was Built

### Task 1 — getWidgetData appended to db.ts
Sixth function added to `backend/api/src/coach/dashboards/db.ts`. The function:
- Validates `period` against `['7d', '30d', '90d', 'all']`, throws `Error('Invalid period')` otherwise
- Computes `since` ISO timestamp and `sinceDate` (date-only) for DB filters
- Dispatches over 7 widget types via switch statement

**7 widget types handled:**

| Type | DB tables queried | Return shape |
|------|-------------------|--------------|
| `line_chart` / `bar_chart` | body_measurements, sleep_logs, journal_entries (by dataKey) | `{ entries: [{date, value}] }` |
| `kpi_tile` | workout_sessions, body_measurements, sleep_logs, habit_logs/habits | `{ value, label }` |
| `table` | workout_sessions, nutrition_logs, body_measurements (by dataKey) | `{ rows: [...] }` |
| `athlete_list` | coach_client_links, user_profiles, workout_sessions | `{ athletes: [{id, name, last_active}] }` |
| `threshold_indicator` | (recurses to kpi_tile) | `{ value, threshold, unit }` |
| `callout` | (no DB query) | `{ message, severity }` |
| `default` | — | throws `Error('Unknown widget type: ${type}')` |

### Task 2 — widget-data route added to clients/service.ts
- Import `getWidgetData` from `'../dashboards/db.js'` added at top
- Route `GET /:clientId/widget-data` registered at end of `clientsRouter`
- Missing `type` param → 400
- `Unknown widget type` or `Invalid period` from getWidgetData → 400
- Other errors → 500 + `console.error('[widget-data]', err)`

## Acceptance Criteria

- [x] db.ts exports getWidgetData (6th function, APPEND-only)
- [x] All 7 widget types handled in switch statement
- [x] `period` validation throws `Error('Invalid period')` for unknown periods
- [x] `default` case throws `Error('Unknown widget type: ${type}')`
- [x] `case 'callout'` returns without any DB query
- [x] `case 'athlete_list'` scopes to `eq('coach_id', coachId)`
- [x] `tsc --noEmit` clean (no errors on modified files)
- [x] Import of getWidgetData present in clients/service.ts
- [x] Route `/:clientId/widget-data` registered after all existing routes

## Deviations from Plan

None — plan executed exactly as written.

## Commit

`622c179` — feat(01-04): add getWidgetData — 7-type widget aggregation endpoint

## Self-Check: PASSED

- `backend/api/src/coach/dashboards/db.ts` — FOUND, exports getWidgetData
- `backend/api/src/coach/clients/service.ts` — FOUND, contains /:clientId/widget-data route
- Commit `622c179` — FOUND in git log
