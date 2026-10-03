---
phase: 05-storage-migration
plan: 01
subsystem: storage-migration
tags: [storage, tdd, supabase, rls, migration-tooling]
requires:
  - scripts/portfolio-migration/lib-verify.mjs (assertReportSafe, maskUuid)
provides:
  - scripts/portfolio-migration/lib-storage.mjs (22 pure helpers + maskUuid re-export)
affects:
  - Phase 5 plans 03-07 (policy generator, copy script, verifier, auth tests, loader URL hook)
tech-stack:
  added: []
  patterns: [pure helper module + node:test, counts-only evaluators, quote-anchored regex rewrite]
key-files:
  created:
    - scripts/portfolio-migration/lib-storage.mjs
    - scripts/portfolio-migration/lib-storage.test.mjs
  modified: []
key-decisions:
  - "Bucket lists are always caller-supplied (live rows); no bucket literal exists in the module"
  - "Re-key uses first-segment-only replacement, case-insensitive, throws if the source UUID appears elsewhere"
  - "findStalePolicyRefs flags any quoted bare bucket id (superset of bucket_id = '<id>'), and any is_coach_of( not preceded by a word character, including public.-qualified"
  - "evaluateObjects: size/content-type/presence/destOnly are gates; cache-control is a warning counter"
  - "evaluateStorageTenants input shape: { buckets: [{id, objects}], policies: [{name, hash}] }, only non-ziko buckets and non ziko_ policies are guarded"
requirements-completed: [STORAGE-01, STORAGE-02, STORAGE-03]
duration: ~25 min
completed: 2026-10-02
---

# Phase 5 Plan 01: lib-storage Summary

Pure, tested helper module (bucket naming and config diff, UUID re-key, storage policy rewrite and SQL rendering, stale-reference detection, storage-URL rewrite and scan SQL, object/hash/re-key/tenant evaluators, masking) that every Phase 5 script builds on.

## Tasks

| Task | Commits |
|------|---------|
| 1. Bucket, re-key, policy, URL helpers (TDD) | RED ea7a7495, GREEN 233acd2d |
| 2. Evaluators, masking, cache-control, delete guard (TDD) | RED 956703cd, GREEN e62904db |

## Verification

- `node --test lib-storage.test.mjs lib-verify.test.mjs lib-data.test.mjs`: 78 pass, 0 fail.
- Acceptance greps: 14 + 8 required exports present; 0 hardcoded bucket literals; 0 occurrences of the real collision UUID prefix; 0 I/O tokens in the module.
- TDD gate: `test(...)` commits precede `feat(...)` commits for both tasks.

## Deviations from Plan

**1. [Rule 1 - Bug] NUL byte written into objKey separator**
- **Found during:** Task 2 GREEN (grep reported the file as binary)
- **Fix:** replaced the literal NUL byte with the `\u0000` escape before committing; tests re-run green.
- **Commit:** e62904db

Otherwise, plan executed as written. Contract details left to discretion by the plan: `evaluateObjects.perBucket[<ziko-id>]` = `{ sourceCount, sourceBytes, targetCount, targetBytes }`; `evaluateHashes.mismatched` is a number (missing dst hash counts as mismatch); `evaluateRekey` returns zeros and ok when remap is null; `rekeyObjectName` remap shape is `{ sourceUuid, targetUuid }`; `findDeleteCalls` returns pattern labels.

## Known Stubs

None.

## Threat Flags

None. All threat-register mitigations (T-5-01..05) are implemented and covered by tests.

## Self-Check: PASSED

Files and commits (ea7a7495, 233acd2d, 956703cd, e62904db) verified present.
