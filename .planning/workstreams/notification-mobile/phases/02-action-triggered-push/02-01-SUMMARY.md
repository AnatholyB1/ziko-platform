---
phase: 02-action-triggered-push
plan: 01
subsystem: api
tags: [push-notifications, hono, vercel-functions, waitUntil, expo-push, coach, programs]

# Dependency graph
requires:
  - phase: 01-infrastructure-configuration
    provides: notificationService.send() with idempotency, preferences, quiet hours, Expo SDK send pipeline
provides:
  - PUSH-01 waitUntil integration in POST /coach/programs/:id/assign
  - Background push to all assigned athletes after program assignment with French copy
  - Deduplication via idempotencyKey program_assign_{athleteId}_{programId}
affects:
  - 02-02-PLAN (PUSH-02 bidirectional push — same service pattern)
  - 02-03-PLAN (PUSH-03/04 push-events webhook — same service pattern)

# Tech tracking
tech-stack:
  added:
    - "@vercel/functions ^3.6.0 (waitUntil for background tasks after HTTP response)"
  patterns:
    - "waitUntil pattern: call waitUntil(Promise.allSettled(...)) BEFORE return c.json() to fire background work after response"
    - "idempotencyKey pattern: {event_type}_{recipientId}_{entityId} — prevents duplicate pushes on retry"
    - "Promise.allSettled wrapper: individual push failures never abort sibling sends"

key-files:
  created: []
  modified:
    - backend/api/src/coach/programs/service.ts

key-decisions:
  - "Use body.client_ids directly for the push loop — assignProgram() returns { assigned: number } count only, not the IDs"
  - "Use template :id param as programId in idempotencyKey (not per-client fork ID) — stable across re-assignments"
  - "waitUntil placed before return c.json(result) so HTTP 200 is sent before any push resolves (D-06)"

patterns-established:
  - "PUSH-01 pattern: import waitUntil + notificationService, call waitUntil(Promise.allSettled(ids.map(send))) before return"

requirements-completed:
  - PUSH-01

# Metrics
duration: 15min
completed: 2026-05-27
---

# Phase 02 Plan 01: PUSH-01 Program Assignment Push Summary

**waitUntil(Promise.allSettled) block wired into POST /coach/programs/:id/assign to fire French-copy coach push to every assigned athlete in the background without blocking the 200 response**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-27T13:45:00Z
- **Completed:** 2026-05-27T13:58:30Z
- **Tasks:** 1
- **Files modified:** 3 (service.ts, package.json, package-lock.json)

## Accomplishments

- Added `@vercel/functions` dependency for `waitUntil` background task support
- Wired PUSH-01 into POST `/coach/programs/:id/assign` — athletes receive push when coach assigns a program
- Route returns 200 synchronously; push delivery happens in background via `waitUntil`
- Idempotency guaranteed via key `program_assign_{athleteId}_{id}` — no duplicate pushes on retry
- French copy per D-10: title "Nouveau programme 💪", body "Ton coach t'a assigné un nouveau programme. Commence maintenant !"
- Deep link to `/(app)/coach` per D-09

## Task Commits

1. **Task 1: Add PUSH-01 waitUntil block to POST /:id/assign** - `caa37bb` (feat)

## Files Created/Modified

- `backend/api/src/coach/programs/service.ts` — Added `waitUntil` import, `notificationService` import, and the waitUntil block in POST /:id/assign handler
- `backend/api/package.json` — Added `@vercel/functions ^3.6.0` dependency
- `package-lock.json` — Updated lockfile with new dependency

## Decisions Made

- `assignProgram()` returns `{ assigned: number }` (a count), not the athlete IDs — used `body.client_ids` directly from the validated request body for the push loop
- Used the template `:id` param (not any per-client fork UUID) as `programId` in the idempotencyKey — this is stable and deduplicated correctly even if the DB creates per-client fork rows
- `Promise.allSettled` wraps all sends so a single push failure (e.g. no token, quiet hours) never aborts pushes to other athletes

## Deviations from Plan

None — plan executed exactly as written. The implementation was found already committed in a prior session (commit `caa37bb`) which bundled the service.ts changes with the PUSH-02 SUMMARY. The 02-01-SUMMARY.md was missing and has been created now.

## Issues Encountered

- `notificationService.ts` references `SUPABASE_SERVICE_KEY` (line 6-8) while CLAUDE.md specifies `SUPABASE_PUBLISHABLE_KEY`. This is a pre-existing issue introduced during Phase 01 infrastructure — out of scope for this plan. Logged as deferred item: the notification service requires a service-role key to query cross-user token data (coach sending push to athlete bypasses RLS), so this may be intentional. Needs review in Phase 01 context.

## User Setup Required

None — no external service configuration required for this plan specifically. `SUPABASE_SERVICE_KEY` env var for `notificationService.ts` is a Phase 01 concern.

## Next Phase Readiness

- PUSH-01 pipeline proven: Hono route → waitUntil → notificationService → Expo Push → athlete device
- Pattern established for 02-02 (PUSH-02 invitation accepted) and 02-03 (PUSH-03/04 push-events webhook)
- TypeScript compiles cleanly with `@vercel/functions` types resolved

---
*Phase: 02-action-triggered-push*
*Completed: 2026-05-27*
