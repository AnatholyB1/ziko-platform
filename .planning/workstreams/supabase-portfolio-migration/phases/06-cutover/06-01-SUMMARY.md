---
phase: 06-cutover
plan: 01
subsystem: tooling
tags: [codemod, supabase, rename-map, tdd]
requires:
  - phase: 05
    provides: rename-map.generated.json (99 tables, 33 functions), 11-codemod-buckets.mjs conventions
provides:
  - 12-codemod-tables.mjs map-driven fail-closed table/RPC/embed codemod
affects: [06-08]
tech-stack:
  added: []
  patterns: [lexer-based context classification, fail-closed unrecognized list, alias-preserving embeds]
key-files:
  created:
    - scripts/portfolio-migration/12-codemod-tables.mjs
    - scripts/portfolio-migration/12-codemod-tables.test.mjs
  modified: []
key-decisions:
  - "Source is tokenized (comments, strings, template interpolation, regex literals) so contexts are decided on real string literals, not raw regex over text"
  - "Unknown !hint ending in _fkey fails closed; other hints are treated as column hints and kept"
  - "Receivers storage, capitalized identifiers (Array/Buffer) and gsap/tl/timeline are exempt from .from() handling"
requirements-completed: [CUTOVER-01]
duration: ~40min
completed: 2026-10-03
---

# Phase 6 Plan 01: Table Codemod Summary

**Map-driven, fail-closed codemod (rewriteSource/rewriteSelect) that renames tables, RPCs, alias-preserving embeds, realtime tables and public.<t> strings to ziko_ names, with --scan/--apply/--check/--gen-hints and 18 passing node:test cases (B1-B17).**

## Commits
- e099e3ab test(06-01): add failing tests for table codemod (RED)
- 17b84d48 feat(06-01): implement table codemod (GREEN)

## Real-repo --scan (read-only, nothing applied)
- 1274 changes in 204 files
- 124 unrecognized items (exit 1), to be resolved in 06-08 via FALSE_POSITIVES or manual edits. Main groups: test files (apps/web/test/purge/*) with table literals in non-.from contexts, marketing plugin ids ('habits', 'supplements') in PluginShowcase*/ClientTabStrip/store, a few select/embed constants (e.g. profile/lift-detail.tsx:79), and a few remaining dynamic .from() arguments.
- `git status` for apps/backend/plugins/packages/scripts/exercise-import is clean after the scan.

## Residual exclusion list (--check)
`.planning/`, `supabase/`, `node_modules/`, `scripts/portfolio-migration/`, `scripts/auth-merge/`, `scripts/purge-test-accounts/`, plus two ziko-ref ops scripts marked "Phase 7 follow-up: operates on ziko by ref": `scripts/waitlist-erasure/`, `scripts/food-data/`. (`scripts/founder-offer-go-live/` is docs only, `scripts/exercise-import/` is a scan root.)

## Deviations from Plan
**1. [Rule 1 - Bug] GSAP `.from()` false positives** - the first real scan flagged ~80 `gsap.from(...)` animation calls as dynamic/unknown tables. Added gsap/tl/timeline receivers to the exempt list and a regression assertion in B12. Files: 12-codemod-tables.mjs, test.mjs (in feat commit).

## Known Stubs
None. `--gen-hints` was not run against live projects (no refs executed here); only its read-only SQL and arg validation are tested.

## Self-Check: PASSED
Both files exist; commits e099e3ab and 17b84d48 present; suite green; no hardcoded table names in the script.
