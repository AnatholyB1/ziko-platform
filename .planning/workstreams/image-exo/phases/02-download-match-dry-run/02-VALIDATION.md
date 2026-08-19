---
phase: 02
slug: download-match-dry-run
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-15
reconciled: 2026-08-15
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> **Reconciled against the six PLAN.md files on 2026-08-15.** Task IDs below are the real ones.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.4 (`backend/api/package.json` — the only test framework configured anywhere in the monorepo; root had no test runner) |
| **Config file** | `vitest.config.ts` at the repo root, `include`-scoped to `scripts/exercise-import/**/*.test.ts` — created by plan 02-01 Task 2 (Wave 1 / Wave-0 scaffold) |
| **Quick run command** | `npx vitest run scripts/exercise-import/<module>.test.ts` (single module) |
| **Full suite command** | `npx vitest run scripts/exercise-import` |
| **Estimated runtime** | ~5 seconds (pure-function unit tests against fixtures and `mkdtemp` trees; no network clone, no live DB calls) |

---

## Sampling Rate

- **After every task commit:** Run the task's own `<automated>` command (single test file, ~1-2s)
- **After every plan wave:** Run `npx vitest run scripts/exercise-import`
- **Before `/gsd:verify-work`:** A full manual `fetch.ts` + `match.ts` run against real data, with human inspection of the match report (this is plan 02-06 Task 3, a blocking human checkpoint), in addition to the automated suite being green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | IMPORT-02 | T-02-SC | Package legitimacy gate for `fastest-levenshtein` before install (blocking human checkpoint) | checkpoint | — (blocking human verify; gate precedes any install) | ✅ | ⬜ pending |
| 02-01-02 | 01 | 1 | IMPORT-01/02 | T-02-04 | Wave-0 scaffold: root `vitest.config.ts` scoped to `scripts/`, deps installed, `.dataset-cache` gitignored | unit | `node -e "require.resolve('fastest-levenshtein'); …" && npx vitest run --passWithNoTests && grep …` | ✅ | ⬜ pending |
| 02-02-01 | 02 | 2 | IMPORT-01/02 | T-02-06 | zod contracts (`DatasetExerciseArraySchema`) + path constants; traversal-rejecting media-path regexes | unit | `npx vitest run scripts/exercise-import/lib/types.test.ts` | ✅ | ⬜ pending |
| 02-02-02 | 02 | 2 | IMPORT-02 | — | Deterministic name normalization + similarity (accents, "3/4", punctuation) | unit | `npx vitest run scripts/exercise-import/lib/normalize.test.ts` | ✅ | ⬜ pending |
| 02-02-03 | 02 | 2 | IMPORT-02 | T-02-02 | Read-only Supabase access with pagination; no hardcoded row count; excludes `is_custom=true` and `coach_exercises` | unit | `npx vitest run scripts/exercise-import/lib/supabase-client.test.ts` | ✅ | ⬜ pending |
| 02-03-01 | 03 | 3 | IMPORT-01 | T-02-01, T-02-06 | Manifest verification: count match, per-record media resolution, `resolveInsideRoot` traversal block, duplicate-id detection, zod drift failure | unit | `npx vitest run scripts/exercise-import/lib/verify.test.ts` | ✅ | ⬜ pending |
| 02-03-02 | 03 | 3 | IMPORT-01 | T-02-07, T-02-02 | Clone-or-reuse entrypoint wiring: argv-array `--depth 1` clone, `verifyDataset` gate, hard exit, no Supabase, no shell interpolation | static (grep-only, by design — see note) | `grep -q …` chain + `npx vitest run scripts/exercise-import` | ✅ | ⬜ pending |
| 02-04-01 | 04 | 3 | IMPORT-02 | T-02-10 | 3-tier matcher; `findDuplicateNames` surfaces production name collisions instead of silently overwriting | unit | `npx vitest run scripts/exercise-import/lib/matcher.test.ts` | ✅ | ⬜ pending |
| 02-04-02 | 04 | 3 | IMPORT-02 | T-02-10 | Matcher fixture suite covering Tier 1/2/3 decision boundaries | unit | `npx vitest run scripts/exercise-import/lib/matcher.test.ts` | ✅ | ⬜ pending |
| 02-05-01 | 05 | 4 | IMPORT-02 | — | Report assembly, decision merge, Markdown rendering | unit | `npx vitest run scripts/exercise-import/lib/report.test.ts` | ✅ | ⬜ pending |
| 02-05-02 | 05 | 4 | IMPORT-02 | — | Report module fixture suite (report shape stability) | unit | `npx vitest run scripts/exercise-import/lib/report.test.ts` | ✅ | ⬜ pending |
| 02-05-03 | 05 | 4 | IMPORT-02 | T-02-02 | `match.ts` entrypoint; zero-write grep gate (`insert/update/upsert/delete/rpc/storage` absent, `coach_exercises` absent) | unit + static | `npx vitest run scripts/exercise-import && …zero-write grep gate` | ✅ | ⬜ pending |
| 02-06-01 | 06 | 5 | IMPORT-01/02 | — | First real dry run + structural report check | integration | `npx tsx scripts/exercise-import/lib/check-report.ts` | ✅ | ⬜ pending |
| 02-06-02 | 06 | 5 | IMPORT-02 | — | Tier 2 threshold tuning iteration (run → inspect → adjust named constant → re-run) | unit | `npx vitest run scripts/exercise-import` | ✅ | ⬜ pending |
| 02-06-03 | 06 | 5 | IMPORT-01/02 | — | Human review and approval of the match report | checkpoint | — (blocking human verify; preceded by 02-06-01/02 automated gates) | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Note on 02-03-02 (`fetch.ts`):** its `<automated>` gate is intentionally static/grep-only and never
executes `fetch.ts`. Executing the entrypoint in a clean environment would trigger a real ~128MB
`git clone` against GitHub — unacceptable latency and an external dependency inside a fast
code-correctness gate. All of `fetch.ts`'s logic lives in `lib/verify.ts`, which is fully unit-tested
by 02-03-01. The full end-to-end run is covered by the Manual-Only Verifications below and by
02-06-01.

