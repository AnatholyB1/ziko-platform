---
phase: 05-response-viewer
plan: "01"
subsystem: backend-api
tags: [coach, forms, responses, security, hono]
dependency_graph:
  requires: []
  provides: [GET /coach/clients/:clientId/forms]
  affects: [backend/api/src/coach/clients/db.ts, backend/api/src/coach/clients/service.ts]
tech_stack:
  added: []
  patterns: [manual-ownership-filter, server-side-join, sorted-response-shape]
key_files:
  modified:
    - backend/api/src/coach/clients/db.ts
    - backend/api/src/coach/clients/service.ts
decisions:
  - "Manual ownership filter applied after Supabase fetch (RF-02: publishable client has no RLS)"
  - "Server-side Q&A join: question_label and question_type resolved inside getFormsForClient from coach_forms.questions JSONB (RF-04)"
  - "Sort: submitted DESC first, pending at bottom — matches UI-SPEC display order"
  - "Route mounted on clientsRouter not formsRouter (RF-01 compliance)"
metrics:
  duration: "~10 minutes"
  completed_date: "2026-05-28"
  tasks_completed: 2
  files_modified: 2
---

# Phase 05 Plan 01: GET /coach/clients/:clientId/forms — Backend API Summary

**One-liner:** GET endpoint for coach to read all form instances for an athlete, with submitted answers pre-joined from coach_forms.questions and sorted submitted-first.

## What Was Built

### Task 1 — `getFormsForClient()` in `backend/api/src/coach/clients/db.ts`

New exported async function `getFormsForClient(jwt, coachId, clientId)` appended at the end of db.ts:

1. Creates a user-scoped Supabase client via `createUserClient(jwt)`.
2. Fetches all `form_instances` for the given `athlete_id`, with an inner join on `coach_forms` (title, questions JSONB, coach_id).
3. Applies manual ownership filter: `ownedInstances.filter(i => i.coach_forms?.coach_id === coachId)` — satisfies RF-02 (no RLS on publishable client).
4. For submitted instances, fetches `form_responses` (answers JSONB) and builds a `Map<instance_id, answers[]>`.
5. For each instance: resolves `question_label` and `question_type` from `coach_forms.questions` JSONB keyed by `question_id` (RF-04 server-side join). Pending instances receive `answers: null`.
6. Returns sorted array: submitted rows sorted by `submitted_at DESC` first, then pending rows.

Return type: `Promise<{ forms: FormInstanceResponse[] }>`

### Task 2 — Route registration in `backend/api/src/coach/clients/service.ts`

- Added `getFormsForClient` to the existing named import from `./db.js`.
- Registered `clientsRouter.get('/:clientId/forms', ...)` immediately before the PUT /:clientId/shared-note block.
- UUID_REGEX validation fires before any DB call (T-05-03 mitigation).
- Auth is inherited from `clientsRouter.use('*', authMiddleware)` — `c.get('auth').userId` is the trust anchor (T-05-01 mitigation).
- Final URL: `GET /coach/clients/:clientId/forms` — matches UI-SPEC fetch URL exactly (RF-01).

## Verification

- `rtk tsc --noEmit -p backend/api/tsconfig.json` — zero errors.
- Route responds 400 for invalid UUID (UUID_REGEX guard).
- Route responds 200 `{ forms: [] }` for a valid UUID with no matching instances.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new trust boundaries introduced. All mitigations from the plan's threat register applied:

| Threat ID | Mitigation Applied |
|-----------|--------------------|
| T-05-01 | authMiddleware inherited on all clientsRouter routes; c.get('auth').userId is trust anchor |
| T-05-02 | Manual ownership filter: `ownedInstances.filter(i => i.coach_forms?.coach_id === coachId)` |
| T-05-03 | UUID_REGEX validation before any DB call; invalid UUID returns 400 immediately |

## Self-Check: PASSED

- `backend/api/src/coach/clients/db.ts` — contains `getFormsForClient` — FOUND
- `backend/api/src/coach/clients/service.ts` — contains `/:clientId/forms` — FOUND
- Commit `b73abcb` (db.ts) — FOUND
- Commit `fa9e1a6` (service.ts) — FOUND
- TypeScript compilation: zero errors — PASSED
