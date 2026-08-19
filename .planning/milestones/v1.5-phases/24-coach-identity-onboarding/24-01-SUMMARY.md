---
phase: 24-coach-identity-onboarding
plan: "01"
subsystem: backend-housekeeping
tags: [housekeeping, migration, storage, testing, wave-0]
dependency_graph:
  requires: [phase-23-complete]
  provides: [coach-kyc-bucket, wave-0-test-stub, clean-codebase]
  affects: [backend/api/src/app.ts, backend/api/src/routes/storage.ts, supabase/migrations]
tech_stack:
  added: []
  patterns:
    - SQL migration bucket provisioning (INSERT INTO storage.buckets — established pattern)
    - Path-prefix RLS on storage.objects (storage.foldername(name))[1] = auth.uid()::text
    - Vitest it.todo stub pattern for Wave 0 Nyquist requirement
key_files:
  created:
    - supabase/migrations/037_coach_kyc_bucket.sql
    - backend/api/test/coach/identity.spec.ts
  modified:
    - backend/api/src/app.ts
    - backend/api/src/routes/storage.ts
  deleted:
    - apps/web/src/app/[locale]/(coach)/coach/_smoke/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/_smoke/action.ts
    - apps/web/src/app/[locale]/(coach)/coach/_smoke/SmokeButton.tsx
    - apps/web/src/app/api/_debug/limits/route.ts
    - backend/api/src/routes/_debug.ts
decisions:
  - Supabase Storage bucket provisioned via SQL migration (INSERT INTO storage.buckets) — consistent with migrations 017 and 025; no MCP supabase_storage_create_bucket tool needed
  - Applied migration via supabase CLI db query --linked (project ref slkobhavpwsubnsmuhya) — bucket and 3 RLS policies verified in pg_policies
  - Wave 0 test stub uses it.todo (not it.skip) so Vitest reports pending count clearly without failing
  - .env.test required for test run — copied from main repo; CI has env vars natively
metrics:
  duration: "~15m (including interruption recovery)"
  completed: "2026-05-15"
  tasks_completed: 2
  files_modified: 6
  files_deleted: 5
  files_created: 2
---

# Phase 24 Plan 01: Housekeeping & Wave 0 Test Scaffolding Summary

**One-liner:** Deleted 5 Phase 23 temporary files, applied coach-kyc private storage bucket via SQL migration with 3 RLS policies, extended storage allowlist, and created Wave 0 Vitest stub for COACH-01 through COACH-04 integration tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Delete Phase 23 smoke/debug files and clean app.ts | `555e0d4` | 5 deleted, 1 modified |
| 2 | Migration 037 + storage allowlist + Wave 0 test stub | `35ed54e` | 2 created, 1 modified |

## What Was Built

### Task 1 — Phase 23 Cleanup
- Deleted `_smoke/` route group (3 files: `page.tsx`, `action.ts`, `SmokeButton.tsx`) — Phase 23 smoke test superseded
- Deleted `apps/web/src/app/api/_debug/limits/route.ts` — Vercel Pro probe; evidence captured in `23-VERIFICATION.md`
- Deleted `backend/api/src/routes/_debug.ts` — no production purpose; marked DELETE IN PHASE 24 in Phase 23-07
- Removed `import debugRoute from './routes/_debug.js'` and `app.route('/_debug', debugRoute)` from `backend/api/src/app.ts` atomically with file deletion (per Pitfall 8)
- TypeScript compilation of `backend/api` passes with no errors

### Task 2 — Infrastructure
- **`supabase/migrations/037_coach_kyc_bucket.sql`**: Private `coach-kyc` bucket (`public: false`) + 3 RLS policies (`coach_kyc_insert`, `coach_kyc_select`, `coach_kyc_delete`) enforcing path-prefix ownership `(storage.foldername(name))[1] = auth.uid()::text`. Includes `SET LOCAL lock_timeout = '5s'` per Phase 22 pattern.
- **Migration applied** to project `slkobhavpwsubnsmuhya` via `supabase db query --linked`. Bucket existence and all 3 policies verified via `pg_policies` query.
- **`backend/api/src/routes/storage.ts`**: `ALLOWED_BUCKETS` extended from 3 to 4 entries — `'coach-kyc'` added. This enables the existing `/storage/upload-url` endpoint to accept `coach-kyc` bucket for KYC doc and profile photo uploads (Plan 24-02+).
- **`backend/api/test/coach/identity.spec.ts`**: 7 `it.todo` stubs across 4 describe blocks matching COACH-01 through COACH-04. Mirrors `test/rls/coach-profiles.spec.ts` structure (`afterAll` cleanup pattern, admin client). Vitest exits 0 with 8 todos, 0 failures.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `.env.test` missing in worktree**

- **Found during:** Task 2 verification — `npm test -- --run coach/identity` failed with `Missing required env var: SUPABASE_URL`
- **Issue:** The worktree doesn't inherit `.env.test` from the main repo. `vitest.config.ts` registers `test/setup.ts` as a global `setupFiles` which validates env vars for ALL test files, including stubs with no real assertions.
- **Fix:** Copied `/c/ziko-platform/backend/api/.env.test` to the worktree. CI has env vars natively so this is a worktree-only concern.
- **Files modified:** `backend/api/.env.test` (gitignored — not committed)
- **Impact:** None on production; test passes in CI as-is.

## Known Stubs

`backend/api/test/coach/identity.spec.ts` — 7 `it.todo` stubs intentional. Real implementations fill these in Plan 24-02 after `backend/api/src/coach/identity/service.ts` is created. This is the Wave 0 Nyquist requirement.

## Threat Surface Scan

No new network endpoints or auth paths introduced in this plan. Deletions reduce attack surface (T-24-01-02: `_debug` routes removed). Migration 037 adds `coach-kyc` bucket with owner-only RLS — no cross-user access path introduced (T-24-01-01 mitigated per plan threat model).

## Self-Check

### Files Exist
- `supabase/migrations/037_coach_kyc_bucket.sql` — FOUND
- `backend/api/test/coach/identity.spec.ts` — FOUND
- `backend/api/src/routes/storage.ts` contains `'coach-kyc'` — FOUND
- `backend/api/src/app.ts` contains no `_debug` reference — CONFIRMED CLEAN

### Commits Exist
- `555e0d4` — FOUND (chore: delete Phase 23 smoke/debug files)
- `35ed54e` — FOUND (feat: migration 037 + storage allowlist + Wave 0 stub)

### TypeScript
- `backend/api` compiles with no errors — CONFIRMED

### Tests
- `npm test -- --run coach/identity` exits 0, 8 todos, 0 failures — CONFIRMED

## Self-Check: PASSED
