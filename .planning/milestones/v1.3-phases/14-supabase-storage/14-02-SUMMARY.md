---
phase: 14-supabase-storage
plan: 02
subsystem: backend
tags: [storage, supabase, signed-url, hono, api]
dependency_graph:
  requires: [14-01]
  provides: [STORE-02, STORE-03, STORE-04]
  affects: [backend/api/src/routes/storage.ts, backend/api/src/app.ts]
tech_stack:
  added: []
  patterns: [hono-router, supabase-storage-sdk, auth-middleware, bucket-allowlist, path-prefix-enforcement]
key_files:
  created:
    - backend/api/src/routes/storage.ts
  modified:
    - backend/api/src/app.ts
decisions:
  - "createSignedUploadUrl in this SDK version does not accept expiresIn option — TTL is fixed server-side; call made without options argument"
  - "Supabase client uses SUPABASE_SERVICE_KEY ?? SUPABASE_PUBLISHABLE_KEY fallback matching auth.ts pattern"
metrics:
  duration: "4 minutes"
  completed: "2026-04-03"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
---

# Phase 14 Plan 02: Storage Upload URL Endpoint Summary

**One-liner:** Hono GET /storage/upload-url endpoint — bucket allowlist + userId path-prefix enforcement + Supabase createSignedUploadUrl returning { upload_url, path, token }.

## What Was Built

- `backend/api/src/routes/storage.ts` — new Hono router protected by `authMiddleware`, with a single `GET /upload-url` handler that validates `bucket` (allowlist: profile-photos, scan-photos, exports) and `path` (must start with `${userId}/`), then calls `supabase.storage.from(bucket).createSignedUploadUrl(path)` and returns `{ upload_url, path, token }`.
- `backend/api/src/app.ts` — import and mount of `storageRouter` at `/storage`, after the existing pantry router.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | c28e4b0 | feat(14-02): add GET /storage/upload-url signed upload URL endpoint |
| Task 2 | ca2f637 | feat(14-02): mount storageRouter at /storage in app.ts |

## Verification Results

- TypeScript compiles with zero errors after both tasks
- `backend/api/src/routes/storage.ts` exists with all required acceptance criteria met
- `grep "storageRouter" backend/api/src/app.ts` returns 2 matches (import + route mount)
- Bucket allowlist `['profile-photos', 'scan-photos', 'exports']` present in storage.ts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unsupported `{ expiresIn: 60 }` argument from createSignedUploadUrl**
- **Found during:** Task 1 TypeScript verification
- **Issue:** The plan called `createSignedUploadUrl(path, { expiresIn: 60 })` but in this version of `@supabase/storage-js`, the second argument's type only accepts `{ upsert?: boolean }` — `expiresIn` is not a valid option. TypeScript error: `TS2353 Object literal may only specify known properties, and 'expiresIn' does not exist in type '{ upsert: boolean; }'`
- **Fix:** Removed the options argument — `createSignedUploadUrl(path)` with no second argument. Signed upload URL TTL is fixed server-side by Supabase; it cannot be configured per-call in this SDK version.
- **Files modified:** `backend/api/src/routes/storage.ts`
- **Commit:** c28e4b0

## Known Stubs

None — this is a pure backend route with no UI components.

## Self-Check: PASSED

All files created/modified confirmed present. All commits (c28e4b0, ca2f637) confirmed in git log.
