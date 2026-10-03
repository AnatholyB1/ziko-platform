# Phase 3 Auth Merge RUNBOOK (ziko -> portfolio)

Audience: the operator running the Phase 3 sequence, and Phase 6 running the final delta sync before cutover. All commands run from the repo root. Mask identifiers: this file contains no email addresses; scripts print UUIDs only.

Refs used below: ziko `slkobhavpwsubnsmuhya` (live source, read-only), portfolio `ubxllsvanurkwkohzxau` (shared target), scratch `rkirvurggtgjlkeuhded` (rehearsal).

## 1. Projects and safety rules

- Three refs, no script has a default ref: every script needs an explicit `--project-ref`.
- ziko is read-only. `assertWriteAllowed` refuses any write to it until Phase 7.
- Every portfolio write needs `--confirm-ref ubxllsvanurkwkohzxau` AND the Plan 10 typed authorization (section 3 precondition).
- PII: raw data (user rows, hashes, raw auth config with secrets) lives only in the OS temp dir (`<os.tmpdir()>/ziko-auth-merge/`); anything committed is masked or digested. Never paste emails or hashes into tracked files.
- Management API token: `SUPABASE_ACCESS_TOKEN` or the gitignored `scripts/auth-merge/.access-token`. At the end of the phase, on every path (normal completion, abort and db-only), the token file is deleted and the PAT is revoked in the Supabase dashboard.
- The CLI whole-config push is never used (D-14); config changes go only through `05-auth-config-merge.mjs`, which PATCHes `uri_allow_list` alone.
- Raw config snapshots have deterministic paths `<os.tmpdir()>/ziko-auth-merge/<ref>-<label>.raw.json` and are always passed explicitly to later steps. Never pick a snapshot by listing or sorting files.

## 2. Scratch rehearsal order

Everything here targets scratch (`rkirvurggtgjlkeuhded`); no confirm flag needed.

```bash
node scripts/auth-merge/rehearsal-seed-collision.mjs --project-ref rkirvurggtgjlkeuhded --reset
node scripts/auth-merge/rehearsal-seed-collision.mjs --project-ref rkirvurggtgjlkeuhded --seed
node scripts/auth-merge/00-baseline-snapshot.mjs --project-ref rkirvurggtgjlkeuhded --out scripts/auth-merge/baseline/scratch-baseline.json
node scripts/auth-merge/01-collision-check.mjs --source-ref slkobhavpwsubnsmuhya --project-ref rkirvurggtgjlkeuhded
node scripts/auth-merge/02-import-auth.mjs --source-ref slkobhavpwsubnsmuhya --project-ref rkirvurggtgjlkeuhded --plan
node scripts/auth-merge/02-import-auth.mjs --source-ref slkobhavpwsubnsmuhya --project-ref rkirvurggtgjlkeuhded --dry-run
node scripts/auth-merge/02-import-auth.mjs --source-ref slkobhavpwsubnsmuhya --project-ref rkirvurggtgjlkeuhded --apply --remap-out <os temp dir>/uuid-remap.scratch.json
node scripts/auth-merge/02-import-auth.mjs --source-ref slkobhavpwsubnsmuhya --project-ref rkirvurggtgjlkeuhded --apply --remap-out <os temp dir>/uuid-remap.scratch.json   # idempotence: 0 inserted
node scripts/auth-merge/02-import-auth.mjs --source-ref slkobhavpwsubnsmuhya --project-ref rkirvurggtgjlkeuhded --delta-report
```

Password-update rehearsal (scratch only): change one imported user's hash on scratch, then run `--delta-report` (expect `password_changed=1`), then `--apply --apply-password-updates` (restores ziko's hash), then `06-verify.mjs --check users` must pass.

```bash
node scripts/auth-merge/06-verify.mjs --project-ref rkirvurggtgjlkeuhded --source-ref slkobhavpwsubnsmuhya --check users
node scripts/auth-merge/06-verify.mjs --project-ref rkirvurggtgjlkeuhded --source-ref slkobhavpwsubnsmuhya --check identities
node scripts/auth-merge/06-verify.mjs --project-ref rkirvurggtgjlkeuhded --source-ref slkobhavpwsubnsmuhya --check gotrue
node scripts/auth-merge/03-apply-trigger-gate.mjs --project-ref rkirvurggtgjlkeuhded --source-ref slkobhavpwsubnsmuhya --stage all
node scripts/auth-merge/04-sync-waitlist-seq.mjs --project-ref rkirvurggtgjlkeuhded --source-ref slkobhavpwsubnsmuhya
node scripts/auth-merge/06-verify.mjs --project-ref rkirvurggtgjlkeuhded --source-ref slkobhavpwsubnsmuhya --baseline scripts/auth-merge/baseline/scratch-baseline.json --check all   # includes a signup on scratch
```

Config rehearsal on scratch (needs the PAT; scratch has no ziko-specific config, so the plan reads ziko as source):

