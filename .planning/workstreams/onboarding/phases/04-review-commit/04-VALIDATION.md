---
phase: 4
slug: review-commit
status: draft
nyquist_compliant: false
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
| TBD | TBD | 0 | REVIEW-01 | — | Review screen renders all fileStates entries (both docTypes) in one consolidated list | unit (RTL render) | `vitest run -t "consolidated review list"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | REVIEW-02 | — | Pill toggle changes a row's `docType`; live count updates immediately | unit (RTL render + user-event click) | `vitest run -t "type correction updates count"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | REVIEW-03 | — | Confirm click fires `PUT :id/commit` only for `template_programme`-typed docs, in parallel | unit (mocked fetch, assert call count + bodies) | `vitest run -t "parallel commit fires only for template docs"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | COMPLETE-01 | — | "Ignorer pour l'instant" on review screen calls `onSkip` without any commit fetch | unit (RTL render + user-event click) | `vitest run -t "skip on review screen"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | COMPLETE-02 | — | After all commits settle, success message renders then `onSuccess` fires after 1500ms | unit (mocked fetch, fake timers) | `vitest run -t "auto-redirect after commit"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | (D-09) | — | A doc whose commit fetch rejects shows scoped retry; retry re-fires only that doc | unit (mocked fetch — one reject, one resolve) | `vitest run -t "per-doc retry isolation"` | ❌ W0 | ⬜ pending |

*Task ID / Plan / Wave columns are filled in by the planner once PLAN.md files exist.*

---

## Wave 0 Requirements

- [ ] `apps/web/src/components/coach/WizardStep4Import.test.tsx` — new file, stubs for REVIEW-01, REVIEW-02, REVIEW-03, COMPLETE-01, COMPLETE-02, and D-09 retry isolation. No existing test file for this component.
- [ ] No framework install needed — Vitest, RTL, and happy-dom already devDependencies.

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