**Sampling continuity:** the only two tasks without an `<automated>` command are the two blocking
human checkpoints (02-01-01, 02-06-03). Neither is adjacent to the other, and each is immediately
preceded or followed by an automated gate — so there is never a run of 3 consecutive tasks without
automated feedback.

---

## Wave 0 Requirements

All Wave-0 scaffolding is delivered by **plan 02-01 (wave 1)**, which every later plan depends on.

- [x] Test-runner home decided: minimal root-level `vitest.config.ts` scoped to `scripts/exercise-import/**/*.test.ts` (02-01 Task 2)
- [x] `scripts/exercise-import/lib/normalize.test.ts` — covered by 02-02 Task 2 (accents, "3/4", punctuation) — supports IMPORT-02 Tier 1/2
- [x] Matcher tests — covered by 02-04 Tasks 1 & 2 as `lib/matcher.test.ts` (Tier 1/2/3 decision logic against fixtures); report-shape output split into `lib/report.test.ts` (02-05 Tasks 1 & 2) — supports IMPORT-02
- [x] Dataset verification tests — covered by 02-03 Task 1 as `lib/verify.test.ts` (manifest/file-count verification against `mkdtemp` fixture trees, not a real network clone) — supports IMPORT-01
- [x] Framework install: root-level `vitest` + `fastest-levenshtein` added by 02-01 Task 2, gated behind the 02-01 Task 1 package-legitimacy checkpoint

*Deviation from the draft: the draft named `match.test.ts` and `fetch.test.ts` at the script level.
Planning moved the tested logic into `lib/` modules (`lib/matcher.test.ts`, `lib/report.test.ts`,
`lib/verify.test.ts`) so the entrypoints stay thin and untested — same coverage, better testability.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full end-to-end fetch + match run against real production data and the real upstream dataset | IMPORT-01, IMPORT-02 | Unit tests use fixtures/mocks by design (no live network clone, no live DB calls in CI); real-data behavior (actual match/ambiguous/unmatched volumes) can only be observed by actually running the scripts | Run `npx tsx scripts/exercise-import/fetch.ts` then `npx tsx --env-file=backend/api/.env.local scripts/exercise-import/match.ts`, inspect the generated match report, confirm zero Supabase writes occurred (dry-run only). Formalized as plan 02-06 Tasks 1-3. |
| Zero-DB-write guarantee under real credentials | IMPORT-02 (roadmap SC #4) | Requires running against a real Supabase project with real credentials to be a meaningful guarantee — a unit test can only prove the code path never calls an insert/update/delete function, not that no write occurred against a live database | After a real run, confirm via Supabase dashboard/SQL that `exercises`, `exercise_import_log`, and `coach_exercises` row counts are unchanged from before the run. Backed by the static zero-write grep gate in 02-05 Task 3. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — every `type="auto"` task carries an `<automated>` command; the only exceptions are the two blocking human checkpoints (02-01-01, 02-06-03)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — verified across all 5 waves (see note above)
- [x] Wave 0 covers all MISSING references — plan 02-01 creates the root `vitest.config.ts` and installs deps before any `*.test.ts` gate runs; no task references a `MISSING` test file
- [x] No watch-mode flags — every command uses `vitest run` (no `--watch`, no bare `vitest`); grep-verified across all six PLAN.md files
- [x] Feedback latency < 5s — pure-function unit tests over fixtures and `mkdtemp` trees; no network clone or live DB call in any automated gate (02-03-02's gate is static/grep-only for exactly this reason)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (2026-08-15, reconciled against final PLAN.md task IDs during phase-02 plan revision)
