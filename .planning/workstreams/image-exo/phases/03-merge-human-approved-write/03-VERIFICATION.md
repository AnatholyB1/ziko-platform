---
phase: 03-merge-human-approved-write
verified: 2026-08-17T12:00:00Z
status: passed
score: 8/8 must-haves verified (2 accepted overrides for code-review-tracked gaps)
overrides_applied: 2
overrides:
  - must_have: "muscle_groups column is populated from the dataset's muscle_group field as part of the D-01 full-refresh"
    reason: "03-REVIEW.md CR-02: buildExercisePayload in merge-row.ts never writes production muscle_groups. Confirmed in the running codebase and live production (matched rows' muscle_groups are untouched pre-existing values, not merge-written). Recorded in STATE.md Blockers/Concerns as an accepted tracked follow-up (fix + targeted backfill), not fixed in this phase. Does not corrupt data — it leaves the column at its pre-merge state on UPDATE and at NOT NULL DEFAULT '{}' on INSERT (no INSERT has landed yet, since all 6 unmatched_new rows failed on the unrelated category gap)."
    accepted_by: "operator (STATE.md Blockers/Concerns, per verification task instructions)"
    accepted_at: "2026-08-16T20:43:50Z"
  - must_have: "merge.ts reads row.human_decision on ambiguous rows and routes match/insert_new/skip accordingly"
    reason: "03-REVIEW.md CR-01: merge.ts hard-codes every ambiguous row to needs_review, never consulting human_decision. Confirmed in merge.ts:267-274. Zero real-world impact on the actual production run (approved report had 0 ambiguous rows, confirmed live: exercise_import_log has 0 needs_review rows). Recorded in STATE.md as an accepted tracked follow-up bug for the next report containing ambiguous rows."
    accepted_by: "operator (STATE.md Blockers/Concerns, per verification task instructions)"
    accepted_at: "2026-08-16T20:43:50Z"
re_verification: null
gaps: []
deferred:
  - truth: "6 unmatched-new exercises are inserted, bringing non-custom exercises count to 1324"
    addressed_in: "Follow-up work (not a later roadmap phase — tracked in STATE.md Blockers/Concerns)"
    evidence: "merge-run.md 'Follow-up needed' section: category taxonomy mismatch (dataset uses muscle-group categories, production CHECK constraint uses training-modality categories) requires a human decision (alias mapping vs manual INSERT) before a third merge.ts run can pick up the 6 rows via the existing resume mechanism. This is a known, deterministic, non-corrupting gap — the category guard correctly refused to guess rather than violate the CHECK constraint."
human_verification: []
---

# Phase 3: Merge (Human-Approved Write) Verification Report

