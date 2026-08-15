---
phase: 02-download-match-dry-run
plan: 03
subsystem: data-pipeline
tags: [zod, git-clone, fs-verification, vitest, path-traversal]

# Dependency graph
requires:
  - phase: 02-02
    provides: "lib/paths.ts (DATASET_CACHE_DIR, DATASET_ROOT, DATASET_JSON_PATH, DATASET_REPO_URL, assertRunFromRepoRoot), lib/types.ts (DatasetExerciseArraySchema, DatasetExercise)"
provides:
  - "lib/verify.ts — pure, testable dataset manifest verification: resolveInsideRoot(), loadDatasetJson(), verifyDataset()"
  - "fetch.ts — clone-or-reuse entrypoint that hard-exits on verification failure, prints dataset_commit=<sha>"
affects: [02-04, 02-05, 02-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Path-containment check via trailing-separator-aware prefix comparison (resolvedRoot + sep), not bare startsWith — catches images/../../../../etc/passwd.jpg-style traversal that format-only regexes cannot"
    - "Comments describing forbidden tokens (module-system globals, hardcoded counts) paraphrased rather than named literally, since acceptance-criteria greps scan the whole file including comments (same self-reference trap documented in 02-02's SUMMARY)"
    - "fetch.ts calls main() unconditionally at module load and is never imported by a test — keeps the CommonJS/ESM dual-runtime constraint entirely out of scope for that file"

key-files:
  created:
    - scripts/exercise-import/lib/verify.ts
    - scripts/exercise-import/lib/verify.test.ts
    - scripts/exercise-import/fetch.ts
  modified: []

key-decisions:
  - "Path-escape test fixture used 'images/../../../../etc/passwd.jpg' (format-valid per the zod regex, but resolves outside datasetRoot) to exercise the full verifyDataset() pipeline end-to-end, in addition to a direct resolveInsideRoot() unit test — covers both verification paths the plan's acceptance criteria call for"
  - "fetch.ts prints images/videos counts in the success summary (plan step 7) by reading the directories directly, since verifyDataset() intentionally returns only a mismatch-string array, not counts"

patterns-established:
  - "Grep-gated files (verify.ts, fetch.ts, verify.test.ts) had every explanatory comment written to avoid literally containing the token strings their own acceptance-criteria greps assert are absent (1324, __dirname, import.meta, .dataset-cache) — checked via the exact plan greps before each commit, not just visually reviewed"

requirements-completed: [IMPORT-01]

# Metrics
duration: 20min
completed: 2026-08-15
---

# Phase 2 Plan 3: Fetch & Manifest Verification Summary

**`lib/verify.ts` (pure, unit-tested dataset manifest verification with path-traversal defence-in-depth) + `fetch.ts` (clone-or-reuse entrypoint) — 12 new tests, 41/41 passing across the pipeline, zero database access.**

## Performance

- **Duration:** ~20 min (includes a from-scratch `npm install` — node_modules was gitignored and absent in this fresh worktree)
- **Started:** 2026-08-15T09:35:00Z (approx.)
- **Completed:** 2026-08-15T09:52:54Z
- **Tasks:** 2 (both `type="auto"`)
- **Files modified:** 3 (all new)

## Accomplishments
- `lib/verify.ts` — `resolveInsideRoot()` (trailing-separator-aware containment check, defence-in-depth behind the zod path regexes), `loadDatasetJson()` (zod-validated parse, lets `ZodError` propagate on schema drift), `verifyDataset()` (structural check → images/videos count parity vs. `exercises.json` length → per-record media path resolution+existence → duplicate-id detection, capped at 25 reported mismatches plus a "...and N more" line)
- `lib/verify.test.ts` — 12 tests covering: well-formed 2-record fixture returns `[]`; count mismatch naming both numbers; missing-image mismatch naming the record id; path-escape mismatch (both a direct `resolveInsideRoot` assertion and a full `verifyDataset` fixture using a regex-format-valid-but-escaping path); duplicate-id detection; missing `videos/` structural mismatch; `loadDatasetJson` `ZodError` on a missing required field; the 25-item cap
- `fetch.ts` — thin entrypoint: `assertRunFromRepoRoot()` → `--refetch` flag parse → clone-or-reuse (skips network entirely when cached, `rmSync` + fresh `git clone --depth 1` via `spawnSync` argv-array form on `--refetch`) → prints `dataset_commit=<sha>` → `loadDatasetJson` with `ZodError` re-labelled as schema drift → `verifyDataset` with itemised hard-exit(1) on any mismatch (D-11, no report written) → success summary (record/image/video counts, commit SHA, next command). Zero `@supabase/supabase-js` import, zero Supabase env var read.
- 41/41 tests passing across the whole `scripts/exercise-import` suite (29 from 02-02 + 12 new), no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Pure dataset verification module (lib/verify.ts)** - `4d82898` (feat)
2. **Task 2: Clone-or-reuse fetch entrypoint (fetch.ts)** - `0b2447f` (feat)

**Plan metadata:** committed together with this SUMMARY.md (docs commit, see below)

## Files Created/Modified
- `scripts/exercise-import/lib/verify.ts` - Pure manifest verification: path containment, zod-validated dataset parse, structural/count/media/duplicate checks
- `scripts/exercise-import/lib/verify.test.ts` - 12 tests against `fs.mkdtempSync` fixtures, never touching the real dataset cache
- `scripts/exercise-import/fetch.ts` - Clone-or-reuse entrypoint; hard-exits on any verification failure with an itemised reason list and no report artifact

## Decisions Made
- Followed the plan's exact task order and function signatures verbatim (`resolveInsideRoot`, `loadDatasetJson`, `verifyDataset` exports; the 6-step `verifyDataset` check order; the 7-step `fetch.ts` behaviour sequence) — no functional deviations from the plan text.
- Path-escape test coverage satisfies both halves of the plan's acceptance criteria: a direct `resolveInsideRoot(root, '../../../etc/passwd')` unit test, plus a full-pipeline `verifyDataset()` fixture test using `'images/../../../../etc/passwd.jpg'` — a value that satisfies the zod schema's `^images/.+\.(jpg|jpeg|png)$` format regex but still escapes the dataset root once resolved, which is exactly the gap `resolveInsideRoot()` exists to close.

## Deviations from Plan

None — plan executed exactly as written. One implementation-detail fix (below) was needed to satisfy the plan's own stated acceptance criteria, not a deviation from the plan's intent.

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Rephrased self-referential comments to satisfy the plan's own negative-assertion greps**
- **Found during:** Task 1 (`lib/verify.ts`, `lib/verify.test.ts`)
- **Issue:** Initial doc comments literally repeated the tokens the acceptance-criteria greps assert are absent from the file — a comment explaining "no `__dirname`, no `import.meta.url`" contains those exact literal substrings; a comment mentioning capping mismatches "so a totally-wrong clone doesn't print 1,324+ lines" contains the literal substring `1,324`; a test-file comment referencing "the real `.dataset-cache/` clone directory" contains the literal substring `.dataset-cache`. The plan's greps (`grep -cE "1324|1,324"`, `grep -cE "__dirname|import\.meta"`, and the test's own `.dataset-cache` absence check) scan the whole file including comments, so these self-referential mentions caused all three gates to fail on first run.
- **Fix:** Rephrased each comment to describe the constraint without literally spelling out the forbidden token — e.g. "Node's CommonJS current-module-directory global or the ESM current-module-URL meta property" instead of naming `__dirname`/`import.meta`; "one line per dataset record" instead of the literal count; "the real cloned-dataset cache directory used by fetch.ts (see lib/paths.ts DATASET_CACHE_DIR)" instead of the literal `.dataset-cache` string. This mirrors the identical pattern documented in 02-02's SUMMARY (the same self-reference trap, different tokens).
- **Files modified:** `scripts/exercise-import/lib/verify.ts`, `scripts/exercise-import/lib/verify.test.ts`
- **Verification:** Re-ran every plan-specified acceptance-criteria grep after the rephrase — all returned 0 (or the expected count); 12/12 tests still passed.
- **Committed in:** `4d82898` (Task 1 commit — caught and fixed before committing, not a separate follow-up commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — self-referential grep-gate conflict)
**Impact on plan:** Purely a comment-phrasing fix to satisfy the plan's own acceptance criteria; zero functional/behavioral change. No scope creep.

