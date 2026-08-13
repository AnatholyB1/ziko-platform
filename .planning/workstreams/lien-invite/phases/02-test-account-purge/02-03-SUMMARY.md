---
phase: 02-test-account-purge
plan: 03
subsystem: infra
tags: [supabase, admin-api, vitest, sha256, operational-script, esm, guard-rails]

# Dependency graph
requires:
  - "scripts/purge-test-accounts/lib.mjs — createPurgeAdminClient, isTestAccountEmail, listAllUsers (02-01)"
  - "scripts/purge-test-accounts/export.mjs — export-<ISO>.manifest.json shape (candidate_ids, candidate_ids_sha256, pitr) (02-02)"
  - "apps/web/src/actions/account.ts:84-85 — the proven admin.auth.admin.deleteUser() call this plan's delete script reuses exactly"
provides:
  - "scripts/purge-test-accounts/delete.mjs — parsePurgeArgs, assertManifestIntegrity, runDelete, writeDeleteLog; CLI --manifest/--confirm/--accept-unknown-pitr/--max-manifest-age-minutes/--out"
  - "scripts/purge-test-accounts/verify-purge.mjs — checkResidualMatches, checkAccountConservation, fetchOrphanRows, summarizeOrphans; CLI --manifest/--report"
  - "delete-log-<ISO>.json on-disk contract — every deletion outcome, named and auditable"
  - "apps/web/test/purge/purge-delete.test.ts — 34-test proof of the guard, exactness, failure-isolation and reconciliation behavior, no Supabase credentials or access token required"
affects: [02-04-runbook]

# Actuals (#2632)
actuals:
  tokens: 9758
  tasks: 2
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Manifest as sole authorization artifact: runDelete accepts no client and no enumeration function — only manifest.candidate_ids and an injected deleteAccount fake — so re-deriving a candidate set at delete time is structurally impossible, not merely discouraged (D-02, T-02-21)"
    - "Accumulating guard, not fail-fast: assertManifestIntegrity checks every integrity condition (hash, CSV presence, age, PITR) and returns the full error list in one pass, so an operator sees every problem with a stale/tampered manifest at once rather than fixing one and re-running to discover the next"
    - "Confirm defaults to false with no code path that flips it silently — parsePurgeArgs only sets it true on the literal --confirm token, and runDelete never invokes deleteAccount when confirm is false; this is the executable form of D-03's 'ordinary invocation is inert'"
    - "Verbose per-row logging inverted from account.ts's anti-enumeration silence: the web action swallows deleteUser errors on purpose (don't leak account existence to end users); this operational script does the opposite on purpose (an unaudited purge is the worse failure mode here)"

key-files:
  created:
    - scripts/purge-test-accounts/delete.mjs
    - scripts/purge-test-accounts/verify-purge.mjs
    - apps/web/test/purge/purge-delete.test.ts
  modified: []

key-decisions:
  - "checkResidualMatches computes criterion matches over the full user list without first excluding manifest ids from that pass, per the plan's literal <action> wording ('compute the criterion matches ... then split them against flagged'). A manifest id that failed to delete would appear in both deleted_still_present and unexpected_matches — that double-reporting is acceptable since deleted_still_present alone already fails the check, and no acceptance criterion or behavior spec exercises that overlap case."
  - "fetchOrphanRows scans 8 (table, column) pairs across the 4 documented tables (user_profiles.id; coach_client_links.coach_id/client_id; coach_vocal_feedbacks.coach_id/athlete_id; workout_programs.user_id/created_by_coach_id/assigned_to_user_id), matching the plan's own <interfaces> table exactly. The plan's <action> prose says 'seven documented columns' but its own interfaces table lists 8 entries; implemented all 8 rather than dropping one arbitrarily, since the acceptance criteria's four-table/six-distinct-column grep checks pass either way and completeness is the correctness-relevant property for an orphan scan (Rule 1 — the plan's prose miscounted its own contract, not a design ambiguity)."
  - "writeDeleteLog and the CLI's log payload are assembled in two steps: runDelete returns only the deletion outcome (confirmed/attempted/succeeded/failed/results), and main() merges in manifest_path/manifest_hash/written_at before calling writeDeleteLog(logPayload, outDir) — keeping runDelete a pure-ish function over its injected deleteAccount with no knowledge of paths or manifest provenance."

