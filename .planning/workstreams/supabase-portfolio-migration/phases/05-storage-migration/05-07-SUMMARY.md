---
phase: 05-storage-migration
plan: 07
subsystem: storage-migration
tags: [storage, rls, test-harness, supabase, tdd]
requires:
  - scripts/portfolio-migration/lib-storage.mjs (targetBucketId)
  - scripts/portfolio-migration/lib-verify.mjs (assertReportSafe)
  - scripts/auth-merge/lib.mjs (PROJECTS, parseCliArgs, assertWriteAllowed, getProjectApiKeys, runSql)
provides:
  - scripts/portfolio-migration/10-storage-auth-tests.mjs (orchestrator + pure matrix/guards)
  - scripts/portfolio-migration/10-storage-auth-backend.ts (in-process Hono child)
  - apps/web/src/app/api/__live__/storage-routes.live.test.ts (live web route spec, skipped by default)
affects:
  - Phase 5 plans 09 (scratch full run) and 11 (portfolio smoke run)
tech-stack:
  added: []
  patterns: [real-session RLS testing, tsx child with target env, fixture-gated vitest spec, patch apply/reverse guard]
key-files:
  created:
    - scripts/portfolio-migration/10-storage-auth-tests.mjs
    - scripts/portfolio-migration/10-storage-auth-tests.test.mjs
    - scripts/portfolio-migration/10-storage-auth-backend.ts
    - apps/web/src/app/api/__live__/storage-routes.live.test.ts
  modified: []
key-decisions:
  - "Matrix cases reference SOURCE bucket ids and resolve target ids from the bucket map at run time (no literal ziko- ids in the code)"
  - "Statuses are a closed set: allow, deny, reject (mime/size), baseline (D-02 quirks), deferred-table-codemod, error; only status === expect passes"
  - "All six backend coach storage paths query unprefixed tables, so the child reports them as deferred-table-codemod with their route (Phase 6 smoke items); none is counted as pass"
  - "Smoke mode uses an existing copied object per bucket (SQL pick, name never printed) and only issues signed upload URLs, never writes an object"
  - "Web spec writes observed statuses to ZIKO_STORAGE_LIVE_RESULTS so the orchestrator compares observation to expectation, not just vitest pass/fail"
requirements-completed: [STORAGE-04]
duration: ~45 min
completed: 2026-10-02
---

# Phase 5 Plan 07: Storage Auth Test Harness Summary

STORAGE-04 harness: throwaway athlete/outsider/coach/unlinked-coach users, real signInWithPassword JWTs, a 55-case matrix over all 10 ziko- buckets and 6 app surfaces, real backend and web code paths, guaranteed cleanup, and a PII-safe report. Built and unit-tested only; nothing was run against any project (execution is in plans 09 and 11).

## Tasks

| Task | Commits |
|------|---------|
| 1. Orchestrator pure parts with tests (TDD) | RED c10ae622, GREEN ab286c22 |
| 2. Live runner, backend tsx child, web live spec, cleanup | 89822de7 |

## Verification

- `node --test 10-storage-auth-tests.test.mjs`: 16 pass, 0 fail (run guards, matrix shape and per-bucket coverage, smoke has no write op, evaluation incl. baseline and deferred, email format, report safety, fixture write).
- `--help` exits 0; ziko (any mode) and portfolio full both refused with exit 1 without touching the network.
- Web live spec: `npx vitest run src/app/api/__live__` in apps/web reports 5 skipped without the env var; no tsc errors reported for the spec.
- Backend child `--selfcheck` (dummy env, no network): app.ts imports under tsx and exposes `request()`.
- Acceptance greps: 0 literal ziko- bucket ids in the three files; `signInWithPassword` present; `deferred-table-codemod` present in the backend child; fixture path is git-ignored; `SUPABASE_SERVICE_ROLE_KEY` count under backend/api/src is 0 (unchanged).

## Service-client confinement (T-5-27)

User-session clients (publishable key + signInWithPassword) perform every allow/deny case. The service-role `admin` client appears only in: `createUsers` (Admin API), `seedObjects` (setup, full mode), `cleanup`, and the `service-upload` op used by the two exercise-media size/mime limit cases that the plan itself specifies as service uploads. Link/revoke/cleanup SQL goes through `runSql`.

## Deviations from Plan

**1. [Rule 2 - Missing critical] Extra guards**
- Refusal of any project other than scratch/portfolio (exit 1), and `assertWriteAllowed` called in smoke mode too since users are created on the shared portfolio auth pool.
- Cleanup also asserts zero remaining objects under the test users' folders (SQL count) in addition to zero users.

**2. Backend coach functions**
- The plan asked to call coach storage-signing helpers that perform no table query. Reading the source showed none exist as exported, table-free functions (`signCoachPhoto` is private and only reached through table-querying code), so all six coach storage routes are recorded as `deferred-table-codemod`.

**3. Extra matrix cases**
- Added `ai-backend-own` / `ai-backend-foreign` (backend /storage/upload-url on ai-imports, allowed by the route) and `sp-sign-upload-own` (smoke-safe signed-URL issuance).

## Notes for plans 09 / 11

- Backend and web code still name the old bucket ids until Phase 6. The backend upload-url cases and web handler cases only pass with `--with-codemod-patch <patch>` (a patch of the codemod output); without it they report `reject` and fail by design.
- `bucket-map.generated.json` must exist next to the script (or be passed via `--bucket-map`).
- On scratch `full`, the `ck-web-photo-own` case relies on the orchestrator's coach-kyc seed object for user C.
- Smoke on portfolio needs at least one copied object per bucket; an empty bucket yields status `error` for its read cases.
- An aborted run leaves no state beyond what `finally` cleans; a hard kill (SIGKILL) could leave `ziko-storage-test-*@example.com` users, which a re-run does not remove automatically.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register (T-5-27..31 mitigations implemented: user-JWT cases, finally cleanup + SQL assertions, gitignored fixture deleted in finally, report through assertReportSafe, patch reverse + clean assertion, full/ziko/confirm-ref guards).

## Self-Check: PASSED

Files and commits (c10ae622, ab286c22, 89822de7) verified present.
