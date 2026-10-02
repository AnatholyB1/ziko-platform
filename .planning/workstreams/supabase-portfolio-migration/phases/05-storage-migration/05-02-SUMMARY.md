---
phase: 05-storage-migration
plan: 02
subsystem: storage
tags: [codemod, buckets, supabase-storage, node-test]
requires: []
provides:
  - "scripts/portfolio-migration/11-codemod-buckets.mjs: map-driven bucket codemod (--scan | --apply | --check)"
affects: [05-08, phase-6-cutover]
tech-stack:
  added: []
  patterns: ["fail-closed classification of quoted bucket ids", "per-deployable STORAGE_BUCKETS constant module"]
key-files:
  created:
    - scripts/portfolio-migration/11-codemod-buckets.mjs
    - scripts/portfolio-migration/11-codemod-buckets.test.mjs
  modified: []
key-decisions:
  - "Added a 'comment' context (rewritten in place) so doc/URL-format comments (profile/index.tsx:251, merge.ts) do not fail closed"
  - "'**/package.json' and '**/package-lock.json' \"exports\" entries added to FALSE_POSITIVES for the repo-wide residual pass"
  - "Import paths containing /<id>/ segments are unclassified (fail closed), never rewritten"
  - "--check uses git ls-files only when <root>/.git exists, else a filesystem walk (deterministic for temp-tree tests)"
requirements-completed: [STORAGE-01, STORAGE-04]
duration: ~25min
completed: 2026-10-02
---

# Phase 5 Plan 02: Bucket Codemod Summary

**Rename-map-driven, idempotent, fail-closed codemod mapping every bucket id X to ziko-X, with per-deployable STORAGE_BUCKETS constants and a repo-wide residual check.**

## Accomplishments
- Pure exported functions: `SCAN_ROOTS`, `FALSE_POSITIVES`, `surfaceOf`, `importSpecifierFor`, `classifyOccurrences`, `rewriteSource`, `renderConstantsModule`, `insertImport`, `camelKey`. Bucket ids, targets and keys come only from the map object.
- Contexts: storage-from (including multi-line `.storage` newline `.from(`), const-decl, array-member (identifier containing BUCKET), call-arg (function name containing Bucket), in-string (`bucket=<id>`, `/<id>/`), comment, test-literal, false-positive, unclassified (throws with file:line).
- CLI: `--scan` (read-only, per-file counts, exit 1 on unclassified), `--apply` (refuses on unclassified, writes the three constant modules and the plugin-sdk index re-exports, `--manifest-out` with `A ` markers), `--check` (contexts, constant modules, imports, repo-wide residual pass). Missing map exits 2.
- 32 node:test cases pass, including temp-tree scan/apply/check, idempotency (second apply changes zero files), and the residual pass (planted literal outside SCAN_ROOTS fails; supabase/migrations, purge-test-accounts, node_modules do not).

## Read-only validation against the real tree
`--scan` with an inline map of the 10 live ids reported 57 occurrences in 26 files, zero unclassified (31 storage-from, 11 array-member, 5 in-string, 2 comment, 2 const-decl, 2 call-arg, 2 test-literal, 2 false-positive), matching the CONTEXT estimate. `--check` found no residuals outside SCAN_ROOTS. `--apply` was never run on the repo; `git diff -- apps backend plugins packages/plugin-sdk scripts/exercise-import` is clean (T-5-06).

## Task Commits
1. RED tests: dd92d980
2. Rewrite functions (GREEN): 9ac0fba3
3. CLI tests and mode verification: fe60ffb4

## Deviations from Plan
- **[Rule 2 - Missing critical] comment context and package.json allowlist**: the merge.ts doc comment and the profile URL-format comment would otherwise be unclassified; `"exports"` fields in package.json files would trip the residual pass. Both handled explicitly rather than silently.
- The CLI code was written together with the pure functions, so commit 9ac0fba3 already contains the CLI; the third commit adds its tests (all verified before commit).

## Known Stubs
None. `scripts/portfolio-migration/bucket-map.generated.json` is produced by plan 03; tests use inline fixtures.

## Self-Check: PASSED
- Files exist: 11-codemod-buckets.mjs, 11-codemod-buckets.test.mjs
- Commits dd92d980, 9ac0fba3, fe60ffb4 present in git log