requirements-completed: [PURGE-04, PURGE-05]

coverage:
  - id: D3-inert-default
    description: "Invoked without an explicit confirmation flag the delete script performs zero Admin API deletions and exits successfully, so the default invocation is inert (D-03)"
    requirement: PURGE-04
    verification:
      - kind: unit
        ref: "apps/web/test/purge/purge-delete.test.ts#runDelete — is inert without confirm: the deletion fake is never called and nothing is attempted"
        status: pass
      - kind: other
        ref: "node -e delete.mjs runDelete({confirm:false}) — n===0 && attempted===0"
        status: pass
    human_judgment: false
  - id: D2-exactness
    description: "The delete script deletes exactly the ids listed in the export manifest, in manifest order, one Admin API call each — it never re-derives a candidate set of its own (D-02)"
    requirement: PURGE-04
    verification:
      - kind: unit
        ref: "apps/web/test/purge/purge-delete.test.ts#runDelete — calls the deletion fake exactly once per manifest id, in manifest order; never passes an id present in a live database but absent from the manifest"
        status: pass
      - kind: other
        ref: "grep -v comment-lines delete.mjs | grep -c listUsers -> 0 (runDelete receives no client, no enumeration function)"
        status: pass
    human_judgment: false
  - id: D4-integrity-guard
    description: "A manifest whose recomputed SHA-256 disagrees, a stale manifest, an empty id list, a missing CSV, and an unacknowledged unknown-PITR manifest each abort the run before the first deletion (D-04)"
    requirement: PURGE-04
    verification:
      - kind: unit
        ref: "apps/web/test/purge/purge-delete.test.ts#assertManifestIntegrity — 9 tests covering hash mismatch, 120min/60min age, missing CSV, empty ids, unknown-PITR reject/accept, and accumulation of every failing check at once"
        status: pass
    human_judgment: false
  - id: D-failure-isolation
    description: "A failure on one account is recorded and the remaining accounts still process, and the run exits non-zero with the failed ids named"
    requirement: PURGE-04
    verification:
      - kind: unit
        ref: "apps/web/test/purge/purge-delete.test.ts#runDelete — continues past a mid-run failure, names it, and reports overall failure"
        status: pass
    human_judgment: false
  - id: D5-residual-reconciliation
    description: "Post-purge verification proves no manifest id survives, and that the only accounts still matching the criterion are exactly the cross-linked ones the dry-run deliberately withheld (D-05, PURGE-05)"
    requirement: PURGE-05
    verification:
      - kind: unit
        ref: "apps/web/test/purge/purge-delete.test.ts#checkResidualMatches — 5 tests: empty deleted_still_present, surviving manifest id fails, withheld/flagged survivor passes, unexpected survivor fails, non-matching survivor ignored"
        status: pass
    human_judgment: false
  - id: D-orphan-scan
    description: "Post-purge verification finds zero rows referencing any deleted id in user_profiles, coach_client_links, coach_vocal_feedbacks or workout_programs (PURGE-05)"
    requirement: PURGE-05
    verification:
      - kind: unit
        ref: "apps/web/test/purge/purge-delete.test.ts#fetchOrphanRows/summarizeOrphans — hit-per-row across documented tables/columns, throws naming table+column on query error, per-table breakdown and success-only-when-zero"
        status: pass
      - kind: other
        ref: "for t in user_profiles coach_client_links coach_vocal_feedbacks workout_programs; grep -q $t verify-purge.mjs — all present; for c in coach_id client_id athlete_id user_id created_by_coach_id assigned_to_user_id; grep -q $c — all present"
        status: pass
    human_judgment: false
  - id: D-account-conservation
    description: "No account outside the reviewed manifest set disappeared — the surviving account count never falls below the scanned count minus the manifest size (research/PITFALLS.md Pitfall 13 step 7)"
    requirement: PURGE-05
    verification:
      - kind: unit
        ref: "apps/web/test/purge/purge-delete.test.ts#checkAccountConservation — passes at floor, passes above floor (post-dry-run signups), fails and reports shortfall below floor"
        status: pass
      - kind: other
        ref: "node -e verify-purge.mjs checkAccountConservation shortfall/floor acceptance-criteria one-liners"
        status: pass
    human_judgment: false
  - id: D-admin-api-only
    description: "Every deletion runs through the same Admin API path already proven in account.ts (admin.auth.admin.deleteUser()), never a raw bulk SQL statement (PURGE-04)"
    requirement: PURGE-04
    verification:
      - kind: other
        ref: "grep -Eq 'auth\\.admin\\.deleteUser' delete.mjs; grep -v comment-lines delete.mjs/verify-purge.mjs | grep -Ec 'DELETE FROM|TRUNCATE|rpc\\(|\\.delete\\(' -> 0 in both files"
        status: pass
    human_judgment: false
  - id: D-no-production-run
    description: "No task in this plan ran either script against the production project — both are built and proven against injected fakes only (D-03)"
    requirement: PURGE-04
    verification:
      - kind: other
        ref: "Every test drives runDelete/assertManifestIntegrity/checkResidualMatches/checkAccountConservation/fetchOrphanRows/summarizeOrphans/writeDeleteLog with fixture data or hand-rolled fakes; no test imports @supabase/supabase-js or sets SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY; git log confirms no scripts/purge-test-accounts/exports artifact was ever committed"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-08-13
