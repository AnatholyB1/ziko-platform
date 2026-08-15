---
phase: 3
slug: merge-human-approved-write
status: draft
nyquist_compliant: false
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
| 03-xx-xx | TBD | 0 | IMPORT-03 | — | UPDATE preserves UUID; INSERT creates new row; never DELETE | unit | `npx vitest run scripts/exercise-import/lib/merge.test.ts` | ❌ W0 | ⬜ pending |
| 03-xx-xx | TBD | 0 | IMPORT-04 | — | Resume state computed correctly from `exercise_import_log` (`error_message` semantics, `DISTINCT ON` reduction) | unit | `npx vitest run scripts/exercise-import/lib/import-log.test.ts` | ❌ W0 | ⬜ pending |
| 03-xx-xx | TBD | 0 | IMPORT-05 | — | `unmatched_legacy`/`ambiguous` rows never touch `exercises`, always log `needs_review` | unit | `npx vitest run scripts/exercise-import/lib/merge.test.ts` | ❌ W0 | ⬜ pending |
| 03-xx-xx | TBD | 0 | MEDIA-03 | — | `capImage`/`capGif` never exceed 180×180, never upscale | unit (fixture images: <180px, exactly 180px, >180px sources) | `npx vitest run scripts/exercise-import/lib/media.test.ts` | ❌ W0 | ⬜ pending |
| 03-xx-xx | TBD | 0 | MEDIA-04 | — | Backup row inserted with all columns matching pre-UPDATE row, before the UPDATE | unit (call-order assertion against stubbed client) | `npx vitest run scripts/exercise-import/lib/merge.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs filled in once the planner assigns concrete plan/task numbers.*

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

**Approval:** pending