```bash
node scripts/auth-merge/05-auth-config-merge.mjs --project-ref rkirvurggtgjlkeuhded --snapshot --label before --out-dir scripts/auth-merge/baseline
node scripts/auth-merge/05-auth-config-merge.mjs --project-ref rkirvurggtgjlkeuhded --plan --source-ref slkobhavpwsubnsmuhya
node scripts/auth-merge/05-auth-config-merge.mjs --project-ref rkirvurggtgjlkeuhded --apply --source-ref slkobhavpwsubnsmuhya --snapshot-raw <os temp dir>/ziko-auth-merge/rkirvurggtgjlkeuhded-before.raw.json
node scripts/auth-merge/05-auth-config-merge.mjs --project-ref rkirvurggtgjlkeuhded --diff --before-raw <os temp dir>/ziko-auth-merge/rkirvurggtgjlkeuhded-before.raw.json
```

A snapshot refuses to overwrite an existing raw file unless `--overwrite` is passed, so a "before" snapshot cannot be replaced by accident.

## 3. Portfolio run order

Precondition: the go/no-go checkpoint passed AND `03-10-SUMMARY.md` contains the typed authorization line `Typed authorization: approve ubxllsvanurkwkohzxau option-...`. Without it, do not run any command below.

```bash
node scripts/auth-merge/00-baseline-snapshot.mjs --project-ref ubxllsvanurkwkohzxau --out scripts/auth-merge/baseline/portfolio-pre-import.json
node scripts/auth-merge/01-collision-check.mjs --source-ref slkobhavpwsubnsmuhya --project-ref ubxllsvanurkwkohzxau
node scripts/auth-merge/02-import-auth.mjs --source-ref slkobhavpwsubnsmuhya --project-ref ubxllsvanurkwkohzxau --apply --confirm-ref ubxllsvanurkwkohzxau --remap-out scripts/auth-merge/uuid-remap.json
```

Add `--fill-null-instance-id` to the import only for `option-approve-instance-fix`.

```bash
node scripts/auth-merge/06-verify.mjs --project-ref ubxllsvanurkwkohzxau --source-ref slkobhavpwsubnsmuhya --baseline scripts/auth-merge/baseline/portfolio-pre-import.json --check users
node scripts/auth-merge/06-verify.mjs --project-ref ubxllsvanurkwkohzxau --source-ref slkobhavpwsubnsmuhya --baseline scripts/auth-merge/baseline/portfolio-pre-import.json --check identities
node scripts/auth-merge/06-verify.mjs --project-ref ubxllsvanurkwkohzxau --source-ref slkobhavpwsubnsmuhya --baseline scripts/auth-merge/baseline/portfolio-pre-import.json --check gotrue
node scripts/auth-merge/06-verify.mjs --project-ref ubxllsvanurkwkohzxau --source-ref slkobhavpwsubnsmuhya --baseline scripts/auth-merge/baseline/portfolio-pre-import.json --check tenants
```

Add `--allow-instance-id-fill` to the verify calls only in that same `option-approve-instance-fix` case.

`--check tenants` needs `--source-ref slkobhavpwsubnsmuhya` after the import, otherwise the approved collision fills are reported as unexpected.

Token columns: portfolio's pre-existing collision row can carry NULL in `confirmation_token`, `recovery_token`, `email_change_token_new`, `email_change` (GoTrue admin GET then returns HTTP 500; the other rows hold `''`). Add `--fill-null-token-columns` to the import (collision target only, `WHERE id = <target> AND <col> IS NULL`, reported as `token_columns_filled`) and `--allow-token-fill` to the tenants/all verify calls. This is a separate write that needs its own explicit user authorization recorded in the SUMMARY. Re-running `--apply` on an already-imported project is idempotent and merges into the existing remap file (booleans OR-ed, token counts summed).

```bash
node scripts/auth-merge/03-apply-trigger-gate.mjs --project-ref ubxllsvanurkwkohzxau --source-ref slkobhavpwsubnsmuhya --stage all --confirm-ref ubxllsvanurkwkohzxau
node scripts/auth-merge/04-sync-waitlist-seq.mjs --project-ref ubxllsvanurkwkohzxau --source-ref slkobhavpwsubnsmuhya --confirm-ref ubxllsvanurkwkohzxau
node scripts/auth-merge/06-verify.mjs --project-ref ubxllsvanurkwkohzxau --source-ref slkobhavpwsubnsmuhya --baseline scripts/auth-merge/baseline/portfolio-pre-import.json --check all
```

Config merge (human reviews the `--plan` output, including the derived extra URIs, before `--apply`; the Management API token is needed from here):

