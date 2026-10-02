---
phase: 05-storage-migration
plan: 06
subsystem: storage-migration
tags: [storage, loader, tdd, url-rewrite, D-05]
requires:
  - scripts/portfolio-migration/lib-storage.mjs (rewriteStorageUrls)
provides:
  - createUrlRewriteTransform in lib-data.mjs
  - 05-load-data in-flight storage URL rewrite, --bucket-map flag, url_rewrites report fields, live URL scan in --plan
affects:
  - Phase 5 scratch rehearsal and gated portfolio load; Phase 6 truncate-reload
key-files:
  modified:
    - scripts/portfolio-migration/lib-data.mjs
    - scripts/portfolio-migration/lib-data.test.mjs
    - scripts/portfolio-migration/05-load-data.mjs
    - scripts/portfolio-migration/05-load-data.test.mjs
key-decisions:
  - "URL rewrite lives only in the load path (pipeline stage after remap); no UPDATE path exists (D-05)"
  - "Bucket ids come from bucket-map.generated.json via loadBucketIds; unreadable or invalid map exits 2"
requirements-completed: [STORAGE-02]
completed: 2026-10-02
---

# Phase 5 Plan 06: Loader in-flight URL rewrite Summary

The Phase 4 loader now rewrites ziko storage URLs to the run's target host and ziko-<bucket> while streaming (copyTo -> remap -> urlRewrite -> copyFrom), so any reload reproduces the same data with no post-hoc UPDATE.

## Tasks

| Task | Commits |
|------|---------|
| 1. createUrlRewriteTransform (TDD) | RED 080bcf11, GREEN d897d582 |
| 2. Loader wiring, --bucket-map, report, --plan scan | 387542d7 |

## Verification

- `node --test` on 05-load-data, lib-data, lib-verify, 06-verify-data, lib-storage tests: 109 pass, 0 fail (every-byte-offset chunk split, multibyte, line count, composition with remap, constructor guards).
- Greps: createUrlRewriteTransform x2 in the loader, url_rewrites present, 0 UPDATE statements.
- Loader was not run against any project.

## Deviations from Plan

**1. [Rule 3 - Blocking] Source-side URL scan uses a loader-local SQL builder**
- **Issue:** `buildUrlScanSql` only accepts `ziko_`-prefixed tables and quotes `public."ziko_x"`, but the --plan scan runs on the ziko source where tables are unprefixed.
- **Fix:** added `buildSourceUrlScanSql(names, { ref, buckets })` in 05-load-data.mjs (same row-as-text approach, anchored on `<ref>.supabase.co/storage/v1/<kind>/<visibility>/<bucket>`, inputs validated). Behaviour matches the plan intent (live per-table count over all columns).

## Known Stubs

None.

## Threat Flags

None. T-5-24 (anchored regex, chunk tests, per-table row equality before COMMIT), T-5-25 (no UPDATE path), T-5-26 (report counts only, assertReportSafe) are implemented.

## Self-Check: PASSED
