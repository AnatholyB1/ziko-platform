---
phase: 02
slug: download-match-dry-run
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-15
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.4 (`backend/api/package.json` — the only test framework configured anywhere in the monorepo; root has no test runner) |
| **Config file** | none — Wave 0 installs (root has no test runner configured; needs a minimal root-level `vitest.config.ts` scoped to `scripts/`, or tests colocated under `backend/api/test/` — planner's call) |
| **Quick run command** | `npx vitest run scripts/exercise-import/*.test.ts` (once created in Wave 0) |
| **Full suite command** | `npx vitest run scripts/exercise-import/*.test.ts` (no separate full-suite distinct from this phase's own tests — root has no monorepo-wide test aggregation) |
| **Estimated runtime** | ~5 seconds (pure-function unit tests against fixtures, no network/DB calls) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run scripts/exercise-import/*.test.ts`
- **After every plan wave:** Run `npx vitest run scripts/exercise-import/*.test.ts`
- **Before `/gsd:verify-work`:** A full manual `fetch.ts` + `match.ts` run against real data, with human inspection of the match report, in addition to the automated suite being green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-0X | 01 | 0 | IMPORT-01/02 | — | Wave 0 test scaffolding | unit | `npx vitest run scripts/exercise-import/*.test.ts` | ❌ W0 | ⬜ pending |
| 02-0X-0X | TBD | 1+ | IMPORT-01 | T-02-01 | Fetch clones dataset, verifies file count against manifest-equivalent, fails loudly on mismatch | unit | `npx vitest run scripts/exercise-import/fetch.test.ts` | ❌ W0 | ⬜ pending |
| 02-0X-0X | TBD | 1+ | IMPORT-02 | T-02-02 | 3-tier matcher categorizes every dataset exercise correctly; zero DB writes; excludes `is_custom=true` and `coach_exercises` | unit | `npx vitest run scripts/exercise-import/match.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Planner assigns final task IDs — this map will be reconciled against actual PLAN.md task IDs during planning.*

---

## Wave 0 Requirements

- [ ] Decide test-runner home: minimal root-level `vitest.config.ts` scoped to `scripts/`, or colocate under `backend/api/test/` (root `package.json` currently has zero test runner configured)
- [ ] `scripts/exercise-import/lib/normalize.test.ts` — stubs for normalization edge cases (accents, "3/4", punctuation) — supports IMPORT-02's Tier 1/2 matching
- [ ] `scripts/exercise-import/match.test.ts` — stubs for Tier 1/2/3 decision logic and report-shape output against fixtures — supports IMPORT-02
- [ ] `scripts/exercise-import/fetch.test.ts` — stubs for manifest/file-count verification against a mocked/fixture directory tree (not a real network clone) — supports IMPORT-01
- [ ] Framework install: `vitest` is already a `backend/api` devDependency; if tests are placed outside `backend/api`, a root-level `vitest` + `@vitest/coverage-v8` devDependency addition is needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full end-to-end fetch + match run against real production data and the real upstream dataset | IMPORT-01, IMPORT-02 | Unit tests use fixtures/mocks by design (no live network clone, no live DB writes even for reads in CI); real-data behavior (actual match/ambiguous/unmatched volumes) can only be observed by actually running the scripts | Run `tsx scripts/exercise-import/fetch.ts` then `tsx scripts/exercise-import/match.ts`, inspect the generated match report, confirm zero Supabase writes occurred (dry-run only) |
| Zero-DB-write guarantee under real credentials | IMPORT-02 (roadmap SC #4) | Requires running against a real Supabase project with real credentials to be a meaningful guarantee — a unit test can only prove the code path never calls an insert/update/delete function, not that no write occurred against a live database | After a real run, confirm via Supabase dashboard/SQL that `exercises`, `exercise_import_log`, and `coach_exercises` row counts are unchanged from before the run |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
