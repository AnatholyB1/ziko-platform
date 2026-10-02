---
phase: 05-storage-migration
plan: 09
subsystem: storage-migration
tags: [storage, scratch-rehearsal, rls, verification, runbook]
requires: ["05-03", "05-04", "05-05", "05-06", "05-07", "05-08"]
provides:
  - "Scratch rehearsal verdict gating 05-10"
  - "scripts/portfolio-migration/reports/scratch-{storage-copy,load-phase5,storage-verify,storage-auth}.json"
  - "RUNBOOK Phase 5 section (5.1-5.8, 5.6a)"
key-files:
  created:
    - scripts/portfolio-migration/reports/scratch-storage-copy.json
    - scripts/portfolio-migration/reports/scratch-load-phase5.json
    - scripts/portfolio-migration/reports/scratch-storage-verify.json
    - scripts/portfolio-migration/reports/scratch-storage-auth.json
  modified:
    - scripts/portfolio-migration/RUNBOOK.md
    - scripts/portfolio-migration/lib-storage.mjs
    - scripts/portfolio-migration/lib-storage.test.mjs
    - scripts/portfolio-migration/10-storage-auth-tests.mjs
requirements-completed: [STORAGE-01, STORAGE-02, STORAGE-03, STORAGE-04]
completed: 2026-10-02
---

# Phase 5 Plan 09: Scratch rehearsal Summary

SCRATCH REHEARSAL: PASS

The full Phase 5 sequence ran on scratch (`rkirvurggtgjlkeuhded`) only. Task 1 (token) was already satisfied; the token was never printed or committed and the file is kept for 05-10/05-11. No write was made to ziko or portfolio (portfolio was not touched at all; ziko only read).

## Command order executed (scratch)

1. Auth precondition: seed-collision --reset/--seed, 02-import-auth --apply (38 users, 1 collision, remap regenerated), 06-verify users PASS, identities PASS (one transient Bun crash on the first identities run; the immediate re-run passed).
2. Tenant baseline snapshot (0 non-ziko buckets, 0 non-ziko policies).
3. Policies FIRST: `07 --check` ok (10 buckets, 25 policies, 0 stale), then `07 --apply`: 25 ziko_ policies applied, before any bucket or object write.
4. `08 --plan` exit 0, `08 --apply`: copied 2699, failed 0, 214,205,001 bytes, 10 buckets converged.
5. Loader: `--plan` (source URL scan total 3), `--probe` (replica mode), `--apply` (20,897 rows over 99 tables, url_rewrites 2 in user_profiles + 1 in body_measurements = 3); `06-verify-data --check all` PASS (counts 99/99, rls, triggers, fk, orphans, sequence, remap).
6. `09-verify-storage --check all` (with tenant baseline) PASS: buckets 10/10, policies 25/25, objects 2699 = 2699 with equal bytes, hashes 2699 with 0 mismatches (no sampling), rekey 36 of 36 under the target UUID and 0 under the source UUID, urls 0 leftovers with rewritten rows 3 = 3, tenants 0 regressions.
7. `10-storage-auth-tests --mode full --with-codemod-patch`: PASS (pass 50, fail 0, deferred 6, missing 0). Source tree porcelain clean afterwards, no leftover temp files, harness cleanup asserted zero test users and objects.
8. Idempotence: second `08 --apply` copied 0, failed 0, destination-only 0; `09-verify-storage --check all` and `06-verify-data --check all` green again.

## Assumption results

- **A1 (policy privilege): resolved, OK.** The probe reported `current_user=postgres`, `objects_owner=supabase_storage_admin`, `member=false`, and `07 --apply` nevertheless created all 25 policies on `storage.objects`. No privilege fallback was needed (no checkpoint).
- **A2 (cache-control fidelity): preserved.** 31 objects needed the raw-header upload path; verify-storage reported zero cache-control mismatches (no warning) over 2699 objects.
- **A6 (ai-imports sizes): fits.** ai-imports has 9 objects totalling 27,234,830 bytes (about 3.0 MB average); the largest object across all buckets is 4,579,734 bytes (about 4.4 MB). The global storage limit check was ok. Per-bucket maximum for ai-imports alone is not recorded separately; it is bounded above by 4,579,734.