## Issues Encountered
- This worktree was created fresh; `node_modules/` (gitignored) did not exist, so `npm install` had to run before any test could execute. Added a few minutes to the plan's duration — expected, one-time worktree setup, not a plan deviation.
- The worktree's HEAD was found on `28d350d` at a merge-base mismatch with the expected base commit hash provided in the task's `<worktree_branch_check>` step; corrected via `git reset --hard 28d350d32b96c7a0b95094c929eeff3943aa6119` per that step's own documented recovery procedure (not a self-invented recovery — the step explicitly specifies this reset when the merge-base check fails).

## User Setup Required

None — no external service configuration required. `fetch.ts` reads no environment variables and touches no Supabase credential of any kind.

## Next Phase Readiness

- Both `must_haves.artifacts` exist with every listed export: `lib/verify.ts` (`loadDatasetJson`, `verifyDataset`, `resolveInsideRoot`), `fetch.ts` (≥40 lines, clone-or-reuse entrypoint).
- `npx vitest run scripts/exercise-import` is green (41/41 tests, 4/4 files) — the acceptance bar plan 02-04 (the matcher) and plan 02-05 (report writer, which stamps `fetch.ts`'s `dataset_commit=` output into the report) both build on.
- `fetch.ts` was never executed by this plan's automated gate (by design, per the plan's own static/grep-only verification note) — a live network-dependent manual run against the real dataset is the phase-level verification step, deferred to the phase gate per 02-RESEARCH.md's "Sampling Rate" section, not to this plan.
- Zero database access confirmed via the plan's own grep gate (`createClient|SUPABASE_|execSync\(|shell: ?true` returns 0 in `fetch.ts`) — `T-02-02` (Elevation of Privilege) has no credential to escalate in this plan's output.
- No blockers for plan 02-04 (the 3-tier matcher, which consumes `lib/normalize.ts` + `lib/supabase-client.ts` from 02-02 and does not depend on `fetch.ts`/`lib/verify.ts` directly, only on the cloned dataset `fetch.ts` produces at runtime).

---
*Phase: 02-download-match-dry-run*
*Completed: 2026-08-15*
