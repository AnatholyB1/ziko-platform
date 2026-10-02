---
phase: 05-storage-migration
plan: 03
subsystem: storage-migration
tags: [storage, rls, policies, codegen, supabase]
requires:
  - scripts/portfolio-migration/lib-storage.mjs
provides:
  - scripts/portfolio-migration/07-generate-storage-policies.mjs (--generate | --check | --apply)
  - scripts/portfolio-migration/bucket-map.generated.json
  - supabase/portfolio-migrations/20261002160000_portfolio_ziko_storage_policies.sql
affects: [05-04..05-07]
key-files:
  created:
    - scripts/portfolio-migration/07-generate-storage-policies.mjs
    - scripts/portfolio-migration/07-generate-storage-policies.test.mjs
    - scripts/portfolio-migration/bucket-map.generated.json
    - supabase/portfolio-migrations/20261002160000_portfolio_ziko_storage_policies.sql
key-decisions:
  - "Function renames derived from rename-map.generated.json (all signature-keyed entries, bare names); rewriteExpr only touches occurrences"
  - "Migration is wrapped in BEGIN/COMMIT with an '-- expected policy count: N' header line parsed by --apply"
  - "--check compares bucket map ignoring generated_at; SQL contains no timestamp so drift is exact"
requirements-completed: [STORAGE-01, STORAGE-03]
completed: 2026-10-02
---

# Phase 5 Plan 03: Storage policy generator Summary

Generator, drift/stale check and guarded apply for the ziko- storage policies, plus the committed bucket map and policies migration generated read-only from live ziko.

## Tasks

| Task | Commits |
|------|---------|
| 1. Generator / check / apply CLI (TDD) | RED a542bd42, GREEN (feat 05-03 generator) |
| 2. Generate bucket map + policies migration | chore(05-03) artifacts commit |

## Live facts recorded

- Buckets: 10 (ai-imports, avatars, coach-exercises, coach-kyc, coach-logos, coach-videos, exercise-media, exports, profile-photos, scan-photos), all mapped to ziko-<id>. Matches research.
- Policies: 25 (9 TO public, 16 TO authenticated). Matches research. All named ziko_*.
- Stale grep: 0 bare bucket literals, 0 unprefixed is_coach_of calls; `--check` exits 0.
- Bucket map contains no '@' and no UUID.
- profile-photos quirk carried as-is (D-02): bucket public=false, a public-role SELECT policy exists, and there is no DELETE policy for it. Known pre-existing issue, not fixed.

## Verification

- `node --test 07-generate-storage-policies.test.mjs lib-storage.test.mjs`: 35 pass, 0 fail (includes ziko refusal, portfolio-without-confirm refusal, stale injection).
- No project was written to (only read queries on ziko). `--apply` was not executed.
- No hardcoded portfolio runSql; assertWriteAllowed used in the apply path.

## Deviations from Plan

None - plan executed as written. (A transient Python-escaping slip in a local edit was corrected before the GREEN commit.)

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED
