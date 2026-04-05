---
phase: 15-lifecycle-cleanup
plan: "01"
subsystem: backend
tags: [storage, cron, cleanup, supabase, vercel]
dependency_graph:
  requires: []
  provides: [storage-cron-cleanup]
  affects: [backend/api/src/routes/storage.ts, backend/api/src/app.ts, backend/api/vercel.json]
tech_stack:
  added: []
  patterns: [cron-secret-auth, promise-allsettled-fault-tolerance, separate-router-for-cron]
key_files:
  created:
    - backend/api/src/routes/storage.ts
  modified:
    - backend/api/src/app.ts
    - backend/api/vercel.json
decisions:
  - storageCleanupRouter is a separate Hono instance without authMiddleware — required because storageRouter.use('*', authMiddleware) would block CRON_SECRET-authenticated cron requests
  - Promise.allSettled used for per-folder enumeration so one failing user folder does not abort the entire cleanup run
  - Single batch remove call per bucket (not per folder) — minimizes Supabase Storage API calls
  - scan-photos 90-day retention, exports 7-day retention per INFRA-02 requirement
metrics:
  duration: "~2 minutes"
  completed: "2026-04-05"
  tasks_completed: 2
  files_modified: 3
---

# Phase 15 Plan 01: Storage Lifecycle Cleanup Summary

Vercel cron endpoint that purges stale Supabase Storage objects — scan-photos older than 90 days and exports older than 7 days — authenticated via CRON_SECRET, running daily at 4am UTC.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add storageCleanupRouter with POST /cron/cleanup | 7100859 | backend/api/src/routes/storage.ts, backend/api/src/app.ts |
| 2 | Add Vercel cron entry for daily cleanup | 175419e | backend/api/vercel.json |

## What Was Built

**`backend/api/src/routes/storage.ts`** — New file containing two Hono routers:
- `storageRouter` — existing user-facing router with JWT authMiddleware, exposes `POST /storage/upload-url` for signed upload URLs
- `storageCleanupRouter` — cron-only router without authMiddleware, exposes `POST /storage/cron/cleanup`

The cleanup handler:
1. Validates `Authorization: Bearer ${CRON_SECRET}` header (returns 401 on mismatch)
2. Calls `cleanupBucket('scan-photos', 90 days)` and `cleanupBucket('exports', 7 days)`
3. Returns `{ success: true, deleted: { scan_photos: N, exports: N }, errors: [] }`

The `cleanupBucket` function:
- Lists root-level folders (user ID prefixes) with `supabase.storage.from(bucket).list('', { limit: 1000 })`
- Uses `Promise.allSettled` to enumerate files per folder — one folder failure doesn't abort the run
- Filters files where `created_at < cutoff`
- Deletes all expired paths in a single batch `supabase.storage.from(bucket).remove(expiredPaths)`

**`backend/api/src/app.ts`** — Added import of `storageCleanupRouter` and mounted both routers:
```typescript
app.route('/storage', storageRouter);
app.route('/storage', storageCleanupRouter);
```

**`backend/api/vercel.json`** — Added second cron entry:
```json
{ "path": "/storage/cron/cleanup", "schedule": "0 4 * * *" }
```

## Decisions Made

1. **Separate router for cron** — `storageCleanupRouter` is a distinct Hono instance with no global middleware. `storageRouter` has `authMiddleware` applied via `.use('*', ...)` which would reject CRON_SECRET bearer tokens. Using two routers mounted at the same `/storage` prefix lets Hono route correctly to each.

2. **Promise.allSettled for fault tolerance** — Per-folder enumeration uses `Promise.allSettled` so a single inaccessible user folder (permissions error, network blip) records an error string but does not prevent other folders from being processed or other buckets from running.

3. **Single batch delete per bucket** — All expired paths collected from all folders are deleted in one `remove()` call per bucket, minimizing Supabase Storage API round-trips.

## Deviations from Plan

None — plan executed exactly as written. `storage.ts` did not previously exist; the plan correctly described it as a new file to create.

## Known Stubs

None — the endpoint is fully functional. No hardcoded empty values or placeholder data.

## Verification Results

- TypeScript compilation: PASSED (`npx tsc --noEmit`)
- Cron entry validation: PASSED (`node -e "require('./vercel.json')"` — 2 entries, correct schedule)
- All acceptance criteria met

## Self-Check: PASSED

Files verified:
- FOUND: backend/api/src/routes/storage.ts
- FOUND: backend/api/src/app.ts (contains storageCleanupRouter)
- FOUND: backend/api/vercel.json (contains /storage/cron/cleanup)

Commits verified:
- FOUND: 7100859 feat(15-01): add storageCleanupRouter with POST /cron/cleanup endpoint
- FOUND: 175419e chore(15-01): add Vercel cron entry for daily storage cleanup at 4am UTC
