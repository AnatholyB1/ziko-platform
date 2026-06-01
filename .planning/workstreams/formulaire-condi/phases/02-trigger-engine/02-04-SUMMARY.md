---
phase: 02-trigger-engine
plan: "04"
subsystem: api
tags: [hono, supabase, cron, vercel, forms, trigger]

requires:
  - phase: 02-01
    provides: create_form_instances_for_trigger RPC and coach_forms schema

provides:
  - "GET /forms/cron/trigger-fixed-date — CRON_SECRET-secured daily scan route"
  - "Vercel cron entry at 0 6 * * * for fixed-date trigger scanning"
  - "formsCronRouter export from forms.ts (separate from authMiddleware router)"

affects:
  - formulaire-condi phase 02 (trigger engine completion)
  - Vercel deployment cron schedule

tech-stack:
  added: []
  patterns:
    - "Dual-router pattern: one auth-gated router + one CRON_SECRET-gated router exported from same file (mirrors storage.ts)"
    - "CRON_SECRET header check with undefined-guard for missing env var (both conditions return 401)"

key-files:
  created: []
  modified:
    - backend/api/src/routes/forms.ts
    - backend/api/src/app.ts
    - backend/api/vercel.json

key-decisions:
  - "Used x-cron-secret header (not Authorization Bearer) to match Vercel cron invocation headers"
  - "JS-side date filter on trigger_config->>date (small dataset, avoids complex PostgREST JSON filtering)"
  - "cronRouter mounted at /forms alongside formsRouter — Hono merges routes from multiple routers on same prefix"

patterns-established:
  - "CRON_SECRET guard: check both !secret and secret !== process.env.CRON_SECRET to prevent open endpoint when env var is unset"

requirements-completed:
  - TRIGGER-03

duration: 8min
completed: 2026-05-26
---

# Phase 02 Plan 04: Fixed-Date Cron Trigger Summary

**Daily Vercel cron at 6am UTC scans active fixed-date forms and creates pending instances per linked athlete via CRON_SECRET-secured GET /forms/cron/trigger-fixed-date**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-26T00:00:00Z
- **Completed:** 2026-05-26T00:08:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `cronRouter` (no authMiddleware, CRON_SECRET-secured) alongside the existing `formsRouter` in `forms.ts`, following the dual-router pattern from `storage.ts`
- Cron handler: fetches active fixed_date forms, filters those whose `date <= todayISO` in JS, then calls `create_form_instances_for_trigger` RPC per coach-athlete pair — idempotent via ON CONFLICT DO NOTHING in the RPC
- Added Vercel cron entry `{ "path": "/forms/cron/trigger-fixed-date", "schedule": "0 6 * * *" }` — crons array now has 4 entries

## Task Commits

1. **Task 1 + 2: cron route + vercel.json** — `a9f01ca` (feat)

## Files Created/Modified

- `backend/api/src/routes/forms.ts` — added `cronRouter` with GET `/cron/trigger-fixed-date`; export updated to `{ formsRouter, formsCronRouter }`
- `backend/api/src/app.ts` — import updated to include `formsCronRouter`; mounted at `/forms`
- `backend/api/vercel.json` — added 4th cron entry at `0 6 * * *`

## Decisions Made

- `x-cron-secret` header used (Vercel sends custom headers easily via cron config); guard checks both `!secret` and mismatch so a missing `CRON_SECRET` env var doesn't create an open endpoint
- Date comparison done in JS (`(f.trigger_config as { date?: string }).date! <= todayISO`) — PostgREST JSON operator filtering for `<=` on JSONB string field is supported but adds complexity; JS filter is simpler for a small expected dataset

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — `CRON_SECRET` env var should already be set in Vercel from prior cron setup.

## Next Phase Readiness

- TRIGGER-03 complete: fixed-date cron is live on next Vercel deploy
- All four TRIGGER requirements (manual, session-end, fixed-date cron) are now implemented
- Phase 02 trigger engine is complete

---
*Phase: 02-trigger-engine*
*Completed: 2026-05-26*
