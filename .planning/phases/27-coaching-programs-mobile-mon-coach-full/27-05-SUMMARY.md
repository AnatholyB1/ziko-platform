---
phase: 27
plan: "05"
subsystem: backend/coach/clients
tags: [coach, programs, shared-note, rls, idor]
dependency_graph:
  requires: [27-02]
  provides: [GET /coach/clients/:id/programs, PUT /coach/clients/:clientId/shared-note]
  affects: [27-07]
tech_stack:
  added: []
  patterns: [Supabase RLS via JWT, IDOR guard via WHERE clause throw]
key_files:
  modified:
    - backend/api/src/coach/clients/db.ts
    - backend/api/src/coach/clients/service.ts
decisions:
  - compliance_pct computed only for the first (most recent) program row; null on all historical rows
  - upsertSharedNote uses status='active' column guard (requires status column on coach_client_links from prior migration)
metrics:
  duration: "~10 min"
  completed: "2026-05-20"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 27 Plan 05: Client Programs List + Shared-Note Routes Summary

**One-liner:** Two new coach/clients routes — GET /:id/programs (programs list with week progress + compliance) and PUT /:clientId/shared-note (IDOR-guarded shared note update).

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | getProgramsForClient + upsertSharedNote in db.ts | 318f94a | backend/api/src/coach/clients/db.ts |
| 2 | GET /:id/programs + PUT /:clientId/shared-note in service.ts | 318f94a | backend/api/src/coach/clients/service.ts |

## What Was Built

**`getProgramsForClient(jwt, coachId, clientId)`**
- Queries `workout_programs` WHERE `assigned_to_user_id=clientId AND created_by_coach_id=coachId`, ordered by `start_date DESC NULLS LAST`
- Computes `week_number_current` per program: `Math.floor((now - start_date) / 7days) + 1`, capped at `weeks_count`; null if no `start_date`
- Computes `compliance_pct` for the first (active) program only: counts `workout_sessions WHERE source_program_id=id AND created_at >= Monday 00:00 UTC`, denominator from `weeks_data[weekNumberCurrent].sessions.length`; null if denominator is 0 or no start_date
- Historical programs get `compliance_pct: null`

**`upsertSharedNote(jwt, coachId, clientId, note)`**
- `UPDATE coach_client_links SET shared_note WHERE coach_id=coachId AND client_id=clientId AND status='active'`
- Throws `Error('No active coach_client_links row found...')` if 0 rows updated — IDOR guard per T-27-05-01

**`GET /:id/programs`**
- UUID validation on clientId
- Returns `{ programs: [...] }` with enriched fields
- 404 on any thrown error

**`PUT /:clientId/shared-note`**
- UUID validation on clientId
- Validates `body.note` is string (400 if not)
- Validates `body.note.length <= 500` (400 if exceeded) — T-27-05-02
- 500 with message on DB errors (IDOR throw surfaces as 500, not 403, per constant-time principle)

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface

All mitigations from the plan's threat register were implemented:
- T-27-05-01 (IDOR): WHERE clause + throw on 0 rows in `upsertSharedNote`
- T-27-05-02 (length): `body.note.length > 500` check in route before DB call
- T-27-05-03 (info disclosure): `created_by_coach_id=coachId` in query + `workout_programs_coach_read` RLS

## Self-Check: PASSED

- `backend/api/src/coach/clients/db.ts` — modified, commit 318f94a confirmed
- `backend/api/src/coach/clients/service.ts` — modified, commit 318f94a confirmed
- TypeScript compiled clean (0 errors)
- Both routes present in service.ts (verified via grep lines 389-418)
