---
phase: 28-ai-file-imports
plan: 03
subsystem: api
tags: [supabase, typescript, jwt, rls, imports, workout-programs]

requires:
  - phase: 28-01
    provides: migration 036 — ai_imports table + workout_programs extensions (is_template, weeks_data)
  - phase: 28-02
    provides: creditService variable-cost extension used by the parse layer (plan 05)

provides:
  - backend/api/src/coach/imports/types.ts — ImportStatus, ImportMode, ImportRow, CreateImportBody, CommitImportBody, UpdateStatusBody
  - backend/api/src/coach/imports/db.ts — 6 JWT-scoped Supabase query functions (createImport, getImport, listImports, updateImportStatus, updateImportFileUrl, commitImport)
  - Bounded module contract layer; route layer (plan 04) imports exclusively from these two files

affects:
  - 28-04 (imports route/service layer — imports db.ts and types.ts)
  - 28-05 (parse pipeline — calls updateImportStatus with parsed_data/confidence_scores)
  - 28-06 (web UI — imports types for ImportRow shape)
  - 28-07 (mobile UI — imports types for ImportRow shape)

tech-stack:
  added: []
  patterns:
    - "JWT-scoped Supabase client per request — createUserClient(jwt) with SUPABASE_PUBLISHABLE_KEY (ARCH-03)"
    - "Bounded module: types.ts (interfaces) + db.ts (queries) consumed by service.ts route layer"
    - "server-side is_template derivation from mode field — client cannot elevate athlete→coach_template (T-28-03-02)"

key-files:
  created:
    - backend/api/src/coach/imports/types.ts
    - backend/api/src/coach/imports/db.ts
  modified: []

key-decisions:
  - "is_template computed server-side from mode='coach_template' (D-18) — not a client-supplied boolean"
  - "created_by_coach_id set to userId only when mode='coach_template'; null for athlete commits (T-28-03-03)"
  - "file_url initialised as empty string; service layer calls updateImportFileUrl after signed URL is resolved"
  - "commitImport uses logical sequence (not a DB transaction) — two separate Supabase calls; idempotency enforced by caller checking status≠committed"

patterns-established:
  - "All db functions accept jwt: string as first param; no service key anywhere in coach/imports/"
  - "updateImportStatus accepts optional extra: Partial<Pick<ImportRow, ...>> for transition-specific fields"
  - "getImport uses maybeSingle() returning null on RLS-blocked or missing rows"

requirements-completed: [IMPORT-01, IMPORT-04, IMPORT-05, IMPORT-06, IMPORT-09, IMPORT-10]

duration: 6min
completed: 2026-05-21
---

# Phase 28 Plan 03: AI Imports Contract Layer Summary

**JWT-scoped Supabase db.ts with 6 query functions and full TypeScript interface set for the ai_imports bounded module, with server-side is_template derivation from mode field**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-21T12:28:53Z
- **Completed:** 2026-05-21T12:35:02Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `types.ts` with all 6 exported types (ImportStatus, ImportMode, ImportRow, CreateImportBody, CommitImportBody, UpdateStatusBody) mapping all 19 ai_imports columns
- Created `db.ts` with 6 Supabase query functions, all using JWT-scoped client (SUPABASE_PUBLISHABLE_KEY only — no service key)
- `commitImport` correctly sets `is_template = (mode === 'coach_template')` and `created_by_coach_id` server-side (T-28-03-02, T-28-03-03, D-18)
- TypeScript compiles cleanly across entire backend/api codebase

## Task Commits

1. **Task 1: Create types.ts** — `bcbdc34` (feat)
2. **Task 2: Create db.ts** — `f66c451` (feat)

**Plan metadata:** (final commit below)

## Files Created/Modified

- `backend/api/src/coach/imports/types.ts` — All TypeScript interfaces for the imports module: ImportStatus union, ImportMode union, ImportRow (19 columns), CreateImportBody, CommitImportBody, UpdateStatusBody
- `backend/api/src/coach/imports/db.ts` — JWT-scoped Supabase query functions: createImport, getImport, listImports, updateImportStatus, updateImportFileUrl, commitImport

## Decisions Made

- `file_url` initialised as `''` in `createImport`; the service layer sets the real Storage path via `updateImportFileUrl()` after the signed URL is resolved — clean separation of concerns
- `commitImport` uses two sequential Supabase calls (not a transaction). If the `workout_programs` INSERT succeeds but `ai_imports` UPDATE fails, the orphaned program is acceptable — the route layer prevents calling `commitImport` when `status === 'committed'` (idempotency guard is the caller's responsibility per plan spec)
- `getImport` uses `maybeSingle()` so it returns null (not an error) when RLS blocks access or the row does not exist — safe for the 404 handler in the route layer

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `backend/api/src/coach/imports/types.ts` and `db.ts` are ready for import by the route layer (plan 04)
- Plan 04 (service.ts / Hono router) can `import { createImport, getImport, ... } from './db.js'` and `import type { ImportRow, CreateImportBody, ... } from './types.js'` immediately
- Plan 05 (parse pipeline) uses `updateImportStatus` with `{ parsed_data, confidence_scores, page_count, parsed_at }` extras — signature already supports this

## Self-Check

- [x] `backend/api/src/coach/imports/types.ts` — FOUND
- [x] `backend/api/src/coach/imports/db.ts` — FOUND
- [x] Commit `bcbdc34` — FOUND (`feat(28-03): create imports/types.ts`)
- [x] Commit `f66c451` — FOUND (`feat(28-03): create imports/db.ts`)
- [x] TypeScript compiles without errors

## Self-Check: PASSED

---
*Phase: 28-ai-file-imports*
*Completed: 2026-05-21*