status: complete
---

# Phase 2 Plan 3: Build the Delete Path, Rehearse It, Never Fire It

**Guarded Admin API deletion of exactly the reviewed manifest set, plus a post-purge reconciliation
script proving no manifest id survived and no cross-table orphan remains — both proven end-to-end
against injected fakes, with zero calls against any real Supabase project (D-03).**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-13T23:06Z
- **Completed:** 2026-08-13T23:10Z
- **Tasks:** 2/2
- **Files created:** 3 (`delete.mjs`, `verify-purge.mjs`, `purge-delete.test.ts`)

## Accomplishments

- `scripts/purge-test-accounts/delete.mjs` exports `parsePurgeArgs`, `assertManifestIntegrity`,
  `runDelete`, `writeDeleteLog` exactly matching the plan's `<interfaces>`/`must_haves.artifacts`
  block. `runDelete` receives no client and no enumeration function — only `manifest.candidate_ids`
  and an injected `deleteAccount` fake — so re-deriving a candidate set at delete time is not merely
  discouraged, it is structurally impossible (D-02, T-02-21).
- `confirm` defaults to `false` and is only ever set by the literal `--confirm` token; `runDelete`
  never invokes `deleteAccount` when `confirm` is `false`, and the CLI prints the planned id set and
  exits 0 having touched nothing. This is the executable form of D-03's "ordinary invocation is
  inert" property (T-02-16).
- `assertManifestIntegrity` is an accumulating guard, not fail-fast: it checks the SHA-256 over
  `candidate_ids` against the recorded `candidate_ids_sha256` (T-02-15), the manifest's age against
  a configurable ceiling defaulting to 60 minutes (T-02-17), the referenced CSV's existence on disk,
  a non-empty id list, and the PITR status (rejecting `unknown` unless `--accept-unknown-pitr` is
  passed, T-02-18) — and returns every failing check in one pass rather than one per re-run.
- The CLI wires `deleteAccount` directly to `client.auth.admin.deleteUser`, the exact call already
  proven in production at `apps/web/src/actions/account.ts:84-85`. Unlike that web action, which
  swallows the error for anti-enumeration reasons, every per-row outcome here is logged verbosely and
  written to `delete-log-<ISO>.json` via `writeDeleteLog` — an unaudited purge is the failure mode
  this script exists to prevent (T-02-20).
- A mid-run failure is recorded, the remaining ids still process, and the run reports failure
  overall with the failed id named — proven by driving `runDelete` with a fake that fails on the
  second of three ids and asserting the third is still attempted.
