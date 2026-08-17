---
phase: 4
slug: review-commit
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-12
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.4 + @testing-library/react 16.0.0 + @testing-library/user-event 14.5.2 |
| **Config file** | `apps/web/vitest.config.ts` (environment: `happy-dom` for `.test.tsx` via `environmentMatchGlobs`) |
| **Quick run command** | `npx vitest run src/components/coach/WizardStep4Import.test.tsx` (from `apps/web/`) |
| **Full suite command** | `npm run test` (from `apps/web/`, runs `vitest run --passWithNoTests`) |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/components/coach/WizardStep4Import.test.tsx`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-T1 | 04-01 | 0 | (infra) | T-04-SC | RTL `render`/`screen` resolve; no new package enters apps/web/package.json | infra | `npx vitest run src/components/coach/vocal/VocalReview.test.tsx` | N/A | pending |
| 04-01-T2 | 04-01 | 0 | REVIEW-01/02/03, COMPLETE-02 | T-04-01 | 9 i18n keys exist in fr+en with ICU plural and key parity | unit (node assert) | inline node script in 04-01-PLAN Task 2 | N/A | pending |
| 04-02-T1 | 04-02 | 1 | REVIEW-01 | - | Review screen renders all ready fileStates entries (both docTypes) in one consolidated list | unit (RTL render) | `vitest run -t "consolidated review list"` | 04-02 | pending |
| 04-02-T1 | 04-02 | 1 | REVIEW-02 | T-04-08 | Pill toggle changes a row's docType; live count updates immediately | unit (RTL + fireEvent) | `vitest run -t "type correction updates count"` | 04-02 | pending |
| 04-02-T1 | 04-02 | 1 | COMPLETE-01 | - | "Ignorer pour l'instant" on review screen calls onSkip without any /commit fetch | unit (RTL + fireEvent) | `vitest run -t "skip on review screen"` | 04-02 | pending |
| 04-02-T2 | 04-02 | 1 | REVIEW-03 | T-04-03, T-04-04 | Confirm fires PUT /:id/commit only for template_programme docs, in parallel, with full parsed_data body and Bearer jwt | unit (stubbed fetch, deferred responses) | `vitest run -t "parallel commit fires only for template docs"` | 04-02 | pending |
| 04-02-T2 | 04-02 | 1 | COMPLETE-02 | - | Success message renders, then onSuccess fires at exactly 1500ms (not 1400ms) | unit (fake timers) | `vitest run -t "auto-redirect after commit"` | 04-02 | pending |
| 04-02-T2 | 04-02 | 1 | (D-09) | T-04-05, T-04-07 | Failed doc shows scoped retry; retry re-fires only that doc, sibling commit count unchanged | unit (per-id commit handlers) | `vitest run -t "per-doc retry isolation"` | 04-02 | pending |
| 04-03-T1 | 04-03 | 1 | REVIEW-03 | T-04-04 | Full parsed_data persisted on FileState in all four ready branches | source assertion + tsc | `grep -c "parsedData: rawParsedData" ...` == 4 | N/A | pending |
| 04-03-T2 | 04-03 | 1 | REVIEW-03, COMPLETE-02 | T-04-05, T-04-06 | commitDoc never throws; 409-with-program_id = success; 1500ms completion effect | source assertion + tsc | `npx tsc --noEmit` clean for WizardStep4Import.tsx | N/A | pending |
| 04-04-T1 | 04-04 | 2 | REVIEW-01, REVIEW-02, COMPLETE-01 | T-04-08 | Review editing view renders and the three render-level tests go green | unit (RTL) | `vitest run src/components/coach/WizardStep4Import.test.tsx -t "consolidated review list"` (+2) | 04-02 | pending |
| 04-04-T2 | 04-04 | 2 | REVIEW-03, COMPLETE-02 | T-04-05, T-04-07 | Committing/done states + scoped retry; full suite green | unit (RTL) | `npm run test` (from apps/web) | 04-02 | pending |

**Phase gate:** `cd apps/web && npm run test` exits 0 with 7 test files passing.

*Task ID / Plan / Wave columns filled in by the planner on 2026-08-12.*

---

## Wave 0 Requirements

- [ ] `apps/web/src/components/coach/WizardStep4Import.test.tsx` — new file, stubs for REVIEW-01, REVIEW-02, REVIEW-03, COMPLETE-01, COMPLETE-02, and D-09 retry isolation. No existing test file for this component. **Owned by plan 04-02.**
- [x] ~~No framework install needed — Vitest, RTL, and happy-dom already devDependencies.~~ **CORRECTED during planning (2026-08-12):** `@testing-library/dom` is declared in `apps/web/package.json` devDependencies but is NOT installed in `node_modules`. `VocalReview.test.tsx` currently fails at module load with `Cannot find module '@testing-library/dom'`, and any new `.test.tsx` calling `render()` would fail identically. **Plan 04-01 Task 1 repairs this before the test file is written.**

---

## Manual-Only Verifications

*None — all phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
