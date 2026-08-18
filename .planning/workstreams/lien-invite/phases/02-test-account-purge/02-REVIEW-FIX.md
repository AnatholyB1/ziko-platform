---
phase: 02-test-account-purge
fixed_at: 2026-08-14T12:05:00Z
review_path: .planning/workstreams/lien-invite/phases/02-test-account-purge/02-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report — Test-Account Purge Toolkit

**Fixed at:** 2026-08-14T12:05:00Z
**Source review:** .planning/workstreams/lien-invite/phases/02-test-account-purge/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (1 critical, 5 warning — `fix_scope: critical_warning`, the 3 Info findings were out of scope)
- Fixed: 6
- Skipped: 0

**Verification:** every fix below was applied and committed inside an isolated git worktree
(temporary path under `.claude/worktrees/`, branch `gsd-reviewfix/02-13844`, since torn down), which
has no `node_modules`. Because this repo's `node_modules` are per-worktree and not shared, the full
`apps/web` purge test suite (`purge-lib.test.ts`, `purge-export.test.ts`, `purge-delete.test.ts`,
`purge-rehearsal.test.ts`) was run from **this worktree's** (`worktree-lien-invite`) `apps/web`
directory (which has `node_modules` installed), invoked against the fix worktree's modified files
copied in temporarily, then this worktree was restored via `git checkout --` immediately after each
run so no uncommitted state was left here. All 106 tests passed on the final cumulative run across
all six commits, run again from this worktree after the six commits fast-forwarded onto
`worktree-lien-invite` (`npx vitest run apps/web/test/purge/` from `apps/web/`) — reproducible from
this checkout going forward.

## Fixed Issues

### CR-01: Cross-link detection (D-05) covers only 3 of 17+ cross-user relationship tables

**Files modified:** `scripts/purge-test-accounts/lib.mjs`, `scripts/purge-test-accounts/verify-purge.mjs`, `scripts/purge-test-accounts/RUNBOOK.md`, `apps/web/test/purge/purge-lib.test.ts`, `apps/web/test/purge/purge-delete.test.ts`
**Commit:** `041f30c`
**Applied fix:** Verified every one of the review's 14 listed tables directly against
`supabase/migrations/` (exact column names, not just trusting the review's list) — all 14 matched
exactly as documented. Also grepped the full migration set independently for every `CREATE TABLE`
with two or more `REFERENCES auth.users(id)` columns and found one table the review itself missed:
`coach_invitations(coach_id, used_by)`, added in `035_coach_invitations_links_rls.sql`, which has
the identical two-FK shape as `coach_client_links`. Extended `CROSS_LINK_SOURCES` in `lib.mjs` from
3 to 18 tables and `ORPHAN_SOURCES` in `verify-purge.mjs` from 4 tables (8 columns) to 19 tables (38
columns), updated the doc comments on both with the full verified migration list, updated
`RUNBOOK.md`'s explicit "those three tables" prose to name and count all 18, and expanded the
`purge-lib` and `purge-delete` test suites with representative cases from each schema family
(community/social, coach-CRM, and the newly-found `coach_invitations`) plus a full-surface
assertion pinning the declared table count. All existing and new tests pass (106 total across the
purge suite after all six fixes).

### WR-01: Manifest hash covers only `candidate_ids`, not `generated_at`/`pitr.status`

**Files modified:** `scripts/purge-test-accounts/export.mjs`, `scripts/purge-test-accounts/delete.mjs`, `scripts/purge-test-accounts/RUNBOOK.md`, `apps/web/test/purge/purge-export.test.ts`, `apps/web/test/purge/purge-delete.test.ts`
**Commit:** `a0ab4bd`
**Applied fix:** Renamed `candidate_ids_sha256` to `manifest_sha256` and changed both the write side
(`buildManifest` in export.mjs) and the read side (`assertManifestIntegrity` in delete.mjs) to hash
`JSON.stringify({ candidate_ids, generated_at, pitr })` instead of just `candidate_ids.join('\n')`,
recomputing identically on both sides. Updated `RUNBOOK.md`'s two references to the old field name.
Added tests confirming the hash changes when `generated_at` or `pitr.status` change independently of
`candidate_ids` (previously neither would have tripped the mismatch check).

### WR-02: CSV formula-injection risk in the two-person-review artifact

**Files modified:** `scripts/purge-test-accounts/lib.mjs`, `scripts/purge-test-accounts/export.mjs`, `apps/web/test/purge/purge-lib.test.ts`, `apps/web/test/purge/purge-export.test.ts`
**Commit:** `2444a58`
**Applied fix:** Added a leading-character check to both copies of `csvField` (duplicated in
`lib.mjs` and `export.mjs`, per IN-01's noted duplication) that prefixes a value starting with `=`,
`+`, `-`, `@`, tab, or `\r` with a neutralizing `'` before quoting, per OWASP CSV-injection guidance.
Added tests in both `purge-lib` and `purge-export` suites confirming a formula-triggering email is
neutralized in the written dry-run/export CSVs.

### WR-03: `--max-manifest-age-minutes` with a non-numeric value silently disables the staleness check

**Files modified:** `scripts/purge-test-accounts/delete.mjs`, `apps/web/test/purge/purge-delete.test.ts`
**Commit:** `ffdc06a`
**Applied fix:** Added an explicit `Number.isNaN(maxAgeMinutes)` guard inside
`assertManifestIntegrity` (kept in the pure, testable guard function rather than the CLI parser, to
match the codebase's existing fail-closed-and-accumulate-errors pattern) that pushes an error and
skips the now-meaningless staleness comparison. Added a `parsePurgeArgs` test documenting that a
non-numeric CLI value produces `NaN`, and an `assertManifestIntegrity` test confirming that value is
now rejected instead of silently passing.

### WR-04: `verify-purge.mjs` never checks `--report` corresponds to the manifest it's verifying

**Files modified:** `scripts/purge-test-accounts/verify-purge.mjs`, `apps/web/test/purge/purge-delete.test.ts`
**Commit:** `8f57a17`
**Applied fix:** Added a new pure exported function `checkReportMatchesManifest` that resolves
`manifest.source_report` and `--report` the same way and compares them, and wired it into `main()`
to fail closed (`process.exit(1)`, no Supabase read attempted) before any reconciliation happens
when the two disagree. Added unit tests for the matching, mismatched, and missing-`source_report`
cases.

### WR-05: `csvField`'s injection-safety regex omits bare `\r`

**Files modified:** `scripts/purge-test-accounts/lib.mjs`, `scripts/purge-test-accounts/export.mjs`, `apps/web/test/purge/purge-lib.test.ts`, `apps/web/test/purge/purge-export.test.ts`
**Commit:** `fb766e3`
**Applied fix:** Extended `csvField`'s quoting regex in both copies from `/[",\n]/` to `/["\r\n,]/`
so a value containing a lone carriage return (unaccompanied by `\n`) is quoted rather than emitted
bare. Added tests confirming a bare-`\r` email is quoted in both the dry-run and export CSVs.

## Skipped Issues

None — all 6 in-scope findings (CR-01, WR-01 through WR-05) were fixed. The 3 Info findings
(IN-01 duplicated `chunk`/`csvField` helpers, IN-02 repeated CLI-parsing pattern, IN-03 absolute
filesystem paths in the manifest) were out of `fix_scope: critical_warning` and were not touched,
though this fix incidentally reduced some of IN-01's exposure by keeping both `csvField` copies in
sync as part of WR-02 and WR-05.

---

_Fixed: 2026-08-14T12:05:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