- `scripts/purge-test-accounts/verify-purge.mjs` exports `checkResidualMatches`,
  `checkAccountConservation`, `fetchOrphanRows`, `summarizeOrphans`. `checkResidualMatches`
  distinguishes a genuine leftover (`deleted_still_present`, a manifest id still in the database) from
  a deliberately withheld cross-linked survivor (`expected_remaining`, named in `report.flagged`) from
  a true surprise (`unexpected_matches`) — the honest reading of D-05's exclusion rather than a bare
  "zero rows match" check that would fail on exactly the accounts the design chose to spare.
- `checkAccountConservation` is the only post-check able to see a real account destroyed by an
  over-broad criterion: it asserts the surviving count never falls below `users_scanned -
  candidate_ids.length`, passing when the count is higher (post-dry-run signups only add) and failing
  with a reported shortfall when it is even one lower (research/PITFALLS.md Pitfall 13 step 7).
- `fetchOrphanRows` scans all 8 documented `(table, column)` pairs across `user_profiles`,
  `coach_client_links`, `coach_vocal_feedbacks` and `workout_programs`, throwing — naming the table
  and column — on a query error rather than returning an empty array; a swallowed error here would
  read identically to a clean scan and certify the exact thing it exists to detect (T-02-22).
  `checkResidualMatches` and `verify-purge.mjs`'s CLI both reuse `isTestAccountEmail`/`listAllUsers`
  from `lib.mjs` verbatim — never a second implementation of the criterion.
- 34/34 tests pass in `apps/web/test/purge/purge-delete.test.ts` (20 for task 1, 14 added for task
  2), full web suite green (146 passed, 4 pre-existing skips, 0 failed), `npm run lint` exits 0 (42
  pre-existing warnings, 0 errors, one new pre-existing-pattern warning from an intentionally-unused
  fake-client parameter, matching the same convention already accepted in `purge-lib.test.ts`).
- Nothing in `delete.mjs` or `verify-purge.mjs` issues a raw bulk SQL statement, a `TRUNCATE`, an
  `rpc()` call, or a `.delete()` call — confirmed by grep gates on non-comment lines. No test in this
  plan sets `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` or imports `@supabase/supabase-js`; every
  assertion runs against fixture data or hand-rolled fakes. Per D-03, no task in this plan invoked
  either script against a real Supabase project.

## Task Commits

Both tasks followed literal task-level TDD (RED then GREEN), as 02-01/02-02 established:

1. **Task 1: Guarded Admin API deletion of exactly the reviewed manifest set**
   - `93e8cf8` (test) — RED: `purge-delete.test.ts` written against `delete.mjs`, which did not yet
     exist; confirmed failing (module-not-found).
   - `ff96a5f` (feat) — GREEN: `delete.mjs` implementing `parsePurgeArgs`/`assertManifestIntegrity`/
     `runDelete`/`writeDeleteLog` and the CLI, making all 20 task-1 tests pass.
2. **Task 2: Prove the purge landed — residual reconciliation and cross-table orphan scan**
   - `79fa8ae` (test) — RED: extended `purge-delete.test.ts` with `checkResidualMatches`/
     `checkAccountConservation`/`fetchOrphanRows`/`summarizeOrphans` assertions against
     `verify-purge.mjs`, which did not yet exist; confirmed failing (module-not-found).
   - `362ecca` (feat) — GREEN: `verify-purge.mjs` implementing all four exports and the CLI, making
     all 34 tests pass.

## TDD Gate Compliance

Both tasks carry `tdd="true"`. Gate sequence confirmed in git log for each: a `test(...)` commit
exists before its paired `feat(...)` commit, and each `test` commit was verified failing
(module-not-found, since the implementation file did not yet exist at that point in history) before
the `feat` commit made it pass. No test passed unexpectedly during either RED phase.

## Files Created

- `scripts/purge-test-accounts/delete.mjs` — `parsePurgeArgs`, `assertManifestIntegrity`,
  `runDelete`, `writeDeleteLog`; CLI (`--manifest`, `--confirm`, `--accept-unknown-pitr`,
  `--max-manifest-age-minutes`, `--out`)
- `scripts/purge-test-accounts/verify-purge.mjs` — `checkResidualMatches`,
  `checkAccountConservation`, `fetchOrphanRows`, `summarizeOrphans`; CLI (`--manifest`, `--report`)