## Matrix (per surface, all pass)

mobile-profile 10, web-coach 14, plugin-coach 12, storage-only 5, plugin-nutrition 5, backend 4 (+6 deferred). Per bucket: avatars 5, coach-logos 3, exercise-media 4, profile-photos 5, scan-photos 7, coach-kyc 9, coach-exercises 3, exports 3, ai-imports 6, coach-videos 11 (all ok, 0 bad).

D-02 baseline observations: `pp-baseline-public-url` observed `baseline` (profile-photos public URL does not serve, the bucket is private) and `pp-baseline-remove` observed `baseline` (no DELETE policy, removal affects 0 objects). Carried as is.

## Handed to Phase 6 (deferred-table-codemod routes, named smoke items)

- GET /coach/clients/links/me
- POST /coach/videos/upload-url
- GET /coach/videos/:videoId/signed-url
- GET /coach/videos/annotations/:annotationId/audio-url
- GET /coach/exercises/:id/media-url
- POST /coach/imports

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] False policy mismatch on `ziko_coach_videos_coach_read`**
- **Found during:** Task 2 step 6 (first verify-storage run FAILED on policies, 24/25).
- **Issue:** `pg_policies` deparses `public.ziko_is_coach_of(...)` without the schema because `public` is on the search_path, while the expected expression keeps the prefix. Live scratch policy was semantically identical.
- **Fix:** `normalizePolicyExpr` strips a `public.` prefix before function calls; added a unit test. 41 tests pass in lib-storage and 09-verify tests.
- **Files modified:** scripts/portfolio-migration/lib-storage.mjs, lib-storage.test.mjs
- **Commit:** 0419567e

**2. [Rule 1 - Bug] Matrix case `cv-coach-read-revoked` reported allow (investigated as a potential security defect)**
- **Found during:** Task 3 step 1 (first run: pass 48, fail 1).
- **Diagnosis:** The policy and function are identical to ziko's (`revoked_at IS NULL`), and the revoke UPDATE affected 1 row. A dedicated probe showed that after revocation the same path stays downloadable (Storage CDN cached the authenticated response already served to the coach), while a never-read fresh path is denied, `createSignedUrl` is denied, the list is empty, and a SQL role simulation returns 0 rows. So the policy denies correctly; the failure was a test-design flaw caused by caching, not a weakened policy. The matrix was not relaxed: the deny case still exists and is still `deny`, but now reads an object (`second.mp4`, uploaded by the athlete before the link and never read while linked).
- **Residual note (recorded in RUNBOOK 5.7):** on any project, including production ziko, a revoked coach can re-download an already-served path for the CDN cache lifetime. This is pre-existing platform behavior, not introduced by the migration. Flagged for the owner's awareness.
- **Files modified:** scripts/portfolio-migration/10-storage-auth-tests.mjs (new case `cv-upload-second`, revoked read path)
- **Commit:** 8340247e

## Commits

- 0419567e fix(05-09): ignore search_path schema prefix when comparing policy expressions
- 78b2aaed test(05-09): scratch storage copy, loader re-run and verify reports
- 8340247e test(05-09): scratch full storage auth matrix; revoked-read uses a fresh path
- 31e42f39 docs(05-09): RUNBOOK Phase 5 storage migration section

## Known Stubs

None.

## Threat Flags

None new (see the CDN cache note above, pre-existing behavior).

## Self-Check: PASSED

Reports grep-gated: no '@', full UUID or JWT in the four scratch reports. Four commits exist. RUNBOOK contains `## Phase 5`, subsections 5.1-5.8 plus 5.6a, the typed phrase, and the word "regenerate". `git status --porcelain -- apps backend plugins packages/plugin-sdk scripts/exercise-import` is empty; no `.tmp-storage-auth-*` leftovers. Token file retained and gitignored.
