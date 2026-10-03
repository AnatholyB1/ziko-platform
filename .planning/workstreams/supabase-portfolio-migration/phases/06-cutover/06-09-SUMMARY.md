---
phase: 06-cutover
plan: 09
subsystem: cutover-code-flip
tags: [signup-flag, storage-auth-harness, coach-routes]
requires: [06-08, 06-03]
provides:
  - "register.tsx sends app 'ziko' at signup (D-14)"
  - "storage auth harness runs the 6 carried coach routes as real cases in full and smoke modes"
affects: [06-10, 06-12, 06-15]
key-files:
  modified:
    - apps/mobile/app/(auth)/register.tsx
    - scripts/portfolio-migration/10-storage-auth-backend.ts
    - scripts/portfolio-migration/10-storage-auth-tests.mjs
    - scripts/portfolio-migration/10-storage-auth-tests.test.mjs
decisions:
  - "Fixture rows are inserted after the storage cases (new active C->A link, video, annotation, coach exercise) and cleaned before users are deleted"
  - "GET /coach/exercises/:id/media-url returns 200 with null URLs for unlinked callers, so the child maps an all-null body to deny"
metrics:
  tasks: 2
  completed: 2026-10-03
---

# Phase 6 Plan 09: Signup flag and real coach route cases Summary

Mobile signup now sends `options.data { app: 'ziko', full_name }`, and the 6 coach routes deferred in Phase 5 run as real harness cases in both full and smoke modes. Nothing was run against Supabase, and nothing was pushed.

## Commits (branch gsd/phase-6-cutover, local only)

| Commit | Message |
|--------|---------|
| 252367f4 | feat(06-09): flag mobile signups with app ziko (D-14) |
| 195ca82e | feat(06-09): real coach route cases in storage auth harness |

## Task 1: signup call-site audit

Grep over `apps`, `backend/api/src`, `backend/api/test`, `plugins`, `packages` (ts, tsx):

| Call-site | Status |
|-----------|--------|
| apps/mobile/app/(auth)/register.tsx `auth.signUp` | Flag added in this task |
| backend/api/test/rls/fixtures.ts `admin.createUser` | Already had `user_metadata: { app: 'ziko' }` |

No other `signUp(` or `createUser(` call exists in those roots. Scripts outside the plan's scope, for information only:

- `scripts/portfolio-migration/10-storage-auth-tests.mjs` and `lib-cutover.mjs` are flagged or are migration tooling.
- `scripts/portfolio-migration/04-rls-smoke-test.js:93` creates a user with no `app` flag. It is an old migration script, not product code, and I did not change it (flag if it is reused against portfolio).

`welcome.tsx` is untouched and OAuth stays disabled. No lazy-provisioning fallback was added. Mobile type-check (`tsc --noEmit` in apps/mobile) passes. The `npx turbo run type-check --filter=mobile` form failed because the `npx` wrapper did not find turbo, so I ran the workspace script directly.

## Task 2: harness changes

- Route cases (all in `full` and `smoke`): `bk-clients-links-me` (A, allow), `bk-videos-upload-url` (A, allow, no object written), `bk-videos-signed-url` (C allow) with `-foreign` (D deny), `bk-videos-audio-url` (C allow) with `-foreign` (D deny), `bk-exercises-media-url` (A allow) with `-foreign-athlete` (B deny) and `-foreign-coach` (D deny), `bk-imports-create` (C allow, 201 mapped to allow).
- `deferred-table-codemod` is gone from the backend child and the harness (0 occurrences). `--with-codemod-patch` prints `obsolete: codemods are in the tree` and exits 2, and the patch helpers were removed.
- Fixture tables (inserted for test user ids only): `ziko_coach_client_links`, `ziko_coach_client_videos`, `ziko_coach_video_annotations`, `ziko_coach_exercises`. `ziko_ai_imports` gets a row from the imports route. Cleanup deletes all five by test ids before deleting users, and the leftover assertion counts each table.
- Verification: `node --test` offline suite 18/18, `tsx 10-storage-auth-backend.ts --selfcheck` prints `{"selfcheck":"ok"}`.

## Deviations from Plan

**1. [Rule 1 - Plan inaccuracy] Table names.** The plan names `ziko_coach_videos` and `ziko_ai_imports`-adjacent tables loosely. The real tables, taken from the portfolio schema and the handlers, are `ziko_coach_client_videos` and `ziko_coach_video_annotations`. I used those.

**2. [Rule 2 - Missing] 201 status.** `POST /coach/imports` returns 201, so `statusFromHttp` maps 200 and 201 to allow (the plan did not mention this).

**3. Extra negative cases.** I added `-foreign` cases for audio-url and for both a foreign athlete and a foreign coach on media-url, in addition to the one the plan listed.

No 404 mapping was needed: foreign callers get 403, or 200 with null URLs for media-url.

## Risks and notes for later plans

- Signing requires an existing storage object. Full mode points the fixtures at objects the matrix uploaded or seeded. Smoke mode (no object written) uses an existing object of the bucket, so a portfolio `ziko-coach-videos` or `ziko-coach-exercises` bucket with no objects would make those cases report `error`. They would fail visibly, not pass silently.
- Smoke mode now writes DB fixture rows (test ids, cleaned), not storage objects. This is what the plan prescribes, but it is a change for the portfolio smoke run (06-10, 06-12, 06-15).
- The live harness was not executed in this plan (no Supabase writes); the new cases are proven only offline and by the child self-check.
- The old reports `reports/*-storage-auth.json` and the RUNBOOK still describe the Phase 5 deferred shape. Left as history.

## Known Stubs

None.

## Threat Flags

None. No new endpoints or schema changes. Harness fixtures are restricted to test user ids (T-6-38).

## Self-Check: PASSED

- register.tsx contains `app: 'ziko', full_name: name`.
- Commit 252367f4 exists; the harness commit is the HEAD commit before this summary.
- Zero `deferred-table-codemod` in the two harness files.
