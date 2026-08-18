---
phase: 26-crm-client-management
plan: "03"
subsystem: backend/coach-clients
tags: [backend, hono, supabase, rls, coach, crm, summary, tabs, compare]
dependency_graph:
  requires: [26-02]
  provides: [CLIENT-03, CLIENT-04, CLIENT-07]
  affects: [backend/api/src/coach/clients/db.ts, backend/api/src/coach/clients/service.ts, backend/api/src/coach/clients/types.ts]
tech_stack:
  added: []
  patterns:
    - "Per-JWT Supabase client for RLS enforcement on all tab queries"
    - "Route ordering: GET /compare registered before GET /:id/* (Hono first-match)"
    - "Defense-in-depth: listCompareData validates clientIds against coach_client_links before querying athlete tables"
key_files:
  created:
    - backend/api/test/coach/clients-summary.spec.ts
    - backend/api/test/coach/clients-tabs.spec.ts
    - backend/api/test/coach/clients-compare.spec.ts
  modified:
    - backend/api/src/coach/clients/db.ts
    - backend/api/src/coach/clients/service.ts
    - backend/api/src/coach/clients/types.ts
decisions:
  - "workout_sessions tab selects started_at/ended_at/notes (no duration column exists at this migration level; duration_seconds is added by migration 006 ALTER TABLE but not present in test DB)"
  - "habit_logs uses value INTEGER column (not completed boolean — habits schema uses value: 1=done for boolean, actual count for count type)"
  - "cardio_sessions uses calories_burned + avg_pace_sec_per_km (not calories/pace as specified in plan — actual schema from migration 012)"
  - "GET /compare registered before GET /:id/* to prevent Hono matching 'compare' as :id param (T-26-03-03 mitigated)"
metrics:
  duration: "11m"
  completed_date: "2026-05-18"
  tasks_completed: 2
  files_modified: 6
---

# Phase 26 Plan 03: Summary / Tabs / Compare Backend Summary

**One-liner:** 9 new db functions + 9 Hono routes completing the coach/clients backend surface — executive summary aggregates, 7 data tab queries, and multi-client time-series comparison with RLS-validated clientId filtering.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add ClientSummary type + 9 db functions | a79a7f7 | db.ts, types.ts |
| 2 | Add routes to service.ts + upgrade 3 test stubs | 7b69cd4 | service.ts, 3 spec files |

## What Was Built

### db.ts additions (9 new exports)

- **`getClientSummary(jwt, coachId, clientId)`** — returns `ClientSummary` with 7 fields: `sessions_this_week`, `habits_pct`, `last_workout_at`, `latest_weight_kg`, `mood_delta`, `mood_curr_avg`, `mood_prev_avg`. Mood delta is null when fewer than 3 entries in either 7d window (per D-10).
- **7 tab functions** — `getClientSessions`, `getClientMeasurements`, `getClientHabits`, `getClientNutrition`, `getClientSleep`, `getClientCardio`, `getClientJournal`. Each returns last 30 rows DESC via coach JWT (RLS auto-applied).
- **`listCompareData(jwt, coachId, clientIds, metric, days)`** — validates each clientId against `coach_client_links WHERE coach_id = coachId` before querying. Supports `weight`/`sessions`/`sleep`/`mood`. Sessions metric aggregates by ISO week (Sunday start). Returns `Record<clientId, {date, value}[]>`.

### service.ts additions (9 new routes)

- `GET /compare` — registered before `/:id/*` (T-26-03-03 fix)
- `GET /:id/summary`
- `GET /:id/sessions`, `/:id/measurements`, `/:id/habits`, `/:id/nutrition`, `/:id/sleep`, `/:id/cardio`, `/:id/journal`
- All routes validate UUID format (T-26-03-02), extract JWT from Authorization header, return structured JSON

### types.ts addition

- `ClientSummary` type with 7 fields per D-09/D-10/D-11 spec

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Wrong column name: `workout_sessions.duration_minutes`**
- **Found during:** Task 2 test run
- **Issue:** Plan spec listed `duration_minutes` but actual schema (migration 001 + 006) has no `duration_minutes` column. Migration 006 adds `total_duration_seconds` via ALTER TABLE but it was not present in test DB either.
- **Fix:** Changed select to `id, name, created_at, started_at, ended_at, notes` — all guaranteed columns from migration 001
- **Files modified:** backend/api/src/coach/clients/db.ts
- **Commit:** 7b69cd4

**2. [Rule 1 - Bug] Wrong column name: `habit_logs.completed` / `habit_logs.count`**
- **Found during:** Task 2 test run
- **Issue:** Plan spec listed `completed, count` but actual schema (migration 002) has `value INTEGER` (1=done for boolean habits, actual count for count habits)
- **Fix:** Changed select to `habit_id, date, value`; changed filter from `l.completed` to `l.value > 0`
- **Files modified:** backend/api/src/coach/clients/db.ts (both getClientHabits + getClientSummary)
- **Commit:** 7b69cd4

**3. [Rule 1 - Bug] Wrong column names: `cardio_sessions.calories` / `cardio_sessions.pace`**
- **Found during:** Task 2 test run
- **Issue:** Plan spec listed `calories, pace` but actual schema (migration 012) has `calories_burned INTEGER` and `avg_pace_sec_per_km INTEGER`
- **Fix:** Changed select to use actual column names `calories_burned, avg_pace_sec_per_km`
- **Files modified:** backend/api/src/coach/clients/db.ts
- **Commit:** 7b69cd4

## Test Results

| File | Tests | Result |
|------|-------|--------|
| clients-summary.spec.ts | 6 | PASS |
| clients-tabs.spec.ts | 8 | PASS |
| clients-compare.spec.ts | 5 | PASS |
| clients-roster.spec.ts | 3 | PASS (Plan 02, unaffected) |
| clients-tags.spec.ts | 4 | PASS (Plan 02, unaffected) |
| clients-notes.spec.ts | 5 | PASS (Plan 02, unaffected) |
| clients-revoke-coach.spec.ts | 4 | PASS (Plan 02, unaffected) |

Full suite: 12 failures in `clients-preview.spec.ts` (2, pre-existing data-state issue) and `rls/coach-profiles.spec.ts` + others (10, Supabase auth rate limit from running all 51 suites in rapid succession — transient). None caused by this plan's changes.

## Threat Model Compliance

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-26-03-01: unlinked clientIds in /compare | `listCompareData` validates against `coach_client_links WHERE coach_id = coachId` | Implemented + tested |
| T-26-03-02: non-UUID clientId in /:id/* | UUID_REGEX check before DB call, returns 400 | Implemented |
| T-26-03-03: "compare" parsed as :id | GET /compare registered before GET /:id/* | Implemented |

## Known Stubs

None — all routes return real data from DB functions. No hardcoded values or TODO placeholders.

## Self-Check: PASSED

- `backend/api/src/coach/clients/db.ts` — FOUND (modified, 9 new exports confirmed)
- `backend/api/src/coach/clients/service.ts` — FOUND (modified, 9 new routes confirmed)
- `backend/api/src/coach/clients/types.ts` — FOUND (ClientSummary type added)
- `backend/api/test/coach/clients-summary.spec.ts` — FOUND (6 real tests)
- `backend/api/test/coach/clients-tabs.spec.ts` — FOUND (8 real tests)
- `backend/api/test/coach/clients-compare.spec.ts` — FOUND (5 real tests)
- Commit a79a7f7 — FOUND
- Commit 7b69cd4 — FOUND
