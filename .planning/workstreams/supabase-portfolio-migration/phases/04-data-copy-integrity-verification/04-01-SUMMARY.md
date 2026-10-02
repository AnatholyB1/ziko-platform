---
phase: 04-data-copy-integrity-verification
plan: 01
subsystem: data-migration
tags: [pg, pg-copy-streams, copy, uuid-remap, node-test]
requires:
  - phase: 03-auth-merge
    provides: PROJECTS, KNOWN_COLLISION_SOURCE_IDS, uuid-remap.json shape
provides:
  - pure loader helper module scripts/portfolio-migration/lib-data.mjs
  - pg@8.23.1 and pg-copy-streams@7.0.0 exact-pinned root devDependencies
  - gitignore entries for Phase 4 temp and CA paths
affects: [04-03, 04-04, 04-05]
tech-stack:
  added: [pg@8.23.1, pg-copy-streams@7.0.0]
  patterns: [ziko_-only SQL builders, line-buffered utf8-safe stream transform]
key-files:
  created:
    - scripts/portfolio-migration/lib-data.mjs
    - scripts/portfolio-migration/lib-data.test.mjs
  modified: [package.json, package-lock.json, .gitignore]
key-decisions:
  - "Transform buffers per line (not per chunk) and decodes with StringDecoder so UUIDs and multibyte chars split across chunks are handled"
  - "TRUNCATE builder emits an explicit ziko_ list only, with no dependent-table expansion and no identity reset"
requirements-completed: [DATA-01]
duration: 15min
completed: 2026-10-02
---

# Phase 4 Plan 01: Loader Foundation Summary

Pure, network-free loader helpers (99-table plan, ziko_-only SQL builders, boundary-safe UUID remap transform, topo sort, per-table evaluator) with 21 passing node:test cases, plus pinned pg and pg-copy-streams.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1. Install pg + pg-copy-streams, gitignore | ed39f0b9 | repository.url verified as brianc/* before install |
| 2 RED. failing tests | 3eea693d | module missing |
| 2 GREEN. lib-data.mjs | 296432c5 | 21/21 tests pass |

## Deviations from Plan

None - plan executed as written. Minor: the plan's verify used named imports from pg-copy-streams (CJS); verified via default import instead (to/from are functions). Three extra tests were added to meet the 20-test acceptance threshold.

## Verification

- `node --test scripts/portfolio-migration/lib-data.test.mjs`: 21 pass, 0 fail
- No non-comment line contains the word for dependent-table expansion; no pg import in lib-data.mjs
- Export list matches the plan exactly
- Target UUID from uuid-remap.json appears in neither file
- npm warned about unapproved postinstall scripts for esbuild, sharp, unrs-resolver (pre-existing, unrelated to pg packages)

## Known Stubs

None.

## Self-Check: PASSED
