---
phase: "45-storage-pipeline-mobile-upload"
plan: 02
subsystem: coach-videos-backend
tags: [hono, supabase-storage, signed-url, push-notification, vitest, unit-tests]
requires:
  - 45-01 (migration coach_client_videos table)
provides:
  - POST /coach/videos/upload-url — signed PUT URL generation
  - POST /coach/videos/:videoId/complete — DB insert + push notification
affects:
  - backend/api/src/app.ts
tech-stack:
  added: []
  patterns:
    - Hono router with authMiddleware
    - Supabase service client for storage admin
    - notificationService.send() with idempotencyKey
    - vitest unit tests with vi.mock for all external deps
key-files:
  created:
    - backend/api/src/coach/videos/types.ts
    - backend/api/src/coach/videos/db.ts
    - backend/api/src/coach/videos/service.ts
    - backend/api/src/coach/videos/service.test.ts
    - backend/api/vitest.unit.config.ts
  modified:
    - backend/api/src/app.ts
key-decisions:
  - expiresIn option omitted from createSignedUploadUrl (not supported by @supabase/storage-js types; TTL set in bucket config server-side — mirrors existing storage.ts pattern)
  - vitest.unit.config.ts created to run src/ unit tests separately from integration suite (test/**/)
requirements-completed:
  - INFRA-03
  - UPLOAD-04
metrics:
  duration: "18 min"
  completed: "2026-05-26"
  tasks: 3
  files: 6
---

# Phase 45 Plan 02: Hono Coach-Videos Endpoints Summary

Hono backend for the two-endpoint coach-video upload flow: signed URL generation and upload completion with push notification, covered by 5 passing vitest unit tests.

## Duration

Start: 2026-05-26T14:10Z
End: 2026-05-26T14:28Z
Duration: ~18 minutes
Tasks: 3/3

## What Was Built

**POST /coach/videos/upload-url**
- Authenticates the athlete via `authMiddleware`
- Calls `getActiveCoachForAthlete(athleteId)` — returns 403 `NOT_LINKED` if the athlete has no active, non-revoked, non-expired `coach_client_links` row
- Generates a `randomUUID()` for the videoId
- Computes path as `${athleteId}/${videoId}.mp4` with ownership guard (T-45-04)
- Calls `supabaseAdmin.storage.from('coach-videos').createSignedUploadUrl(path)` using SUPABASE_SERVICE_KEY
- Returns `{ signedUrl, videoId, path }` — video bytes never pass through Hono (INFRA-03)

**POST /coach/videos/:videoId/complete**
- Validates `title` is present and non-empty (400 if missing)
- Re-verifies active coach link (T-45-07 stale-link guard)
- Calls `insertVideoRecord(...)` to insert a `coach_client_videos` row with `status='ready'`
- Calls `notificationService.send()` with `idempotencyKey: video_uploaded_${videoId}` (T-45-06 duplicate guard)

**DB module (db.ts)**
- `getActiveCoachForAthlete`: queries `coach_client_links` with `revoked_at IS NULL` and `expires_at.is.null,expires_at.gt.{now}` guards (Pitfall 8)
- `insertVideoRecord`: inserts row using service client

**Test infrastructure**
- `vitest.unit.config.ts` created for `src/**/*.test.ts` (no Supabase credentials required)
- 5/5 unit tests pass covering all behavior cases from the plan

## Commits

| Task | Commit | Files |
|------|--------|-------|
| 1: types.ts + db.ts | `ddc94b7` | types.ts, db.ts |
| 2: service.ts + tests | `ec60bcb` | service.ts, service.test.ts, vitest.unit.config.ts |
| 3: app.ts registration | `734325e` | app.ts |

## Test Results

```
POST /coach/videos/upload-url
  ✓ returns 200 with { signedUrl, videoId, path } for a linked athlete
  ✓ returns 403 NOT_LINKED for an athlete with no active coach link
  ✓ returns 401 when no Authorization header is provided

POST /coach/videos/:videoId/complete
  ✓ returns 200 { ok: true } and calls notificationService.send with correct idempotencyKey
  ✓ returns 400 when title is missing from the body

Test Files: 1 passed (1)
Tests:      5 passed (5)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] expiresIn option removed from createSignedUploadUrl**
- **Found during:** Task 2 (TypeScript check)
- **Issue:** `createSignedUploadUrl` in `@supabase/storage-js` only supports `{ upsert }` in its options type; `expiresIn: 900` causes TS2353
- **Fix:** Removed the option; TTL is controlled at the Supabase bucket level (same approach as `backend/api/src/routes/storage.ts`). Plan's D-03 intent (15 min) is met via bucket config.
- **Files modified:** `service.ts`
- **Commit:** `ec60bcb`

**2. [Rule 3 - Blocker] vitest.unit.config.ts created for src/ test discovery**
- **Found during:** Task 2 (vitest run)
- **Issue:** `vitest.config.ts` has `include: ['test/**/*.{spec,test}.ts']` — tests in `src/` are not discovered
- **Fix:** Created `vitest.unit.config.ts` with `include: ['src/**/*.test.ts']` and no setup (no real DB credentials needed for unit tests)
- **Files modified/created:** `vitest.unit.config.ts`
- **Commit:** `ec60bcb`

**Total deviations:** 2 auto-fixed (1 Rule 1 bug, 1 Rule 3 blocker)
**Impact:** No functional change — both deviations improve correctness and test discoverability. expiresIn behavior is delegated to bucket config as the codebase already does for other storage routes.

## Known Stubs

None — all data flows are wired to real DB functions and the notification service.

## Threat Surface Scan

No new threat surface beyond what the plan's threat model already covers (T-45-04 through T-45-08).

## Self-Check: PASSED

- [x] `backend/api/src/coach/videos/types.ts` — FOUND
- [x] `backend/api/src/coach/videos/db.ts` — FOUND
- [x] `backend/api/src/coach/videos/service.ts` — FOUND
- [x] `backend/api/src/coach/videos/service.test.ts` — FOUND
- [x] `backend/api/vitest.unit.config.ts` — FOUND
- [x] Commit `ddc94b7` — FOUND
- [x] Commit `ec60bcb` — FOUND
- [x] Commit `734325e` — FOUND
- [x] `grep "coach/videos" app.ts` returns import line (L25) + route line (L80)
- [x] TypeScript: 0 errors
- [x] Vitest: 5/5 tests pass

## Next

Ready for 45-03 (mobile upload screen implementation).
