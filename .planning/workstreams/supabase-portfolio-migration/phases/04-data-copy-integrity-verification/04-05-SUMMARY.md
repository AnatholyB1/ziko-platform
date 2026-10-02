---
phase: 04-data-copy-integrity-verification
plan: 05
subsystem: data-migration
tags: [scratch-rehearsal, copy-transport, pooler, rls]
requires:
  - phase: 04-data-copy-integrity-verification
    provides: 05-load-data (04-03), 06-verify-data (04-04)
provides:
  - Proven end-to-end Phase 4 load and verification on scratch, including the truncate-and-reload path
  - Resolved login-role privilege model (SET ROLE parent) for COPY transport
affects: [04-06, 04-07, phase-06]
key-files:
  created:
    - scripts/portfolio-migration/reports/scratch-load.json
    - scripts/portfolio-migration/reports/scratch-verify.json
  modified:
    - scripts/portfolio-migration/lib-conn.mjs
    - scripts/portfolio-migration/lib-conn.test.mjs
    - scripts/portfolio-migration/05-load-data.mjs
    - scripts/portfolio-migration/06-verify-data.mjs
    - scripts/portfolio-migration/06-verify-data.test.mjs
    - scripts/portfolio-migration/RUNBOOK.md
key-decisions:
  - "Temporary cli_login_* roles are NOINHERIT members of their parent; lib-conn runs SET ROLE <parent> (session scoped) after connect and refuses to continue unless the effective role has BYPASSRLS. Stays within D-01 (COPY transport)"
  - "Login roles are no longer deleted when a run closes: delete+recreate of the same role name made the next pooler connect fail (auth failure or stale role OID). Connect also retries with a fresh role (4 attempts)"
  - "System CAs do not validate the pooler chain: the Supabase root CA (--ca-file) is required. TLS verification never disabled"
requirements-completed: [DATA-01, DATA-02, DATA-03, DATA-04, DATA-05]
completed: 2026-10-02
---

# Phase 4 Plan 05: Scratch Rehearsal Summary

Full 99-table ziko_ load into scratch via verified-TLS session pooler and COPY, then a second truncate-and-reload; `06-verify-data --check all` green after both. No writes to ziko or portfolio.

## Execution

- Task 1 (token, CA): satisfied by the user. First `--probe` without CA failed with `self-signed certificate in certificate chain` (stopped and escalated); CA (Supabase Root 2021, gitignored) then supplied.
- Task 2: scratch reset (39 auth rows deleted), collision seed, `02-import-auth --apply --remap-out` (38 users, 38 identities, 1 collision remapped; target_ref = scratch). `06-verify users` and `identities` PASS. `--plan`: exit 0, 20,897 source rows, 144 target FKs, 97 FK columns to auth.users, source UUID found in 36 tables (429 rows).
- Probe (final, after fix): source effective role supabase_read_only_user rolbypassrls=true; target effective role postgres rolbypassrls=true; CLI vs connection counts equal (food_database 7932, exercise_import_log 3498, supplement_prices 3169); replica_ok=true; TRUNCATE privilege 99/99; guarded 99-table TRUNCATE parsed and rolled back; selected trigger mode: replica. Pooler hosts are `*.pooler.supabase.com` session mode 5432 (hostnames not recorded).
- Task 3: run 1 load 20,897 rows across 99 tables in ~12s, `--check all` first attempt hit the remap bug below (all other checks PASS); after the fix remap PASS. Run 2 (reload, Phase 6 path) ~12s, 20,897 rows, 99 tables; `--check all` all PASS.

Final `[PASS]` lines: counts 99/99 exact; rls 99/99; triggers 18 inspected, 0 not enabled-origin (2 ziko_ triggers on auth.users enabled, tgenabled unchanged so webhooks did not fire under replica mode); fk 144 constraints, 97 FK columns to auth.users, 144 validated; orphans 0 across 144; sequence 1 compared (ziko_waitlist_founder_seq 87 -> 87), 0 sequence-backed columns; remap source UUID absent on target, target UUID occurrences match source (remapped_rows total consistent with the 429 source occurrences).

## Deviations from Plan

**1. [Rule 1 - Bug] Login role lacked grants and BYPASSRLS.** First probe failed `permission denied for table food_database`. Diagnostics: `cli_login_*` has rolinherit=false, member of its parent (set_option true, inherit false), rolbypassrls=false, no table grants; the parent roles (supabase_read_only_user, postgres) have BYPASSRLS. `SET ROLE <parent>` fixes both (verified count 7932 on food_database). Implemented `assumeParentRole`/`parentRoleOf` in lib-conn with tests, runbook documented. Commit 3ac00ec4.

**2. [Rule 1 - Bug] Pooler state after login-role deletion.** After `closeClients` deleted roles, the next connect failed with auth failure, stale role OID ("invalid role OID") or "permission denied to set role". Fixed by not deleting roles on close and retrying connect with a fresh role. Roles are retired with the token in 04-07. Commit fff6bef4 (retry in 3ac00ec4).

**3. [Rule 1 - Bug] 06-verify-data remap check** passed unprefixed source table names to the ziko_-only `buildUuidOccurrenceSql`. Added `buildSourceUuidOccurrenceSql` in the CLI with a test. Commit fff6bef4.

**4. [Rule 3 - Blocking]** `scripts/portfolio-migration/reports/` directory did not exist; created.

## Notes for 04-06 / 04-07

- The token file `scripts/auth-merge/.access-token` and CA file remain in place; 04-07 retires them and the leftover login roles.
- Scratch-only remap file `.tmp-uuid-remap.scratch.json` is gitignored; portfolio needs its own committed remap.

## Known Stubs

None.

## Self-Check: PASSED

Reports exist and contain no '@' or full UUID; commits 3ac00ec4, fff6bef4, 9ca998d7 are in git log; 77 unit tests pass.
