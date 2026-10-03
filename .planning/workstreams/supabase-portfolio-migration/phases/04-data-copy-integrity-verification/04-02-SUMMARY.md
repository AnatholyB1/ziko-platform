---
phase: 04-data-copy-integrity-verification
plan: 02
subsystem: database
tags: [verification, postgres, node-test, fk, rls, sequences]
requires:
  - phase: 03-auth-merge
    provides: auth.users merged, waitlist founder sequence set to 87/true
provides:
  - Pure SQL builders and evaluators for counts, RLS, triggers, FKs, orphans, sequences, UUID remap, tenants
  - assertReportSafe / maskUuid report sanitizer
affects: [04-04 live verification suite]
tech-stack:
  added: []
  patterns: [pure builders + evaluators returning { ok, detail, data }, static no-nextval scan test]
key-files:
  created:
    - scripts/portfolio-migration/lib-verify.mjs
    - scripts/portfolio-migration/lib-verify.test.mjs
  modified: []
key-decisions:
  - "FK discovery uses pg_class relnamespace/relname (spec section 3 regclass::text query returned 0 rows); evaluateFks fails on 0 discovered auth FK columns"
  - "Sequences compared read-only via last_value/is_called plus last_value >= max(consumer column); nextval is never called, enforced by a directory-wide static test"
  - "Trigger checks select tgname/tgenabled only, never trigger definitions (webhook secret)"
requirements-completed: [DATA-02, DATA-03, DATA-04, DATA-05]
duration: 10min
completed: 2026-10-02
---

# Phase 4 Plan 02: lib-verify Summary

Pure, unit-tested verification layer (30 exports, 28 node:test cases) covering every D-09 check, with the corrected FK-discovery query and a structural ban on nextval.

## Tasks

| Task | Commits |
|------|---------|
| 1. Catalog SQL, counts/RLS/triggers/FK/orphans | RED c7552f26, GREEN aad051d1 |
| 2. Sequences, remap, tenants, sanitizer, no-nextval test | RED 3eb4c3f5, GREEN 22bbfeb1 |

## Verification

`node --test scripts/portfolio-migration/lib-verify.test.mjs`: 28 pass, 0 fail. Acceptance greps: 0 nextval calls, 0 pg_get_triggerdef/n_live_tup in code, 6 relnamespace predicates, no pg import, no full UUID in the module.

## Decisions Made

- REFERRERS_SQL (name fixed by the plan, semantics unspecified) is defined as columns whose default expression depends on a public sequence (pg_attrdef dependencies), complementing owned-column discovery.
- buildSequenceStateSql(name, side): side `'target'` requires the ziko_ prefix; omitted or `'source'` accepts any valid identifier.
- evaluateSequences accepts ownedColumns items with optional `tableMax`; a column whose max exceeds last_value fails the check.
- evaluateTenants input shape: `{ tables: [{tbl, n}], authUsers, authTriggers: [{tgname, tgenabled}] }`; row growth is a warning, emptied/missing tables, decreased auth.users and changed trigger state fail.

## Deviations from Plan

None - plan executed as written. (A first heredoc-based test append failed on shell quoting before running anything; redone via file tools, no repo impact.)

## Known Stubs

None.

## Self-Check: PASSED

Files exist and commits c7552f26, aad051d1, 3eb4c3f5, 22bbfeb1 are in git log.
