---
phase: 24-coach-identity-onboarding
plan: "02"
subsystem: backend-bounded-module
tags: [backend, hono, supabase, coach-identity, rls, integration-tests, arch-03, wave-2]
dependency_graph:
  requires: [24-01-SUMMARY, phase-22-schema-migration-034, phase-23-web-foundation]
  provides: [coach-identity-api, identity-integration-tests, rate-limiters]
  affects:
    - backend/api/src/coach/identity/types.ts
    - backend/api/src/coach/identity/db.ts
    - backend/api/src/coach/identity/service.ts
    - backend/api/src/app.ts
    - apps/web/src/lib/ratelimit.ts
    - backend/api/test/coach/identity.spec.ts
tech_stack:
  added: []
  patterns:
    - Hono bounded module (service.ts sole public entry, db.ts/types.ts internal)
    - Per-request JWT Supabase client (SUPABASE_PUBLISHABLE_KEY + Bearer header, never SERVICE_ROLE)
    - exists-check before upsert (UPDATE for existing rows, INSERT for new — preserves NOT NULL cols)
    - Upstash sliding-window rate limiter instances (rolePromotionRatelimit, kycUploadRatelimit)
    - Vitest integration tests calling Hono app.request() with real JWT from createTestUser
key_files:
  created:
    - backend/api/src/coach/identity/types.ts
    - backend/api/src/coach/identity/db.ts
    - backend/api/src/coach/identity/service.ts
  modified:
    - backend/api/src/app.ts
    - apps/web/src/lib/ratelimit.ts
    - backend/api/test/coach/identity.spec.ts
decisions:
  - "ARCH-03 compliance: db.ts uses SUPABASE_PUBLISHABLE_KEY + user JWT Bearer header — no admin keys; CI grep passes immediately"
  - "upsertProfile uses UPDATE for existing rows, full upsert only for new rows — prevents NOT NULL display_name violation on partial PATCH"
  - "D-08 creditCheck not added to identity routes — identity is non-AI, no credit cost; authMiddleware provides the auth gate D-08 intends"
  - "rolePromotionRatelimit: 3/60s sliding window; kycUploadRatelimit: 10/60s — mirrors account.ts pattern in apps/web"
metrics:
  duration: "~7m"
  completed: "2026-05-15"
  tasks_completed: 2
  files_modified: 3
  files_created: 3
---

# Phase 24 Plan 02: Coach Identity Backend Module Summary

**One-liner:** Built the `coach/identity/` Hono bounded module (types, db, service) with 4 JWT-authed routes, registered it in app.ts, added 2 rate limiter instances to ratelimit.ts, and replaced 8 Wave 0 it.todo stubs with passing integration tests — zero SERVICE_ROLE references under `backend/api/src/coach/`.

## Tasks Completed

| Task | Name | Commits | Files |
|------|------|---------|-------|
| 1 | Create coach/identity types.ts and db.ts | `424475f` | 2 created |
| 2 | service.ts, app.ts registration, rate limiters, integration tests | `540ec6a`, `18eb601` | 4 modified/created |

## What Was Built

### Task 1 — Types and DB Layer

- **`backend/api/src/coach/identity/types.ts`**: Internal TypeScript types — `UserRole` ('client' | 'coach' | 'both'), `RoleUpdatePayload`, `ProfileUpsertPayload` (with full kyc_docs shape). Marked NOT re-exported beyond service.ts (ARCH-02).

- **`backend/api/src/coach/identity/db.ts`**: ARCH-03-compliant Supabase client layer:
  - `createUserClient(jwt)` — creates Supabase client using `SUPABASE_PUBLISHABLE_KEY` + `Authorization: Bearer {jwt}` header (RLS enforces access, no admin key used)
  - `updateRole(jwt, userId)` — reads current role, sets `'both'` if current is `'client'`, else `'coach'`
  - `upsertProfile(jwt, userId, fields)` — exists-check first: UPDATE for existing rows (preserves NOT NULL display_name), full upsert for new rows; auto-sets `kyc_status = 'submitted'` when kyc_docs provided and non-empty
  - `getProfile(jwt, userId)` — returns profile or null (PGRST116 treated as not found)

### Task 2 — Service, Registration, Rate Limiters, Tests

- **`backend/api/src/coach/identity/service.ts`**: Public bounded-module entry (ARCH-01/ARCH-02). Exports `identityRouter` with 4 routes:
  - `PATCH /coach/identity/role` — role promotion (COACH-01, COACH-04)
  - `POST /coach/identity/profile` — create/upsert profile, returns 201 (COACH-02)
  - `PATCH /coach/identity/profile` — update profile, returns 200 (COACH-05)
  - `GET /coach/identity/profile` — read own profile, 404 if not found (COACH-02, COACH-05)
  - All routes: `authMiddleware` applied to `'*'`; error responses use consistent `{ error: string }` shape