```bash
node scripts/auth-merge/05-auth-config-merge.mjs --project-ref ubxllsvanurkwkohzxau --snapshot --label before-apply --out-dir scripts/auth-merge/baseline
node scripts/auth-merge/05-auth-config-merge.mjs --project-ref ubxllsvanurkwkohzxau --plan --source-ref slkobhavpwsubnsmuhya
node scripts/auth-merge/05-auth-config-merge.mjs --project-ref ubxllsvanurkwkohzxau --apply --source-ref slkobhavpwsubnsmuhya --confirm-ref ubxllsvanurkwkohzxau --snapshot-raw <os temp dir>/ziko-auth-merge/ubxllsvanurkwkohzxau-before-apply.raw.json
node scripts/auth-merge/05-auth-config-merge.mjs --project-ref ubxllsvanurkwkohzxau --diff --before-raw <os temp dir>/ziko-auth-merge/ubxllsvanurkwkohzxau-before-apply.raw.json
```

`--apply` aborts if the live config drifted from the snapshot, and sends a PATCH containing only `uri_allow_list`. `--diff` fails on any removed URL or any other changed key. site_url and email templates stay portfolio's (D-10).

## 4. Final delta sync before Phase 6 cutover (D-09)

Run right before cutover, in order:

1. `node scripts/auth-merge/01-collision-check.mjs --source-ref slkobhavpwsubnsmuhya --project-ref ubxllsvanurkwkohzxau`. New collision = stop (D-04): human checkpoint, do not continue.
2. `node scripts/auth-merge/02-import-auth.mjs --source-ref slkobhavpwsubnsmuhya --project-ref ubxllsvanurkwkohzxau --delta-report` (read-only; prints `password_changed` and `other_changed` UUID lists separately).
3. If `password_changed` is 0: plain `--apply --confirm-ref ubxllsvanurkwkohzxau --remap-out <os temp dir>/uuid-remap.delta.json` inserts new signups only.
4. If `password_changed` > 0: a human reviews the UUID list, then:
   ```bash
   node scripts/auth-merge/02-import-auth.mjs --source-ref slkobhavpwsubnsmuhya --project-ref ubxllsvanurkwkohzxau --dry-run --apply-password-updates
   node scripts/auth-merge/02-import-auth.mjs --source-ref slkobhavpwsubnsmuhya --project-ref ubxllsvanurkwkohzxau --apply --apply-password-updates --confirm-ref ubxllsvanurkwkohzxau --remap-out <os temp dir>/uuid-remap.delta.json
   ```
   The dry run is rolled back; `passwords_updated` must equal the reviewed count. The apply inserts new signups and refreshes the changed hashes in one transaction, guarded by the report-time target digest and `IS DISTINCT FROM`, count-asserted.
5. `node scripts/auth-merge/04-sync-waitlist-seq.mjs --project-ref ubxllsvanurkwkohzxau --source-ref slkobhavpwsubnsmuhya --confirm-ref ubxllsvanurkwkohzxau` (value read live).
6. `node scripts/auth-merge/06-verify.mjs --project-ref ubxllsvanurkwkohzxau --source-ref slkobhavpwsubnsmuhya --baseline scripts/auth-merge/baseline/portfolio-pre-import.json --check all`.

Triggers are already attached; imported rows carry no app flag so the gate no-ops (RESEARCH Pattern 3). Never stamp `app:'ziko'` into imported metadata.

### Changed ziko password hashes

`ON CONFLICT (id) DO NOTHING` never refreshes an existing row, so password changes after the first import need the explicit path. Contract:

- Updates happen only behind the explicit `--apply-password-updates` flag.
- Only for non-collision ids, and only when the hash differs.
- Reporting is UUID-only; hashes are compared by md5 inside each database and never printed.
- The collision user's portfolio row (portfolio UUID) is never touched by this path, and its non-NULL portfolio values are never overwritten (D-03).
- `other_changed` fields (email, metadata, banned_until, deleted_at) stay report-only; a human decides.

## 5. Session consequence (D-11)

Portfolio's JWT secret differs from ziko's, and ziko's 52 sessions are not migrated. Every Ziko user signs in again once after cutover with the same email and password (hashes are imported). Existing refresh tokens fail and the app must route to login cleanly. Notice goes out through `07-notify-relogin.mjs` (email) plus the in-app banner/alert, driven by `NEXT_PUBLIC_ZIKO_RELOGIN_CUTOVER_DATE` (web) and `EXPO_PUBLIC_ZIKO_RELOGIN_CUTOVER_DATE` (mobile). Dry run:

```bash
node scripts/auth-merge/07-notify-relogin.mjs --source-ref slkobhavpwsubnsmuhya --cutover-date <YYYY-MM-DD> --dry-run
```

The real `--send` is a Phase 6 task.

## 6. Rollback notes

- The import only adds rows (plus the guarded NULL-password fill on the collision row).
- Triggers and functions can be dropped by name (`ziko_on_auth_user_created*`) without touching other tenants.
- The allow-list change is additive; restoring it means PATCHing the before-snapshot list by hand, a human decision.
- Rolling back imported users is deliberately not scripted before Phase 4, because Phase 4 data depends on them. Any rollback is a human decision.
