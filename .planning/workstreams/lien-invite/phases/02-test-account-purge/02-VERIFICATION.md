---
phase: 02-test-account-purge
verified: 2026-08-14T13:00:00Z
status: passed
score: 5/5 must-haves verified (2 by override)
behavior_unverified: 0
overrides_applied: 2
overrides:
  - must_have: "A restorable backup/PITR checkpoint exists and its timestamp is recorded before the real deletion executes (PURGE-03)"
    reason: "CONTEXT.md decision D-03 (confirmed at the Task 3 human checkpoint, 02-04-PLAN.md) deliberately scopes this phase to building and rehearsing the full purge toolkit without executing the real deletion against production. A PITR/backup checkpoint 'before the real deletion executes' is, by construction, state that can only exist once that separate, explicitly human-triggered production run happens. The mechanism that produces and records this checkpoint (pitr.mjs's checkPitrStatus, export.mjs's unconditional row export + manifest) is built, tested, and independently re-verified working in this session — only the literal production execution is out of scope, by design, with human sign-off."
    accepted_by: "project owner (approved at Phase 2 Task 3 blocking checkpoint, per 02-04-SUMMARY.md and 02-04-PLAN.md Task 3 resume-signal)"
    accepted_at: "2026-08-14T00:00:00Z"
  - must_have: "After deletion, re-running the original match query returns zero rows, and no orphaned row remains in any linked table (PURGE-05)"
    reason: "Same D-03 scope boundary — this criterion describes the post-deletion state of production, which cannot exist until the real deletion has actually run. verify-purge.mjs (checkResidualMatches, checkAccountConservation, fetchOrphanRows/summarizeOrphans across all 18 cross-user tables) is built, tested against fixtures, and independently re-verified in this session to correctly detect both a clean purge and an over-deletion. Only the literal production run and its zero-row confirmation are deferred, by design, with human sign-off at the same Task 3 checkpoint."
    accepted_by: "project owner (approved at Phase 2 Task 3 blocking checkpoint, per 02-04-SUMMARY.md and 02-04-PLAN.md Task 3 resume-signal)"
    accepted_at: "2026-08-14T00:00:00Z"
---

# Phase 2: Test-Account Purge — Verification Report

**Phase Goal:** Production no longer contains dev/QA test accounts, removed through an audited,
backed-up, two-person-reviewed procedure — so the founder counter that later goes live counts only
genuine signups.
**Verified:** 2026-08-14T13:00:00Z
**Status:** passed (with 2 explicit, human-approved scope overrides — see note below)
**Re-verification:** No — initial verification

## Important framing note (read first)

This phase's design (`02-CONTEXT.md` D-03, reconfirmed at the Task 3 human checkpoint in
`02-04-PLAN.md`) is deliberately **build-and-rehearse, not fire**. The literal phase-goal sentence
("production no longer contains dev/QA test accounts") describes an end state that cannot exist until
a separate, explicitly human-triggered production run happens outside this phase — no
`SUPABASE_SERVICE_ROLE_KEY` for the production project has ever been available in any session through
Phase 1 or Phase 2. This is a documented, human-accepted scope boundary, not a defect discovered during
verification: `ROADMAP.md`'s own Phase 2 section states it as a "Scope note" directly under the five
success criteria, and the human explicitly approved it at the Task 3 blocking checkpoint.

Given that, this report verifies what the phase actually promised to deliver — a complete, correct,
independently-tested purge **toolkit and procedure** — and treats the two success criteria that can only
become true after the (out-of-scope) production run (PURGE-03's backup timestamp, PURGE-05's
post-deletion zero-row state) as accepted overrides rather than failures. All mechanism-level evidence
behind those two criteria (PITR read, unconditional export, post-purge reconciliation logic) was built,
tested, and independently re-verified below.

## Goal Achievement