- `apps/web/test/purge/purge-delete.test.ts` — 34 tests: CLI arg parsing (6), manifest integrity
  guard (9), deletion loop exactness/inertness/failure-isolation (4), delete-log write (1), residual
  reconciliation (5), account conservation (3), orphan-row fetch (3), orphan summary (3)

## Decisions Made

- `checkResidualMatches` computes criterion matches over the full user list without first excluding
  manifest ids, per the plan's literal `<action>` wording. See **key-decisions** in frontmatter for
  the full rationale — no acceptance criterion or behavior spec exercises the overlap case, so this
  is a documented interpretation choice, not a gap.
- `fetchOrphanRows` scans all 8 `(table, column)` pairs listed in the plan's own `<interfaces>` block,
  even though the `<action>` prose miscounts them as "seven documented columns." Implemented the full
  set the interfaces table actually lists rather than arbitrarily dropping one, since completeness is
  the correctness-relevant property for an orphan scan and every acceptance-criteria grep check
  (four tables, six distinct column names) passes either way.
- `writeDeleteLog` stays a thin two-argument function (`result`, `outDir`) exactly matching the
  plan's exported signature; the CLI's `main()` merges `manifest_path`/`manifest_hash`/`written_at`
  into the payload before calling it, keeping `runDelete` itself free of path/provenance knowledge.

## Deviations from Plan

None — plan executed as written. The one interpretive gap (the plan's "seven documented columns"
phrase vs. its own 8-entry interfaces table) is documented above as a decision, not a deviation
requiring a rule-based fix: the plan's executable contract (the `<interfaces>` table and the
acceptance-criteria grep checks) is unambiguous and was followed exactly.

## Known Stubs

None. Both scripts are fully implemented per the plan's `must_haves` and `<action>` blocks — no
placeholder logic, no hardcoded empty return standing in for real behavior.

## Issues Encountered

None — both tasks executed cleanly against the plan as written, including the full RED→GREEN cycle
for each and every acceptance-criteria one-liner from the plan verified directly via `node -e`.

## User Setup Required

None. No `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_URL` was needed or used — the entire suite runs
against fixture data and hand-rolled fakes, matching D-03's constraint that this phase builds and
rehearses the purge without any production credential or any call against a real Supabase project.

## Next Phase Readiness

- `scripts/purge-test-accounts/delete.mjs`'s public interface (`parsePurgeArgs`,
  `assertManifestIntegrity`, `runDelete`, `writeDeleteLog`) and `verify-purge.mjs`'s
  (`checkResidualMatches`, `checkAccountConservation`, `fetchOrphanRows`, `summarizeOrphans`) are
  stable and match this plan's `must_haves.artifacts.exports` exactly — plan 02-04 (the RUNBOOK) can
  document the CLI invocation sequence (`export.mjs` → human review → `delete.mjs --confirm` →
  `verify-purge.mjs`) directly against these signatures.
- D-03's safety boundary holds: no task in this plan (or any prior plan in this phase) ever invoked
  either script against a real Supabase project — every proof runs against injected fakes, confirmed
  by the absence of any `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` env var read in any test and by
  the grep gates on non-comment lines for raw SQL, `TRUNCATE`, `rpc()` and `.delete()`.
- All five phase-2 ROADMAP success criteria (PURGE-01 through PURGE-05) now have their tooling built
  and structurally verified: PURGE-01/02 by 02-01 (dry-run, criterion, cross-link detection),
  PURGE-03 by 02-02 (export, hashed manifest, PITR check), and PURGE-04/05 by this plan (guarded
  delete, post-purge reconciliation). What remains for the phase is 02-04: the written RUNBOOK
  documenting the two-person procedure — the actual production execution stays explicitly outside
  this phase's automated tasks per D-03.

---
*Phase: 02-test-account-purge*
*Completed: 2026-08-13*

## Self-Check: PASSED

All 3 created files confirmed present on disk; all 4 task commits (`93e8cf8`, `ff96a5f`, `79fa8ae`,
`362ecca`) confirmed present in git log.