**Phase Goal:** The exercise library is safely and reversibly updated in production without breaking any FK-referenced program or session history.
**Verified:** 2026-08-17T12:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Merge only runs against a human-approved report; no code path from fetch/match straight into merge | VERIFIED | `merge.ts` Step 0 (`process.stdin.isTTY` guard) is the literal first statement of `main()`, before any file/DB access — confirmed by reading the file (lines 153-169). No `--yes`/`--force`/`process.argv` bypass exists (grep confirms 0 matches). `merge-run.md` records the operator ran it from a real terminal and typed `yes` after reviewing the pre-confirmation summary. |
| 2 | Matched rows UPDATE in place preserving UUID; unmatched-new rows INSERT; no row is ever DELETEd | VERIFIED | `merge-row.ts` contains zero `.delete(` calls (grep-confirmed). Live PostgREST check: non-custom `exercises` count = **1318** (never below the pre-run baseline of 1318 — no deletion). 3 sampled matched UUIDs from `match-report.json` independently re-verified live: each resolves with a populated `image` path. `program_exercises`/`session_sets` both return HTTP 200 (FK targets intact). |
| 3 | Killing/re-running merge resumes from `exercise_import_log` without reprocessing or corrupting already-migrated rows | VERIFIED | `lib/import-log.ts`'s `computeResumeState`/`buildResumeMap` are pure, unit-tested (12 passing tests, order-independent reduction proven). `merge-run.md` documents an actual Run 1 → Run 2 sequence: Run 2 shows 0 additional updates, 1318 rows correctly skipped as already-done, and the same 6 errored rows retried and failing identically (deterministic, not corrupted/duplicated). |
| 4 | Legacy/ambiguous rows with no confident match are left untouched, never auto-merged, never deleted, flagged for manual review (IMPORT-05) | VERIFIED | `processRow`'s `needs_review` branch (merge-row.ts:142-153) returns immediately with no Storage/`exercises` access — proven by `merge-row.test.ts`'s `describe('IMPORT-05 — needs_review rows are untouched')` block (asserts zero `exercises.*`/upload calls). `merge.ts` builds `report.unmatched_legacy` and `report.ambiguous` rows into `kind: 'needs_review'` work items (lines 259-274) — the code path exists and is exercised by the loop even though the approved report had 0 rows of each kind this run. Live check: `exercise_import_log` has 0 `needs_review` rows this run, consistent with 0 legacy/ambiguous input rows. **Caveat (CR-01, accepted override):** the ambiguous branch ignores `row.human_decision` and always routes to `needs_review` rather than acting on an operator's `match`/`insert_new`/`skip` resolution — a real bug for a future report containing ambiguous rows, with zero impact on this run (0 ambiguous rows existed). Tracked in STATE.md. |
| 5 | Every UPDATEd row snapshotted to `exercises_merge_backup` before the write; no uploaded media exceeds 180×180 | VERIFIED | `merge-row.ts` orders `exercises_merge_backup.insert` strictly before `exercises.update` (grep + `merge-row.test.ts`'s `indexOf` order assertions), and a failed backup insert leaves the UPDATE uncalled (dedicated test). Live PostgREST: `exercises_merge_backup` count = **1318**, exact 1:1 with the UPDATE tally. Independently re-downloaded a live storage object and measured with `sharp`: `180×180` PNG — matches MEDIA-03 exactly. |
| 6 | `muscle_groups` is written as part of the D-01 "full refresh" (matched UPDATE + unmatched_new INSERT) | PASSED (override) — see frontmatter | `buildExercisePayload` (merge-row.ts:91-101) never reads or writes `record.muscle_group`/`muscle_groups`. Live-confirmed: sampled matched rows carry pre-existing `muscle_groups` values untouched by the merge (not empty, but not merge-written either — these predate this pipeline). Confirmed CR-02 finding is real and unresolved. Accepted as a tracked follow-up per STATE.md and task instructions, not phase-blocking. |

**Score:** 6/6 truths verified (2 with an accepted override for a documented, tracked code-review gap that does not corrupt data or break FK integrity)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | 6 unmatched-new exercises INSERTed, non-custom count reaches 1324 | Follow-up work (STATE.md Blockers/Concerns) | Deterministic category-taxonomy mismatch (dataset uses muscle-group categories; production CHECK constraint uses training-modality categories). The category guard (`lib/category.ts`, by design has no fuzzy/default mapping) correctly refused to INSERT rather than silently mislabel — confirmed identical failure across 2 independent runs (Run 1 and Run 2 in `merge-run.md`). Non-corrupting: no wrong data was written, no partial rows exist. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260815_exercises_merge_backup_and_i18n.sql` | i18n columns + backup table, live in production | VERIFIED | File exists, Section 1 (i18n columns) precedes Section 2 (backup table) as required; `INCLUDING DEFAULTS` only, no PK inherited; RLS enabled with zero policies. Live PostgREST confirms `instructions_fr`, `instruction_steps`, `exercises_merge_backup` are all queryable in production (1318 backup rows present). |
| `scripts/exercise-import/lib/media.ts` | 180×180 cap, no upscale, GIF animation preserved | VERIFIED | Exports `capImage`, `capGif`, `MEDIA_CAP_PX`; `withoutEnlargement: true` + `fit: 'inside'` present twice each; 8/8 tests pass. Independently re-verified against a live production object: 180×180. |
| `scripts/exercise-import/lib/retry.ts` | Bounded retry, 3 attempts, 500/1000ms backoff | VERIFIED | Exports `withRetry`, `RETRY_ATTEMPTS=3`, `RETRY_BASE_DELAY_MS=500`; 8/8 tests pass. |
| `scripts/exercise-import/lib/supabase-write-client.ts` | Service-role client, no publishable-key fallback | VERIFIED | Exports `createWriteClient`; no `SUPABASE_PUBLISHABLE_KEY` fallback (grep-confirmed); 6/6 tests pass. |
| `scripts/exercise-import/lib/import-log.ts` | Pure resume-state reduction | VERIFIED | Exports `computeResumeState`, `buildResumeMap`, `reduceLatestBySourceId`; 12/12 tests pass, order-independence proven. |
| `scripts/exercise-import/lib/category.ts` | Category CHECK-constraint guard, no silent coercion | VERIFIED | Exports `ALLOWED_CATEGORIES`, `mapDatasetCategory`, `collectUnmappableCategories`; 10/10 tests pass. Live production run confirms the guard fired correctly on the 6 unmappable-category rows (deterministic failure, no corruption). |
| `scripts/exercise-import/lib/merge-row.ts` | Per-row unit of work: cap+upload, snapshot, write, classify | VERIFIED (with CR-02 gap, overridden) | Exports `processRow`, `buildExercisePayload`, `storagePaths`, `EXERCISE_MEDIA_BUCKET`; 17/17 tests pass including ordering assertions. `muscle_groups` omission confirmed live (see truth #6 above). |
| `scripts/exercise-import/merge.ts` | Merge entrypoint: preflight, human gate, sequential loop, audit log | VERIFIED (with CR-01 gap, overridden) | TTY guard first statement of `main()`; strict report parsing (`.parse`, not `.safeParse`); dataset commit drift check; sequential `for...of` loop (no `Promise.all`); one `exercise_import_log` insert per row per run including skips. `human_decision` on ambiguous rows not read (see truth #4 caveat). |
| `.planning/workstreams/image-exo/reports/merge-run.md` | Real production run record | VERIFIED | Exists, documents preflight, 2 run outputs, 9-check post-run verification table, roadmap success-criteria mapping, and error triage. Independently spot-re-verified 6 of the 9 checks live against production during this verification pass (counts, FK integrity, media dimensions all reconciled). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `merge.ts` | `process.stdin.isTTY` | hard-exit guard, first statement of `main()` | WIRED | Confirmed by direct file read — line 162 is inside `main()` before any other statement. |
| `merge-row.ts` | `public.exercises_merge_backup` | insert before update, matched rows only | WIRED | `select` → `insert` into backup → `update`, confirmed by reading the code (lines 200-222) and by `merge-row.test.ts`'s index-order assertions. Live: 1318 backup rows reconcile 1:1 with the 1318 UPDATEs. |
| `merge-row.ts` | `lib/media.ts` (`capImage`/`capGif`) | every uploaded buffer passes through the cap first | WIRED | Lines 179-198: source bytes → `capImage`/`capGif` → upload. Test suite asserts the uploaded buffer is the capped one, not the raw source. Live spot-check: downloaded object measures exactly 180×180. |
| `merge.ts` | `public.exercise_import_log` | one insert per row per run, including skips | WIRED | Confirmed in the loop (lines 324-386): both the `'done'`-skip branch and the `processRow` branch each write exactly one log row. Live: log row counts reconcile with `merge-run.md`'s documented tallies (append-only, cumulative across runs as designed). |
| `scripts/exercise-import/lib/category.ts` | `merge-row.ts` `buildExercisePayload` | `mapDatasetCategory` gates category writes | WIRED | Confirmed live: the 6 unmatched_new rows failed with the exact `"Cannot INSERT exercise... is not one of the CHECK-allowed values"` message defined in `merge-row.ts:109-111`. |

### Data-Flow Trace (Level 4)

Not applicable in the standard React/API sense — this phase is a one-shot data-migration script, not a rendering surface. The equivalent trace (dataset record → capped media/attribute payload → production write) was verified end-to-end above via live production re-checks (Key Link Verification table) rather than a component prop trace.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `npm run test:import` passes (all phase 3 unit suites + no regression in Phase 2 suites) | `rtk npm run test:import` | 12 test files, 151 tests, all passed | PASS |
| Non-custom `exercises` count matches `merge-run.md`'s claimed 1318 | live `curl` PostgREST with `Prefer: count=exact` | `Content-Range: 0-999/1318` | PASS |
| `exercises_merge_backup` count matches claimed 1318 | live `curl` PostgREST | `Content-Range: 0-999/1318` | PASS |
| Sampled `exercises.image` storage object is ≤180×180 | live download + `sharp(...).metadata()` | `{width:180, height:180, format:'png'}` | PASS |
| `program_exercises`/`session_sets` FK targets still reachable | live `curl` HTTP status | both `200` | PASS |
| `exercise_import_log` `needs_review` count is 0 this run (matches 0 ambiguous/0 unmatched_legacy in report) | live `curl` PostgREST | `Content-Range: */0` | PASS |

### Probe Execution

No dedicated `scripts/*/tests/probe-*.sh` files exist for this pipeline; conventional migration-phase verification took the form of `npm run test:import` (unit) plus this verification pass's independent live PostgREST/Storage re-checks (integration), both executed directly above rather than via a probe script. SKIPPED — no probe files found under `scripts/exercise-import/`.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| IMPORT-03 | 03-01, 03-04, 03-05, 03-06 | Merge only on approved report; UPDATE matched in place (preserve UUID); INSERT unmatched-new; never DELETE | SATISFIED | Truths #1, #2 above; live count/UUID/FK checks. |
| IMPORT-04 | 03-03, 03-05, 03-06 | Idempotent/resumable via `exercise_import_log`; killed/re-run does not reprocess or corrupt migrated rows | SATISFIED | Truth #3; `merge-run.md`'s real Run 1/Run 2 sequence is direct behavioral proof, not just unit-test proof. |
| IMPORT-05 | 03-04, 03-05, 03-06 | Legacy/ambiguous rows left intact, flagged for manual review, never auto-merged/deleted | SATISFIED (with a noted CR-01 caveat) | Truth #4. Code path exists and is unit-proven; the real run had 0 rows of this kind so the path was structurally exercised but not behaviorally exercised against real ambiguous data. `human_decision` reading bug (CR-01) is real but did not affect this run and is tracked as follow-up. **Note:** `REQUIREMENTS.md` still shows this requirement as unchecked `[ ]` / "Pending" in its traceability table (line 66) despite IMPORT-03/IMPORT-04/MEDIA-03/MEDIA-04 all being marked `[x]`/"Complete" for the same phase — this appears to be a documentation-update oversight rather than a functional gap, since the code and tests satisfy the requirement's literal text. Recommend updating `REQUIREMENTS.md` to `[x]`/"Complete" as part of phase closeout, or explicitly re-opening it if there was a deliberate reason to leave it pending. |
| MEDIA-03 | 03-02, 03-04 | Media capped/served at native ≤180×180, never upscaled, enforced at upload | SATISFIED | Truth #5; live-reconfirmed via independent download + `sharp` metadata read. |
| MEDIA-04 | 03-01, 03-04, 03-06 | Backup snapshot before every UPDATE, for reversibility | SATISFIED | Truth #5; live count reconciliation (1318 = 1318). |

**Orphaned requirements check:** `REQUIREMENTS.md`'s traceability table maps exactly IMPORT-03, IMPORT-04, IMPORT-05, MEDIA-03, MEDIA-04 to Phase 3 — matching the 5 requirement IDs given in the verification task. No orphaned requirements found for this phase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scripts/exercise-import/lib/merge-row.ts` | 91-101 | `buildExercisePayload` omits `muscle_groups` entirely (CR-02) | Warning (accepted override) | Every merged row's `muscle_groups` is left at its pre-existing value (matched) or NOT NULL default `'{}'` (would-be inserted rows) instead of the dataset's `muscle_group` value — silent field loss vs. the documented "full refresh." Tracked in STATE.md as follow-up. |
| `scripts/exercise-import/merge.ts` | 267-274 | Ambiguous work-item construction ignores `row.human_decision` (CR-01) | Warning (accepted override) | Dead code path for the ambiguous-row human-review workflow; zero impact this run (0 ambiguous rows), real bug for a future report. Tracked in STATE.md as follow-up. |
| `scripts/exercise-import/merge.ts` | 130-151 (`readAllImportLogRows`) | No `ORDER BY` on the paginated `exercise_import_log` read (WR-01 in 03-REVIEW.md) | Info | Not independently re-verified as causing an actual misclassification in the real run (the real run's resume behavior in `merge-run.md` was correct both times), but is a theoretical resume-correctness risk PostgREST/Postgres do not guarantee stable ordering without an explicit sort. Not phase-blocking; noted for traceability per 03-REVIEW.md WR-01. |

No `TBD`/`FIXME`/`XXX` unreferenced debt markers found in the files modified by this phase (checked `merge.ts`, `merge-row.ts`, `category.ts`, `import-log.ts`, `retry.ts`, `media.ts`, `supabase-write-client.ts`).

### Human Verification Required

None. All must-haves are either directly code/test-verified or independently re-confirmed against live production during this verification pass. The two code-review-identified gaps (CR-01, CR-02) are pre-documented, tracked, non-corrupting, and explicitly flagged by the task as accepted follow-up work rather than open questions requiring a new human decision.

### Gaps Summary

No blocking gaps. All 5 roadmap-mapped requirements (IMPORT-03, IMPORT-04, IMPORT-05, MEDIA-03, MEDIA-04) are satisfied by both code/unit-test evidence and independent live-production re-verification performed during this verification pass (not just trusting `merge-run.md`'s self-reported numbers — the count, FK, and media-dimension checks were re-run live and matched).

Two known, non-blocking gaps carried forward from `03-REVIEW.md` and already recorded in `STATE.md` as accepted follow-up work:
1. **CR-02 (muscle_groups never written)** — confirmed still present in the live codebase and confirmed via live data that merged rows' `muscle_groups` were not touched by the merge. Needs a follow-up fix in `buildExercisePayload` plus a targeted backfill for the 1,318 already-merged rows (a plain re-run of `merge.ts` will skip them, since they are already logged `matched`).
2. **CR-01 (ambiguous `human_decision` ignored)** — confirmed still present in the live codebase. Zero impact on the actual production run (0 ambiguous rows existed), but will silently discard any human review decision the next time a report contains ambiguous rows.

One separately-tracked, non-blocking deferred item: 6 unmatched-new exercises remain uninserted due to a genuine dataset/production category-taxonomy mismatch (muscle-group vs. training-modality categories). The category guard behaved correctly (refused to guess); a human decision on alias-mapping vs. manual INSERT is needed before the non-custom exercise count reaches the full 1324.

**Minor documentation inconsistency (non-blocking):** `REQUIREMENTS.md` line 66 still lists IMPORT-05 as `[ ]`/"Pending" in its checkbox and traceability table, while IMPORT-03/IMPORT-04/MEDIA-03/MEDIA-04 (same phase) are marked `[x]`/"Complete." The underlying requirement is satisfied in code and tests (see Requirements Coverage above); this looks like a doc-sync oversight during phase closeout rather than a functional gap, but should be corrected.

---

*Verified: 2026-08-17T12:00:00Z*
*Verifier: Claude (gsd-verifier)*
