---
phase: 3
slug: merge-human-approved-write
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-15
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.7 (root `vitest.config.ts`, already scoped to `scripts/exercise-import/**/*.test.ts`) |
| **Config file** | `vitest.config.ts` (repo root) |
| **Quick run command** | `npm run test:import` |
| **Full suite command** | `npm run test:import` (same — this pipeline has no separate integration-test tier) |
| **Estimated runtime** | ~10 seconds (pure-function unit tests only, no network/DB) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:import`
- **After every plan wave:** Run `npm run test:import`
- **Before `/gsd:verify-work`:** Full suite must be green, **plus** a manually-supervised real run against the approved `match-report.json` (mirroring Phase 2's 02-06 plan) before the phase is considered functionally complete — automated tests alone cannot verify actual Supabase Storage/Postgres write behavior without live credentials
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-02-01 | 03-02 | 1 | MEDIA-03 | T-03-06 | `capImage`/`capGif` never exceed 180×180, never upscale, GIF keeps >1 page | unit (fixtures generated in-test with sharp) | `npx vitest run scripts/exercise-import/lib/media.test.ts` | ❌ W1 | ⬜ pending |
| 03-02-02 | 03-02 | 1 | MEDIA-03 (D-07) | T-03-07 | Bounded 3-attempt retry with 500/1000 ms backoff, rethrows the LAST error | unit (fake timers) | `npx vitest run scripts/exercise-import/lib/retry.test.ts` | ❌ W1 | ⬜ pending |
| 03-03-01 | 03-03 | 1 | IMPORT-03 | T-03-02, T-03-08 | Write client requires SUPABASE_SERVICE_KEY explicitly; never falls back to the publishable key | unit (hoisted vi.mock) | `npx vitest run scripts/exercise-import/lib/supabase-write-client.test.ts` | ❌ W1 | ⬜ pending |
| 03-03-02 | 03-03 | 1 | IMPORT-04 | T-03-09 | Resume state from `error_message` over the latest log row per `source_id`; order-independent; no invented `'error'` status | unit | `npx vitest run scripts/exercise-import/lib/import-log.test.ts` | ❌ W1 | ⬜ pending |
| 03-03-03 | 03-03 | 1 | IMPORT-03 | T-03-10 | Dataset category maps only to the six CHECK-allowed values; unmappable values reported, never coerced | unit | `npx vitest run scripts/exercise-import/lib/category.test.ts` | ❌ W1 | ⬜ pending |
| 03-04-01 | 03-04 | 2 | IMPORT-03, IMPORT-05, MEDIA-04 | T-03-11, T-03-12 | Per-row flow implemented: UUID preserved on UPDATE, no `.delete(`, no `name_fr` write, backup precedes update | source assertion + compile | `npm run test:import` | ❌ W2 | ⬜ pending |
| 03-04-02 | 03-04 | 2 | IMPORT-03, IMPORT-05, MEDIA-03, MEDIA-04 | T-03-05, T-03-06, T-03-12 | Call ORDER asserted against a recording stub; needs_review rows never touch `exercises`; only capped buffers uploaded; failures resolve, never reject | unit (stubbed client) | `npx vitest run scripts/exercise-import/lib/merge-row.test.ts` | ❌ W2 | ⬜ pending |
| 03-05-01 | 03-05 | 3 | IMPORT-03 | T-03-13, T-03-14 | Non-TTY invocation hard-exits with zero writes; report parsed strictly; `dataset_commit` equality enforced | CLI behaviour | `echo "" \| npx tsx --env-file=backend/api/.env.local scripts/exercise-import/merge.ts` exits non-zero | ❌ W3 | ⬜ pending |
| 03-05-02 | 03-05 | 3 | IMPORT-04, IMPORT-05 | T-03-09, T-03-15 | Sequential resumable loop; one `exercise_import_log` row per row per run including `skipped`; all four report categories handled | compile + source assertion | `npm run test:import` and `npx tsc --noEmit` on merge.ts | ❌ W3 | ⬜ pending |
| 03-05-03 | 03-05 | 3 | — | T-03-02 | README documents the merge-only service-role exception and the interactive-only invocation | source assertion | `grep -qi 'interactive terminal' scripts/exercise-import/README.md` | ❌ W3 | ⬜ pending |
| 03-06-01 | 03-06 | 4 | IMPORT-03 | T-03-14 | Dataset clone restored at the approved `dataset_commit`, else escalate | CLI | `git -C scripts/exercise-import/.dataset-cache/exercises-dataset rev-parse HEAD` equals report `dataset_commit` | ❌ W4 | ⬜ pending |
| 03-06-02 | 03-06 | 4 | IMPORT-03, IMPORT-04, IMPORT-05, MEDIA-03, MEDIA-04 | T-03-13 | Human-supervised interactive merge run | manual (blocking checkpoint) | none — see Manual-Only Verifications | n/a | ⬜ pending |
| 03-06-03 | 03-06 | 4 | IMPORT-03, IMPORT-04, MEDIA-03, MEDIA-04 | T-03-12 | Post-run production reconciliation: row count up not down, backup count matches UPDATE tally, sampled UUIDs preserved, sampled media ≤180×180 | CLI (PostgREST + Storage) | `curl ... Prefer: count=exact` checks recorded in `merge-run.md` | ❌ W4 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs assigned by the planner 2026-08-15. Wave 0 is folded into waves 1-2: every test file is created in the same task as the module it covers (TDD), so there is no separate scaffold wave.*

---

## Wave 0 Requirements

- [ ] `scripts/exercise-import/lib/media.test.ts` — covers MEDIA-03 (fixture images generated in-test with `sharp`, no committed binary fixtures)
- [ ] `scripts/exercise-import/lib/import-log.test.ts` — covers IMPORT-04 resume-state logic
- [ ] `scripts/exercise-import/lib/merge.test.ts` — covers IMPORT-03/IMPORT-05 row-processing ordering and needs_review routing (stubbed Supabase client, matches Phase 2's `supabase-client.test.ts` precedent)
- [ ] `scripts/exercise-import/lib/retry.test.ts` — covers D-07's bounded-retry behavior (fake timers, assert attempt count and backoff timing)
- [ ] Framework install: none — vitest already configured and scoped correctly for this directory

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real merge run against production Supabase (1,324-row approved report) | IMPORT-03, IMPORT-04, IMPORT-05, MEDIA-03, MEDIA-04 | Automated CI has no live Supabase Storage/Postgres write credentials; real-DB integration testing is out of scope per this pipeline's Phase 2 precedent (02-06's real dry-run was manual/human-supervised) | Run `merge.ts` against `.planning/workstreams/image-exo/reports/match-report.json` with real `SUPABASE_SERVICE_KEY`, confirm at the interactive prompt, verify row counts/media in Supabase dashboard afterward |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-assigned 2026-08-15