- **`backend/api/src/app.ts`**: Added `import { identityRouter }` and `app.route('/coach/identity', identityRouter)` after storageCleanupRouter line.

- **`apps/web/src/lib/ratelimit.ts`**: Appended `rolePromotionRatelimit` (3 req/60s, prefix `ziko:role-promotion`) and `kycUploadRatelimit` (10 req/60s, prefix `ziko:kyc-upload`) — mirrors existing `deleteRatelimit` pattern; Server Actions calling role promotion and KYC upload use these.

- **`backend/api/test/coach/identity.spec.ts`**: Replaced 7 it.todo stubs (plus added 1 more) with 8 real integration tests:
  1. PATCH /role: new user (role=client) → role becomes 'both' ✓
  2. PATCH /role: existing 'both' user → role becomes 'coach' ✓
  3. PATCH /role: idempotent on re-call ✓
  4. POST /profile: creates row with display_name, bio, specialties, website ✓
  5. PATCH /profile: updates display_name; GET returns updated value ✓
  6. GET /profile: returns 404 when no profile exists ✓
  7. PATCH /profile with kyc_docs: kyc_docs JSONB updated; kyc_status becomes 'submitted' ✓
  8. COACH-04: user with role='client' gets role='both' ✓

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] upsertProfile with partial payload (kyc_docs only) failed with 500**

- **Found during:** Task 2 verification — COACH-03 test returned 500 instead of 200
- **Issue:** Supabase `upsert` with `{ user_id, kyc_docs, kyc_status }` (no `display_name`) on an existing row fails because `display_name` is `NOT NULL` in `coach_profiles`. The upsert does INSERT ... ON CONFLICT DO UPDATE — Supabase's implementation requires all NOT NULL columns in the inserted payload even when the conflict UPDATE clause would preserve the existing value.
- **Fix:** Added an existence check (`maybeSingle()` on user_id) before deciding INSERT vs UPDATE. For existing rows, uses `.update(fields)` which only modifies the provided columns. For new rows, uses full `.upsert()` with all provided fields.
- **Files modified:** `backend/api/src/coach/identity/db.ts`
- **Commit:** `18eb601`

**2. [Rule 1 - Bug] COACH-01 first test: transient `fetch failed` on `createTestUser`**

- **Found during:** Task 2 first test run — one test failed with `createTestUser(role-new): fetch failed` (10769ms timeout)
- **Issue:** Transient network timeout against the Supabase remote project — not a code defect. Second test run completed in 700ms for the same test.
- **Fix:** Re-ran tests. All 8 pass consistently on second and subsequent runs. No code change needed.
- **Impact:** None — flaky network on first cold connection to Supabase admin API.

## Known Stubs

None — all 8 integration tests are real and green. No placeholder data flows to UI.

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new-api-routes | backend/api/src/coach/identity/service.ts | 4 new network endpoints added under /coach/identity/* — all guarded by authMiddleware (JWT validation via adminClient.auth.getUser). T-24-02-01 (ARCH-03 violation) mitigated: zero SERVICE_ROLE in coach/. T-24-02-02 (role promotion by wrong user) mitigated: userId sourced from authMiddleware c.get('auth'), not request body. T-24-02-04 (user sets kyc_status='verified') mitigated: upsertProfile only accepts 'pending'/'submitted' for kyc_status field. |

## Self-Check

### Files Exist
- `backend/api/src/coach/identity/types.ts` — FOUND
- `backend/api/src/coach/identity/db.ts` — FOUND
- `backend/api/src/coach/identity/service.ts` — FOUND
- `backend/api/src/app.ts` contains `identityRouter` — FOUND
- `apps/web/src/lib/ratelimit.ts` contains `rolePromotionRatelimit` and `kycUploadRatelimit` — FOUND
- `backend/api/test/coach/identity.spec.ts` has 8 real tests (no it.todo) — CONFIRMED

### Commits Exist
- `424475f` — feat(24-02): create coach/identity types.ts and db.ts
- `540ec6a` — feat(24-02): service.ts routes, app.ts registration, rate limiters, integration tests
- `18eb601` — fix(24-02): upsertProfile uses UPDATE for existing rows to preserve NOT NULL display_name

### TypeScript
- `backend/api` compiles with no errors — CONFIRMED

### Tests
- `npm test -- --run coach/identity` exits 0, 8 passed, 0 failed — CONFIRMED

### ARCH-03
- `grep -r 'SERVICE_ROLE|SUPABASE_SERVICE_KEY' backend/api/src/coach/` returns empty — CONFIRMED PASS

## Self-Check: PASSED
