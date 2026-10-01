---
phase: 03-auth-merge
plan: 05
subsystem: auth-migration
tags: [supabase, auth, import, collision-gate]
requires: ["03-01"]
provides: [import-auth-cli, collision-check-cli, rehearsal-seed-tool]
affects: [03-08-rehearsal]
tech-stack:
  added: []
  patterns: [single-transaction import via jsonb_populate_recordset into temp tables, count assertion, rolled-back dry-run]
key-files:
  created:
    - scripts/auth-merge/02-import-auth.mjs
    - scripts/auth-merge/02-import-auth.test.mjs
    - scripts/auth-merge/01-collision-check.mjs
    - scripts/auth-merge/rehearsal-seed-collision.mjs
decisions:
  - "Source payload is loaded into ON COMMIT DROP temp tables via jsonb_populate_recordset; all inserts/updates read from them, so the hash is never interpolated and the payload appears once per table."
  - "Counts are accumulated in a session temp table (_am_counts) so the post-COMMIT summary row and the dry-run RAISE share one source."
  - "Summary row returns the collisions array (source/target/password_filled/identity_inserted/instance_id_filled) that feeds the --remap-out file."
metrics:
  tasks: 2
  files: 4
  completed: 2026-10-01
---

# Phase 3 Plan 05: Auth import and collision gate scripts Summary

Built the ziko-to-target auth import CLI (tested SQL builder, plan / dry-run / apply / delta-report modes, guarded password refresh), the read-only collision gate, and the scratch-only collision seeding tool. Nothing was written to portfolio or ziko.

## Commits
- 8db0cf89: import script + 13 node:test assertions
- 0015b0a4: collision check + scratch seeding tool

## Verification
- `node --test "scripts/auth-merge/*.test.mjs"`: 24 pass, 0 fail (13 new).
- `--plan` against scratch: `source_users=39 source_identities=39`, `to_insert=39 collisions=0`; read-only.
- `--plan --apply-password-updates`: exit 2. `--apply` with ziko target: exit 1 (refused). `--dry-run` on portfolio without `--confirm-ref`: exit 1 before any SQL.
- Forbidden-statement grep on 02-import-auth.mjs: 0.
- Read-only collision check on portfolio: source 39, target 6, collisions 1, `known=true target_has_password=false target_has_email_identity=false target_instance_id_null=true` (matches RESEARCH live state), exit 0. Target UUID 2b6a60fa-f37a-45a8-bf3f-e6b6681917e5.
- Seed tool with portfolio and ziko refs: exit 2, no SQL sent.

## Deviations from Plan
None. Plan executed as written. The `--dry-run`, `--apply`, `--delta-report` and seeding paths were not exercised live (the plan defers the scratch rehearsal to Plan 08); they are covered by builder unit tests only.

## Known Stubs
None.

## Self-Check: PASSED
