---
phase: 02-download-match-dry-run
fixed_at: 2026-08-15T13:26:00Z
review_path: .planning/workstreams/image-exo/phases/02-download-match-dry-run/02-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-08-15T13:26:00Z
**Source review:** .planning/workstreams/image-exo/phases/02-download-match-dry-run/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (fix_scope: critical_warning — Critical + Warning findings; Info findings IN-01/IN-02/IN-03 out of scope for this run)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: Ambiguous candidates can reference a production row already claimed by `matched` (stale/double-claim risk)

**Files modified:** `scripts/exercise-import/lib/matcher.ts`, `scripts/exercise-import/lib/matcher.test.ts`
**Commit:** `95843d3`
**Applied fix:** `categorizeAll` now reserves every id offered as an ambiguous row's candidate in the `consumed` set at the moment the row is pushed (all three tiers — Tier 1 name-collision, Tier 2 multi-candidate, Tier 3 attribute-overlap), so nothing later in the same run (same pass or a subsequent one) can silently auto-claim a row a human still needs to adjudicate. This establishes the invariant `matched ∩ ambiguous[].candidates === ∅` by construction rather than via a post-hoc reconciliation pass, per the review's "simpler, more conservative alternative."

Went one step further than the literal review text to close a second, related gap surfaced by tracing the fix through: the Tier 1 name index is a static snapshot built once and never shrinks, so a name-collision row (`tier1.rows.length > 1`) could still list a row already claimed *earlier in the same Pass 1 loop* (e.g. matched via `name_fr` moments before). The Tier 1 collision branch now filters `tier1.rows` against `consumed` before building the candidate list, and falls through to Tier 2/3 if nothing unconsumed remains.

Added a regression test (`Regression (CR-01, 02-REVIEW.md): a row already offered as an ambiguous candidate cannot later be auto-claimed into matched`) reproducing the exact scenario described in the review: two production rows sharing a duplicate name, a dataset record hitting the Tier 1 collision branch first, and a second dataset record that would have exact-matched one of the collision candidates via `name_fr`. Asserts the candidate is not claimed into `matched` and that the core no-overlap invariant holds.

Verified: `npm run test:import` — all 90 tests pass (89 pre-existing + 1 new regression test), and `npx tsc --noEmit` reports no errors in the modified files.

**Requires human verification:** This is a logic fix to the matcher's core reservation semantics (not just a syntax/structural change). While it passed the full existing test suite plus a new regression test targeting the exact failure mode, and was traced by hand against the 6-record "totals + no-overlap invariant" fixture to confirm counts are unchanged, the developer should confirm the fix's reasoning (reserve-at-push-time via a shared `consumed` set) matches the intended design before this phase proceeds to verification.

### WR-01: `check-report.ts` does not detect matched/ambiguous-candidate overlap

**File modified:** `scripts/exercise-import/lib/check-report.ts`
**Commit:** `4a5214a`
**Applied fix:** Added a structural check to `checkReport` that flags any `exercise_id` appearing in an ambiguous row's `candidates` that is already present in `matched`, mirroring the existing matched-vs-unmatched_legacy and matched-uniqueness checks in the same file. Applied verbatim as suggested in REVIEW.md (code context matched exactly — no adaptation needed).

Verified: `npm run test:import` — all 90 tests pass; `npx tsc --noEmit` clean.

### WR-02: Prior report is trusted without schema validation, risking an uncaught crash on a malformed edit

**File modified:** `scripts/exercise-import/match.ts`
**Commit:** `f536182`
**Applied fix:** `readPriorReport` now runs the parsed JSON through `MatchReportSchema.safeParse` and returns `null` (with a warning, same as the existing JSON-parse-failure path) on schema validation failure, before the result is ever passed to `mergePriorHumanDecisions`. Applied as suggested in REVIEW.md; added the schema import (`MatchReportSchema`) alongside the existing `MatchReport` type import.

Verified: `npm run test:import` — all 90 tests pass (`match.ts` is never imported by a test, per its own docstring, so no direct unit coverage exists for this function; verification relied on Tier 1 re-read + Tier 2 `tsc --noEmit`). `npx tsc --noEmit` clean.

### WR-03: `unmatched_new` is not sorted deterministically like the other three report categories

**File modified:** `scripts/exercise-import/lib/report.ts`
**Commit:** `cc03d70`
**Applied fix:** `buildReport` now sorts `unmatched_new` by `dataset_id` using the same `compareStrings` comparator already used for `matched`, before stamping `phase3_status`, matching the explicit ordering contract of the other three report categories. Applied verbatim as suggested in REVIEW.md.

Verified: `npm run test:import` — all 90 tests pass (no test asserted the previous unsorted order); `npx tsc --noEmit` clean.

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-08-15T13:26:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
