---
phase: 02-test-account-purge
plan: 02
subsystem: infra
tags: [supabase, admin-api, management-api, vitest, csv, sha256, operational-script, esm]

# Dependency graph
requires:
  - "scripts/purge-test-accounts/lib.mjs — createPurgeAdminClient, DryRunReport shape (02-01)"
provides:
  - "scripts/purge-test-accounts/export.mjs — collectExportRows, buildManifest, writeExport; CLI --report/--out"
  - "scripts/purge-test-accounts/pitr.mjs — checkPitrStatus, resolveProjectRef"
  - "export-<ISO>.csv / export-<ISO>.manifest.json on-disk contract (candidate_ids, candidate_ids_sha256, pitr) that plan 02-03's delete step consumes and refuses to run without"
  - "apps/web/test/purge/purge-export.test.ts — 19-test/29-assertion proof of row export, manifest hashing and PITR degradation, no Supabase credentials or access token required"
affects: [02-03-delete-and-verify, 02-04-runbook]

# Actuals (#2632)
actuals:
  tokens: 6914
  tasks: 2
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Injected-fakes seam repeated from 02-01: collectExportRows takes fetchProfiles/fetchWaitlistRows as plain async functions, and checkPitrStatus takes fetchImpl — both provable without any Supabase or Management API credential"
    - "Manifest write-back correction: writeExport always overwrites manifest.export_csv with the exact stamped path it actually wrote to, so the manifest-points-at-a-real-file guarantee holds regardless of what buildManifest's csvPath argument was called with upstream"
    - "unknown as a first-class PITR outcome, never a caught exception surfaced as an error — checkPitrStatus never throws, mirroring D-04's framing of PITR as an honestly-reported backstop rather than an assumed one"

key-files:
  created:
    - scripts/purge-test-accounts/export.mjs
    - scripts/purge-test-accounts/pitr.mjs
    - apps/web/test/purge/purge-export.test.ts
  modified: []

key-decisions:
  - "last_sign_in_at is always emitted as an empty CSV field: the DryRunReport's to_delete shape from 02-01 carries only {id, email, created_at}, with no last_sign_in_at, so there is no data source for that column in this plan's own <interfaces> contract. Read from candidate.last_sign_in_at defensively (falls back to '') so a future report augmentation is picked up automatically without a code change. Documented as a Known Stub below rather than silently guessed."
  - "writeExport always overwrites manifest.export_csv with the path it actually wrote to (not the csvPath buildManifest was called with) — makes the 'export_csv points at the file that exists' guarantee hold unconditionally rather than depending on caller path-string discipline between buildManifest and writeExport."
  - "Followed 02-01's task-level TDD literally for both tasks: RED commit (test-only, confirmed failing via temporarily removing/module-not-yet-created) before each GREEN implementation commit — 4 commits total, 2 RED + 2 GREEN."

requirements-completed: [PURGE-03]

coverage:
  - id: D4-export
    description: "Running the export against a reviewed dry-run report writes a CSV holding every to_delete account's id, email, created_at, tier and any waitlist rows, before anything is deleted, unconditionally and never gated on PITR status (D-04)"
    requirement: PURGE-03
    verification:
      - kind: unit
        ref: "apps/web/test/purge/purge-export.test.ts#collectExportRows — report-order rows, empty-profile row, waitlist match/no-match"
        status: pass
      - kind: unit
        ref: "apps/web/test/purge/purge-export.test.ts#writeExport — CSV+manifest on disk, CSV quoting survives embedded comma"
        status: pass
      - kind: other
        ref: "grep -v comment-lines scripts/purge-test-accounts/export.mjs | grep -c deleteUser|DELETE FROM|.delete( -> 0"
        status: pass
    human_judgment: false
  - id: D2-manifest-hash
    description: "The manifest records the exact candidate id set and a SHA-256 over it, read from report.to_delete only, so the delete step (02-03) can prove it acts on the reviewed set (D-02, T-02-08)"
    requirement: PURGE-03
    verification:
      - kind: unit
        ref: "apps/web/test/purge/purge-export.test.ts#buildManifest — candidate_ids order/content match, sha256 stable and id-sensitive"
        status: pass
      - kind: other
        ref: "grep -c to_delete scripts/purge-test-accounts/export.mjs -> 6 (candidate set only ever comes from the reviewed report)"
        status: pass
    human_judgment: false
  - id: D4-pitr
    description: "PITR status is read from the Supabase Management API and recorded as enabled/disabled/unknown with the time checked — never assumed; absent token or failing API yields unknown, never blocking the export (D-04, T-02-09, T-02-14)"
    requirement: PURGE-03
    verification:
      - kind: unit
        ref: "apps/web/test/purge/purge-export.test.ts#checkPitrStatus — enabled, disabled, 401, 403, thrown fetch, absent token, token-not-leaked-in-detail"
        status: pass
      - kind: other
        ref: "for s in enabled disabled unknown; do grep -q \"'$s'\" scripts/purge-test-accounts/pitr.mjs; done -> all three reachable"
        status: pass
      - kind: other
        ref: "grep -v comment-lines scripts/purge-test-accounts/pitr.mjs | grep -c deleteUser|DELETE FROM|restore-pitr -> 0"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-08-13
