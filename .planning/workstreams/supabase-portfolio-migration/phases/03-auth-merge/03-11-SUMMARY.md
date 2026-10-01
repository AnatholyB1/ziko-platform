# 03-11 Summary: Portfolio import (PARTIAL, BLOCKED before Task 2)

Status: Task 1 import applied; Task 1 gotrue check FAILS; Task 2 NOT executed. Requirements AUTHMIG-01/02/03 are NOT complete.

## Authorization gate
Step 0 grep on 03-10-SUMMARY.md passed (`option-approve-instance-fix`), so `--fill-null-instance-id` / `--allow-instance-id-fill` were used.

## What was applied on portfolio (ubxllsvanurkwkohzxau)
- `02-import-auth --plan`: source 39 users / 39 identities, to_insert=38, collisions=1 (`ea0f0b65...` -> `2b6a60fa-f37a-45a8-bf3f-e6b6681917e5`).
- `--dry-run` (rolled back): users_present=38 identities_present=38 collision_password_filled=1 collision_identity_added=1 instance_id_filled=1.
- `--apply --fill-null-instance-id` (commit of remap: 10aa08a3): users_present=38 identities_present=38 passwords_updated=0 instance_id_filled=1. Exit 0.
- `uuid-remap.json` written: one remap, password_filled / identity_inserted / instance_id_filled all true, no '@'.

## Verification results
| Check | Result |
|-------|--------|
| users | PASS (ziko=39 imported=38 merged=1 mismatched=0) |
| identities | PASS (compared=38 collisions=1) |
| tenants (with `--source-ref`, `--allow-instance-id-fill`) | PASS, 0 warnings |
| gotrue | FAIL: admin GET of `2b6a60fa-...` returns HTTP 500 (reproduced 3 times); the other 38 users are fine |

## Not executed
Trigger stage (`03-apply-trigger-gate`), `04-sync-waitlist-seq`, `06-verify --check all`. No triggers were attached and the waitlist sequence was not synced.

## Deviations / findings
1. Plan's tenants command omits `--source-ref`; without it the approved collision fills are reported as "unexpected". Passing `--source-ref slkobhavpwsubnsmuhya` fixes it (script help says it is required after the import). Plan text should be corrected.
2. **Blocker, NULL token columns on the collision row.** Read-only inspection (null-ness only) shows the collision row has NULL `confirmation_token`, `recovery_token`, `email_change_token_new` and `email_change`; every other auth.users row on portfolio has `''`. GoTrue cannot scan NULL there, hence the 500, which would also break login for that user. Plan 08 did not catch it because the scratch seed used `''`.
   Proposed fix (needs user approval, not covered by the typed authorization): a guarded UPDATE on that single row, `SET <the 4 columns> = '' WHERE id = '2b6a60fa-...' AND <col> IS NULL`, ideally added to `02-import-auth.mjs` next to the instance_id fill and its tests, then re-run gotrue and Task 2. Alternative: accept that the merged user cannot use GoTrue until fixed.

## Self-Check
- uuid-remap.json committed (10aa08a3): FOUND.
- STATE.md / ROADMAP.md / requirements intentionally not advanced.
