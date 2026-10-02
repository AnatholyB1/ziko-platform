---
phase: 05-storage-migration
plan: 04
subsystem: storage-migration
tags: [storage, supabase, migration-tooling, tdd]
requires:
  - scripts/portfolio-migration/lib-storage.mjs (05-01)
provides:
  - scripts/portfolio-migration/08-copy-storage.mjs (--plan read-only, --apply add-only storage copy)
affects:
  - Phase 5 scratch/portfolio rehearsal plans, Phase 6 delta copy
tech-stack:
  added: []
  patterns: [pure exports + guarded isMain CLI, in-memory service keys, add-only transport]
key-files:
  created:
    - scripts/portfolio-migration/08-copy-storage.mjs
    - scripts/portfolio-migration/08-copy-storage.test.mjs
  modified: []
key-decisions:
  - "Policy gate counts all storage-schema policies on ziko vs policies named ziko_% on target"
  - "decideObject returns only copy|skip; caller counts changed when a destination row existed"
  - "Missing bucket-map.generated.json is a hard exit 1 (plan 05-03 output required)"
  - "Unknown global limit (no PAT) lets --apply proceed only if target buckets already converged"
requirements-completed: [STORAGE-01, STORAGE-02]
duration: ~20 min
completed: 2026-10-02
---

# Phase 5 Plan 04: 08-copy-storage Summary

Guarded, idempotent, add-only transport script that converges ziko-<id> buckets from live ziko config and copies every object with SHA-256 verification, with a read-only `--plan` pre-flight. Not run against any project.

## Tasks

| Task | Commits |
|------|---------|
| 1. Pure guards, skip/strategy logic, static no-delete test (TDD) | RED d25d0f11, GREEN b0314b70 |
| 2. Live I/O: --plan and --apply | see git log `feat(05-04): add 08-copy-storage plan/apply` |

## Verification

- `node --test 08-copy-storage.test.mjs lib-storage.test.mjs`: 40 pass, 0 fail.
- `--help` exits 0; `--apply` on ziko or on portfolio without confirm exits 1 before network.
- Delete-pattern grep returns 0; `policies must be applied before objects` present once; `.tmp-storage-copy-` present and gitignored.

## Deviations from Plan

None - plan executed as written. Task 1's GREEN commit shipped a stub `execute` that Task 2 replaced.

## Notes for the runner

- Requires `bucket-map.generated.json` (plan 05-03) and a remap file whose target_ref matches `--project-ref`.
- Raw (non max-age) cache-control uploads use a direct POST with literal header; 31 such objects expected.
- Policy count gate assumes plan 05-03 names target storage policies with the `ziko_` prefix.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat register (T-5-13..19 mitigated as specified).

## Self-Check: PASSED