### ROADMAP Success Criteria (verbatim)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | PURGE-01 — A written, human-reviewed list of exact test-account IDs/emails exists before any deletion runs; no bare pattern match is the executed filter | ✓ VERIFIED | `scripts/purge-test-accounts/RUNBOOK.md` §1 states the exact-equality `ziko-app.com` criterion in prose with all 4 lookalikes named as real accounts; `dry-run.mjs`/`writeReport` produce the concrete id/email list on disk; human approved the criterion + rehearsal at the Task 3 checkpoint (`02-04-SUMMARY.md`). Independently confirmed `isTestAccountEmail` rejects all 4 lookalikes and matches only exact domain via direct `node -e` execution (not test-suite trust alone). |
| 2 | PURGE-02 — A dry-run export lists precisely the accounts that would be deleted, including cross-links to real accounts flagged for manual review, with zero rows actually removed | ✓ VERIFIED | `lib.mjs`'s `runDryRun`/`classifyAccounts`/`writeReport` produce `to_delete`/`flagged` partitions; `dry-run.mjs` contains no `deleteUser` or raw SQL call (independently grepped). `purge-lib.test.ts` (39 tests) and `purge-rehearsal.test.ts` (1 test, 37 assertions) both exercise this end to end; all pass when run directly (`npx vitest run test/purge/` → 106/106 passing). |
| 3 | PURGE-03 — A restorable backup/PITR checkpoint exists and its timestamp is recorded before the real deletion executes | **PASSED (override)** | Mechanism is real and independently verified (`pitr.mjs`'s `checkPitrStatus` correctly resolves `enabled`/`disabled`/`unknown`; `export.mjs` runs the row export unconditionally and writes the manifest's `pitr` field) — but the literal "before the real deletion executes" state cannot exist without the out-of-scope production run. See override in frontmatter. |
| 4 | PURGE-04 — Every deletion runs through the Admin API path (`admin.auth.admin.deleteUser()`), never raw bulk SQL | ✓ VERIFIED | `delete.mjs:264` binds `deleteAccount` to `client.auth.admin.deleteUser`; independently confirmed no `DELETE FROM`/`TRUNCATE`/`rpc(` on non-comment lines of any purge script (`grep` count = 0). Independently ran `runDelete` with a recording fake and confirmed exactly the manifest ids, once each, in order. |
| 5 | PURGE-05 — After deletion, re-running the original match query returns zero rows, and no orphaned row remains in any linked table | **PASSED (override)** | Mechanism is real and independently verified (`verify-purge.mjs`'s `checkResidualMatches`, `checkAccountConservation`, `fetchOrphanRows`/`summarizeOrphans` across all 18 cross-user tables/38 columns correctly detect both a clean purge and an injected over-deletion in independent `node -e` runs) — but the literal post-deletion production state cannot exist without the out-of-scope production run. See override in frontmatter. |

**Score:** 5/5 ROADMAP success criteria accounted for (3 directly verified, 2 verified at the mechanism
level and accepted via override for the production-state clause, per the phase's own documented and
human-approved scope boundary).

### In-Phase Mechanism Evidence (supporting detail behind the table above)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 6 | D-01: exact `ziko-app.com` domain equality, case/whitespace-insensitive; all 4 lookalikes rejected | ✓ VERIFIED | Independently executed `isTestAccountEmail` against all 8 documented cases via `node -e` — passed. |
| 7 | D-05: a candidate cross-linked to a non-candidate through **any** of the 18 documented cross-user tables is withheld from `to_delete` and named in `flagged` | ✓ VERIFIED | `CROSS_LINK_SOURCES` in `lib.mjs` independently cross-checked against a fresh regex scan of every `CREATE TABLE`/`ALTER TABLE ADD COLUMN` in `supabase/migrations/` with 2+ `REFERENCES auth.users(id)` columns: 17 via `CREATE TABLE` + 1 via `ALTER TABLE` (`workout_programs`) = 18, matching `CROSS_LINK_SOURCES` exactly. This closes CR-01 from `02-REVIEW.md` (originally only 3 of 18 tables covered — verified fixed, not merely claimed fixed). |
| 8 | `verify-purge.mjs`'s `ORPHAN_SOURCES` mirrors the same 18-table surface (38 columns) | ✓ VERIFIED | Read directly — 19 table entries (incl. `user_profiles.id`) covering all 18 cross-link tables plus the base table. |
| 9 | Manifest hash (`manifest_sha256`) binds `candidate_ids`, `generated_at`, and `pitr` together — not just the id list (WR-01 fix) | ✓ VERIFIED | `export.mjs:159` and `delete.mjs:89` both hash `JSON.stringify({ candidate_ids, generated_at, pitr })`; independently tampered a manifest id and confirmed `assertManifestIntegrity` rejects it via direct `node -e` execution. |
| 10 | CSV formula-injection neutralization (WR-02) and bare-`\r` quoting (WR-05) | ✓ VERIFIED | `csvField` in both `lib.mjs` and `export.mjs` prefixes `=+-@\t\r`-leading values and quotes on `["\r\n,]` — read directly in source. |
| 11 | `--max-manifest-age-minutes` NaN input fails closed rather than silently disabling the staleness guard (WR-03) | ✓ VERIFIED | `delete.mjs:105` — explicit `Number.isNaN(maxAgeMinutes)` guard pushes an error, read directly in source. |
| 12 | `verify-purge.mjs` cross-checks `--report` against `manifest.source_report` before reconciling (WR-04) | ✓ VERIFIED | `checkReportMatchesManifest` exported and wired into `main()` before any Supabase read — read directly in source. |
| 13 | Unconfirmed `delete.mjs` invocation performs zero Admin API calls (D-03 safety property) | ✓ VERIFIED | Independently executed `runDelete({ confirm: false, ... })` with a call-counting fake — 0 calls, `attempted: 0`. |
| 14 | Confirmed `delete.mjs` deletes exactly the manifest ids, once each, in manifest order | ✓ VERIFIED | Independently executed `runDelete({ confirm: true, ... })` with a recording fake — ids returned in exact input order. |
| 15 | `checkAccountConservation` catches an over-deletion (an account destroyed outside the reviewed set) with an exact shortfall | ✓ VERIFIED | Independently executed with a fixture producing `shortfall: 2` — matches expected value exactly. |
| 16 | `RUNBOOK.md` states the criterion, the ordered two-person procedure, all guard flags, all 3 PITR states, the recovery path (export primary / PITR backstop), and the D-03 scope boundary; never spells out a raw bulk statement or a `LIKE` pattern | ✓ VERIFIED | Read `RUNBOOK.md` in full (196 lines) — all elements present; independently grepped for `DELETE FROM` and `LIKE '%` — both zero matches. |
| 17 | The four scripts compose end to end on one fixture (rehearsal), zero network calls, zero env reads | ✓ VERIFIED | `purge-rehearsal.test.ts` (37 assertions) ran directly via `npx vitest run` — passed; independently grepped for `process.env` in that file — zero matches. |
| 18 | No export artifact, credential, or real account data ever committed | ✓ VERIFIED | `git log --oneline -- scripts/purge-test-accounts/exports` — empty; `git check-ignore` accepts the export dir; independently grepped all purge files for JWT/`sbp_`-shaped strings — zero matches. |
| 19 | Human reviewed and approved the criterion, runbook, and rehearsal at the Task 3 blocking checkpoint | ✓ VERIFIED (as documented) | `02-04-SUMMARY.md` frontmatter records `human_judgment: true` for this item with rationale, and states the user responded "approve." This is an inherently human-only fact recorded in the phase's execution trail — verified as documented, consistent with the phase's designed checkpoint gate. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/purge-test-accounts/lib.mjs` | Criterion, Admin API enumeration, cross-link fetch (18 tables), classification, report writer | ✓ VERIFIED | 354 lines; all 8 documented exports present; `CROSS_LINK_SOURCES` has 18 entries |
| `scripts/purge-test-accounts/dry-run.mjs` | Read-only CLI | ✓ VERIFIED | 62 lines; no destructive call |
| `scripts/purge-test-accounts/export.mjs` | Unconditional pre-delete export + hashed manifest | ✓ VERIFIED | 314 lines; `manifest_sha256` over `{candidate_ids, generated_at, pitr}` |
| `scripts/purge-test-accounts/pitr.mjs` | PITR status via Management API, honest `unknown` | ✓ VERIFIED | 113 lines; `checkPitrStatus`, `resolveProjectRef` present |
| `scripts/purge-test-accounts/delete.mjs` | Guarded Admin API deletion of exactly the manifest set | ✓ VERIFIED | 296 lines; `parsePurgeArgs`, `assertManifestIntegrity`, `runDelete`, `writeDeleteLog` all present and independently exercised |
| `scripts/purge-test-accounts/verify-purge.mjs` | Residual reconciliation + 18-table orphan scan + conservation check | ✓ VERIFIED | 306 lines; `ORPHAN_SOURCES` has 19 entries (38 columns across 18 cross-link tables + `user_profiles`) |
| `scripts/purge-test-accounts/RUNBOOK.md` | Written criterion + ordered two-person procedure | ✓ VERIFIED | 196 lines; matches implementation exactly (post CR-01/WR-01 fix updates) |
| `apps/web/test/purge/*.test.ts` (4 files) | Full behavioral proof suite | ✓ VERIFIED | 552+433+630+244 = 1,859 lines; 106/106 tests pass when run directly |
| `.gitignore` entry for `exports/` | Prevents committing real account data | ✓ VERIFIED | `git check-ignore -q scripts/purge-test-accounts/exports/probe.json` exits 0 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `dry-run.mjs` | `lib.mjs` | imports `runDryRun`, `writeReport`, `createPurgeAdminClient` | ✓ WIRED | Confirmed by import + successful `node -e` module load |
| `export.mjs` | `lib.mjs` | imports `createPurgeAdminClient` | ✓ WIRED | Confirmed |
| `export.mjs` | `pitr.mjs` | imports `checkPitrStatus`, stores result in manifest `pitr` field | ✓ WIRED | Confirmed in source and by independent execution |
| `delete.mjs` | `export-<ISO>.manifest.json` | recomputes `manifest_sha256` before any deletion | ✓ WIRED | Confirmed by independent tamper test |
| `delete.mjs` | `auth.admin.deleteUser` | one Admin API call per manifest id | ✓ WIRED | Confirmed by independent order/exactness test |
| `verify-purge.mjs` | `lib.mjs` | imports `isTestAccountEmail`, `listAllUsers` (same criterion, not re-implemented) | ✓ WIRED | Confirmed by grep and read |
| `RUNBOOK.md` | `delete.mjs` | documents every guard flag exactly as implemented | ✓ WIRED | Confirmed by cross-read (all flag names match) |
| `purge-rehearsal.test.ts` | all 5 modules | chains real exported functions, no reimplementation | ✓ WIRED | Confirmed — test passed, zero `process.env` reads |

### Behavioral Spot-Checks (run independently, not from SUMMARY claims)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Criterion accepts exact domain, rejects all 4 lookalikes + edge cases | `node -e` against `isTestAccountEmail` | exit 0 | ✓ PASS |
| Unconfirmed delete performs zero Admin API calls | `node -e` against `runDelete({confirm:false})` | `n===0, attempted===0` | ✓ PASS |
| Confirmed delete calls exactly manifest ids, in order | `node -e` against `runDelete({confirm:true})` | `a,b,c` exact order | ✓ PASS |
| Tampered manifest id fails integrity check | `node -e` against `assertManifestIntegrity` after mutating `candidate_ids[0]` | `ok:false`, hash mismatch reported | ✓ PASS |
| Over-deletion detected by conservation check | `node -e` against `checkAccountConservation` | `ok:false, shortfall:2` | ✓ PASS |
| Full purge test suite | `cd apps/web && npx vitest run test/purge/` | 4 files, 106 tests, 0 failed | ✓ PASS |
| Lint | `cd apps/web && npm run lint` | 0 errors, 43 pre-existing warnings (2 new harmless unused-var warnings in test fixture params) | ✓ PASS |
| No destructive call in non-delete scripts | `grep` on non-comment lines | 0 matches for `deleteUser`/`DELETE FROM`/`TRUNCATE` | ✓ PASS |
| Export directory git-ignored, never committed | `git check-ignore` + `git log` | ignored; empty commit history for `exports/` | ✓ PASS |
| CR-01 fix completeness (18-table cross-link/orphan coverage) | independent regex scan of all migrations for 2+-FK-to-`auth.users` tables | 18 tables found, matches `CROSS_LINK_SOURCES` exactly | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PURGE-01 | 02-01, 02-04 | Written, reviewed criterion before deletion | ✓ SATISFIED | RUNBOOK.md + dry-run mechanism, human-approved |
| PURGE-02 | 02-01 | Dry-run lists exact accounts, zero rows removed | ✓ SATISFIED | lib.mjs/dry-run.mjs, tested |
| PURGE-03 | 02-02, 02-04 | Backup/PITR checkpoint before real deletion | ✓ SATISFIED (mechanism) — production-state clause overridden | pitr.mjs/export.mjs built+tested; production run out of scope by design |
| PURGE-04 | 02-03 | Admin API deletion path only | ✓ SATISFIED | delete.mjs, independently tested |
| PURGE-05 | 02-03 | Zero rows after deletion, no orphans | ✓ SATISFIED (mechanism) — production-state clause overridden | verify-purge.mjs built+tested; production run out of scope by design |

No orphaned requirements — REQUIREMENTS.md's PURGE-01 through PURGE-05 are all claimed by phase-2
plans (`02-01`: PURGE-01/02, `02-02`: PURGE-03, `02-03`: PURGE-04/05, `02-04`: PURGE-01/02/03
re-affirmed in written form).

**Note on REQUIREMENTS.md checkboxes:** REQUIREMENTS.md marks all five PURGE items `[x]` complete.
Read literally against the phase-goal sentence, this slightly overstates the real-world outcome for
PURGE-03 and PURGE-05 (production still contains test accounts as of this verification — the real
purge has not run). This reflects "the phase's planned work on this requirement is done," not "the
requirement's real-world effect is live in production." This is consistent with the phase's own
documented and human-approved scope (D-03) and does not indicate a code or process gap, but a future
reader of REQUIREMENTS.md in isolation (without this phase's context) could be misled — worth a
one-line annotation there if this project wants to avoid ambiguity, though it is not a phase-2 blocker.

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers, no "not yet implemented" strings, no
stub returns, and no swallowed-error patterns in any of the 6 purge scripts, the 4 test files, or
`RUNBOOK.md`.

### Code Review Follow-Up (02-REVIEW.md / 02-REVIEW-FIX.md)

The prior code review found 1 critical (CR-01: cross-link detection covered only 3 of 18 relevant
cross-user tables) and 5 warning-level findings. All 6 were independently re-verified as genuinely
fixed in this session (not merely claimed fixed in 02-REVIEW-FIX.md):

- **CR-01** — `CROSS_LINK_SOURCES`/`ORPHAN_SOURCES` now cover all 18 tables; independently confirmed
  against a fresh migration scan.
- **WR-01** — manifest hash now covers `candidate_ids` + `generated_at` + `pitr`; independently
  confirmed by a tamper test.
- **WR-02** — CSV formula-injection neutralization present in both `csvField` copies.
- **WR-03** — `NaN` on `--max-manifest-age-minutes` now fails closed.
- **WR-04** — `verify-purge.mjs` now cross-checks `--report` against `manifest.source_report`.
- **WR-05** — bare `\r` now triggers CSV quoting.

The 3 Info-level findings (duplicated `chunk`/`csvField` helpers, repeated CLI-parsing pattern,
absolute filesystem paths in the manifest) remain unaddressed but were explicitly out of
`fix_scope: critical_warning` and carry no safety impact — not phase-2 blockers.

### Human Verification Required

None. The phase's one designed human checkpoint (Task 3, `02-04-PLAN.md`, blocking) was already
executed and approved during phase execution, and is documented in `02-04-SUMMARY.md`. No further
UI/visual/external-service-dependent behavior exists in this phase — it is a backend/CLI toolkit with
full behavioral test coverage, all of which was re-run directly in this verification pass.

### Gaps Summary

No blocking gaps. The only items not fully, literally true are the production-state clauses of
PURGE-03 and PURGE-05 (a real backup timestamp recorded before a real deletion; a real zero-row state
after a real deletion) — both are **accepted, documented, human-approved scope deferrals** (CONTEXT.md
D-03, ROADMAP.md's own Phase 2 scope note, and the Task 3 checkpoint approval), not implementation
gaps. Every mechanism behind them is built, tested by the existing suite, and independently
re-exercised in this verification session. The actual production purge run — obtaining production
`SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ACCESS_TOKEN`, running the dry-run against real data, a
second person reviewing the real CSV, and the confirmed delete — remains a separate, explicitly
human-triggered step outside this phase, exactly as designed.

---

_Verified: 2026-08-14T13:00:00Z_
_Verifier: Claude (gsd-verifier)_