status: complete
---

# Phase 2 Plan 2: Export the Rows, Read the Backstop Summary

**Unconditional pre-delete row export with a SHA-256-hashed manifest, plus a live Supabase Management API PITR status check that degrades to an explicit `unknown` — never a guess — on any absent token, non-OK response or network failure.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-13T22:59Z
- **Completed:** 2026-08-13T23:01Z
- **Tasks:** 2/2
- **Files created:** 3 (`export.mjs`, `pitr.mjs`, `purge-export.test.ts`)

## Accomplishments
- `scripts/purge-test-accounts/export.mjs` exports `collectExportRows`, `buildManifest`, `writeExport` exactly matching the plan's `<interfaces>` block — plan 02-03's delete step imports these directly.
- `collectExportRows` reads candidate ids and emails exclusively from `report.to_delete` (D-02) — never re-queries for its own candidate set — and joins injected `fetchProfiles`/`fetchWaitlistRows` in memory; a missing profile row produces empty profile-derived columns rather than throwing, matching the orphan-capture requirement.
- `buildManifest` computes `candidate_ids_sha256` via `node:crypto` `createHash('sha256')` over `candidate_ids.join('\n')` — stable across repeated calls on the same input, and sensitive to any id change. This is the integrity link plan 02-03 recomputes and refuses to run against on a mismatch (T-02-08).
- `writeExport` writes `export-<ISO>.csv` and `export-<ISO>.manifest.json` to the git-ignored export directory, always overwriting the written manifest's `export_csv` with the path it actually wrote — the "manifest points at a real file" guarantee holds unconditionally.
- `scripts/purge-test-accounts/pitr.mjs` exports `checkPitrStatus` and `resolveProjectRef`. `checkPitrStatus` never throws: an absent `SUPABASE_ACCESS_TOKEN` or unresolvable project ref returns `unknown` with **no request issued**; a non-OK response (401/403/etc.) or a rejecting fetch both degrade to `unknown` rather than a guess (T-02-09). The detail string names only the HTTP status code and response booleans — never the token — confirmed by a dedicated test injecting a fake token and asserting it never appears in the returned detail (T-02-10).
- `export.mjs`'s CLI is wired to call `checkPitrStatus` after rows are collected and before `buildManifest` (T-02-13 — a hanging Management API can never prevent the export from having gathered its data), and prints the resulting status to stdout.
- Only `GET /v1/projects/{ref}/database/backups` is called anywhere in `pitr.mjs` — no restore endpoint exists in the source (T-02-14, COVERAGE.md).
- 19/19 tests (29 assertions) pass in `apps/web/test/purge/purge-export.test.ts`, full web suite green (112 passed, 4 pre-existing skips, 0 failed), `npm run lint` exits 0 (41 pre-existing warnings, 0 errors, none introduced by this plan).
- Nothing in `export.mjs` or `pitr.mjs` is capable of deleting an account or restoring PITR — confirmed by grep gates on non-comment lines (`deleteUser`, `DELETE FROM`, `.delete(`, `restore-pitr`).

## Task Commits

Each task followed literal task-level TDD (RED then GREEN), as 02-01 established:

1. **Task 1: Export the exact rows about to be deleted, with a hashed manifest**
   - `5fe2e04` (test) — RED: `purge-export.test.ts` written against `export.mjs`, which did not yet exist; confirmed failing (module-not-found) by temporarily removing the not-yet-committed implementation file and re-running the suite.
   - `9475575` (feat) — GREEN: `export.mjs` implementing `collectExportRows`/`buildManifest`/`writeExport` and the CLI, making all 10 task-1 tests (15 assertions) pass.
2. **Task 2: Read PITR status from the Management API, with a real unknown state**
   - `7e5a69c` (test) — RED: extended `purge-export.test.ts` with `resolveProjectRef`/`checkPitrStatus` assertions against `pitr.mjs`, which did not yet exist; confirmed failing (module-not-found).
   - `e0d5c1a` (feat) — GREEN: `pitr.mjs` implementing `checkPitrStatus`/`resolveProjectRef`, and `export.mjs`'s CLI wired to call it, making all 19 tests (29 assertions) pass.

