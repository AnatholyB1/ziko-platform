---
phase: 03-auth-merge
plan: 11
subsystem: auth
tags: [supabase, gotrue, auth-merge, portfolio, triggers]
requires: ["03-10"]
provides:
  - "ziko users/identities merged into portfolio ubxllsvanurkwkohzxau (38 imported + 1 merged)"
  - "ziko_ gated triggers attached, waitlist sequence synced (87/true)"
  - "scripts/auth-merge/uuid-remap.json for Phase 4"
key-files:
  modified:
    - scripts/auth-merge/02-import-auth.mjs
    - scripts/auth-merge/02-import-auth.test.mjs
    - scripts/auth-merge/00-baseline-snapshot.mjs
    - scripts/auth-merge/06-verify.mjs
    - scripts/auth-merge/06-verify.test.mjs
    - scripts/auth-merge/rehearsal-seed-collision.mjs
    - scripts/auth-merge/RUNBOOK.md
    - scripts/auth-merge/uuid-remap.json
metrics:
  completed: 2026-10-01
---

# Phase 3 Plan 11: Portfolio import, token fill, triggers, sequence Summary

Ziko's auth pool is merged into portfolio (38 users as-is, 1 merged into the existing row) with the gated triggers attached, the waitlist sequence synced to 87/true, and `06-verify --check all` green; a guarded single-row NULL-to-empty fill of four GoTrue token columns was needed to fix an HTTP 500 on the merged user.

Status: COMPLETE. Task 1 and Task 2 executed. Requirements AUTHMIG-01/02/03 are left unchecked in REQUIREMENTS.md on purpose (orchestrator instruction); the phase verifier owns that.

## Authorization gates
- Step 0 grep on 03-10-SUMMARY.md passed before every write step: `Typed authorization: approve ubxllsvanurkwkohzxau option-approve-instance-fix` (line unchanged).
- Additional user authorization (own AskUserQuestion selection "Yes, fix that one row"): ONE guarded UPDATE on portfolio, row `2b6a60fa-f37a-45a8-bf3f-e6b6681917e5` only, `confirmation_token`, `recovery_token`, `email_change_token_new`, `email_change` set to `''` only where NULL. Recorded as an additive addendum in 03-10-SUMMARY.md (commit after fa441cce). Exactly that write was performed, nothing else.

## Portfolio writes performed (ubxllsvanurkwkohzxau, all with --confirm-ref)
1. Import (earlier executor, commit 10aa08a3): 38 users + 38 identities inserted, collision row password filled, email identity added, `instance_id` filled (all guarded).
2. Token fill (this run): `--plan` (already_present=38 to_insert=0 collisions=1), `--dry-run` rolled back with `token_columns_filled=4` and every other count 0, then `--apply --fill-null-instance-id --fill-null-token-columns`: `users_present=38 identities_present=38 passwords_updated=0 instance_id_filled=0 token_columns_filled=4`. The re-run was idempotent for everything except the 4 NULL columns.
3. `03-apply-trigger-gate --stage all`: gate functions and triggers applied; `ziko_on_auth_user_created` and `ziko_on_auth_user_created_credits` both enabled=O, both functions gated=true.
4. `04-sync-waitlist-seq`: ziko live 87/true, portfolio before 1/false, after 87/true.

## Verification results
| Check | Result |
|-------|--------|
| users | PASS ziko=39 imported=38 merged=1 compared=38 mismatched=0 |
| identities | PASS compared=38 collisions=1 |
| gotrue | PASS admin lookup for 39 users (the earlier HTTP 500 is gone) |
| triggers | PASS triggers=2, probe 0 0 0 1 1 1, residual=0 |
| sequence | PASS equal (87/true) |
| tenants | PASS baseline users=6 warnings=0 (with `--allow-instance-id-fill --allow-token-fill`; without the token allowance it correctly FAILS on the collision row) |
| all | PASS (exit 0) |

SC3 on portfolio is proven via the rolled-back SQL probe; real GoTrue signup was proven on scratch (Plan 08), keeping test users off the shared pool.

`uuid-remap.json`: exactly 1 remap `ea0f0b65-6681-4780-8ee0-dbf20b95d4d9` -> `2b6a60fa-f37a-45a8-bf3f-e6b6681917e5`, password_filled / identity_inserted / instance_id_filled true (history preserved), token_columns_filled 4, no `@`.

## Code changes (commit fa441cce)
- `02-import-auth.mjs`: `--fill-null-token-columns` (`fillNullTokenColumns`): four separate `UPDATE ... SET <col> = '' WHERE id = <collision target> AND <col> IS NULL`; counts reported as `token_columns_filled` in DRYRUN output, apply output and the remap file. New `mergeRemaps` so re-running `--apply` against an existing remap file ORs booleans and sums token counts instead of erasing the first-apply record.
- `06-verify.mjs` + `00-baseline-snapshot.mjs`: `--allow-token-fill` and `evaluateTenants({allowedTokenFillIds})`. The stable hash covers those token columns, so the snapshot now also emits `stable_hash_tokens_nulled` and `token_cols_empty`; the fill is accepted only for the collision id, only if the row equals the baseline once the 4 columns are masked to NULL and they are now exactly `''`.
- `rehearsal-seed-collision.mjs`: seeds NULL in those 4 columns so the rehearsal reproduces this.
- Tests: 65 pass (`node --test "scripts/auth-merge/*.test.mjs"`), including new fill, guard, mergeRemaps and tenants-allowance tests.
- `RUNBOOK.md` documents the fill and the `--source-ref` requirement for tenants; `03-11-PLAN.md` tenants commands now carry `--source-ref slkobhavpwsubnsmuhya`.

## Deviations from Plan
1. [Rule 1 - Bug] Plan text omitted `--source-ref` on the tenants check; fixed in PLAN and RUNBOOK.
2. [Rule 2 - Missing critical functionality] Collision row had NULL token columns (GoTrue 500, would break login); fixed via user-authorized guarded fill, scripted and tested; tenants evaluator extended accordingly. Plan 08 missed it because the scratch seed used `''`; the seed now uses NULL.
3. [Rule 3 - Blocking, environment] Two read-only verify runs failed transiently with a Supabase CLI `telemetry.json` EPERM rename error (parallel CLI calls); re-runs passed. Not a check result.

## Known Stubs
None.

## Self-Check: PASSED
- Commits fa441cce (code), the 03-10 addendum commit, and the remap commit exist; `uuid-remap.json` FOUND.
- `06-verify --check all` exit 0 on portfolio.