## TDD Gate Compliance

Both tasks carry `tdd="true"`. Gate sequence confirmed in git log for each: a `test(...)` commit exists before its paired `feat(...)` commit, and the paired `test` commit was verified failing (module-not-found, since the implementation file did not yet exist at that point in history) before the `feat` commit made it pass. No test passed unexpectedly during either RED phase.

## Files Created
- `scripts/purge-test-accounts/export.mjs` — `collectExportRows`, `buildManifest`, `writeExport`, CSV quoting, chunked (200/`in()` call) Supabase fetchers, CLI (`--report`, `--out`)
- `scripts/purge-test-accounts/pitr.mjs` — `resolveProjectRef`, `checkPitrStatus` against the Supabase Management API's `database/backups` endpoint
- `apps/web/test/purge/purge-export.test.ts` — 19 tests / 29 assertions: row collection (order, missing profile, waitlist match), manifest hashing (order/content, sha stability, sha sensitivity), disk write (CSV+manifest present, quoting), and all PITR outcomes (enabled, disabled, 401, 403, thrown fetch, absent token, no-token-leak)

## Decisions Made
- `last_sign_in_at` is always emitted empty in the CSV — the report's `to_delete` shape (from 02-01, per this plan's own `<interfaces>` contract) carries only `{id, email, created_at}`, with no source for `last_sign_in_at` anywhere in this task's injected fetchers. Read defensively from `candidate.last_sign_in_at ?? ''` so a future report augmentation would be picked up without a code change, rather than fabricating a value. See **Known Stubs** below.
- `writeExport` always overwrites `manifest.export_csv` with the exact stamped path it wrote the CSV to, rather than trusting the `csvPath` argument `buildManifest` was called with. This makes the "manifest points at a file that exists" guarantee unconditional instead of depending on the CLI computing matching paths across two separate calls.
- Followed 02-01's precedent of literal task-level TDD: for both tasks, confirmed the RED state (module-not-found, since the implementation file was not yet committed) before writing the corresponding implementation.

## Deviations from Plan

None — plan executed exactly as written. `export.mjs`'s intermediate CLI wiring in task 1 (a hardcoded `unknown` PITR stub with a "has not run yet" detail, per the plan's explicit instruction) was replaced with the real `checkPitrStatus()` call in task 2, matching the plan's stated sequencing.

## Known Stubs

- **`last_sign_in_at` CSV column is always empty.** `scripts/purge-test-accounts/export.mjs` — `collectExportRows`. The plan's own `<interfaces>` block reuses 02-01's `DryRunReport.to_delete` shape, which is `{id, email, created_at}` only; no `last_sign_in_at` is available to this task from the report, and no additional fetcher for it is specified in the plan's `<action>`. The code reads `candidate.last_sign_in_at ?? ''` defensively, so if a later phase augments the report shape this column populates automatically with no code change — but as written today it is always the empty string. This does not block plan 02-03 (which consumes `candidate_ids`/`candidate_ids_sha256`, not the CSV columns) and does not violate any prohibition in this plan's `<threat_model>` or `must_haves`. Flagged for whoever eventually reviews an export CSV by eye.

## Issues Encountered
None — both tasks executed cleanly against the plan as written, including the full RED→GREEN cycle for each.

## User Setup Required
None. No `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_ACCESS_TOKEN` was needed or used — the entire suite runs against injected fakes, matching D-03's constraint that no production credential is available or required for this phase's build-and-rehearse work.

## Next Phase Readiness
- `scripts/purge-test-accounts/export.mjs`'s public interface (`collectExportRows`, `buildManifest`, `writeExport`) and `pitr.mjs`'s (`checkPitrStatus`, `resolveProjectRef`) are stable and match this plan's `<interfaces>` block exactly — plan 02-03 (delete + verify) can import `buildManifest`'s `candidate_ids`/`candidate_ids_sha256` output directly to gate the delete step.
- The `export-<ISO>.manifest.json` contract plan 02-03 "refuses to run without" is fully specified and produced: `generated_at`, `source_report`, `export_csv`, `candidate_ids`, `candidate_ids_sha256`, `counts`, `pitr`.
- D-03's safety boundary holds: no delete capability and no PITR-restore capability exists anywhere in this plan's files (confirmed by grep gates on non-comment lines), and no production credential was available or used this session. Running `node scripts/purge-test-accounts/export.mjs --report <path>` against real credentials, followed by `node scripts/purge-test-accounts/pitr.mjs`'s live Management API path, is the natural first verification step whenever a service-role key and access token become available — not required to unblock plan 02-03.

---
*Phase: 02-test-account-purge*
*Completed: 2026-08-13*
