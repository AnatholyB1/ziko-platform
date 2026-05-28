# Phase 1: Wizard Integration — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 01-Wizard Integration
**Areas discussed:** Step 4 placeholder scope, Progress indicator style, Returning coach guard

---

## Step 4 Placeholder Scope

### Q1: What should WizardStep4Import contain in Phase 1?

| Option | Description | Selected |
|--------|-------------|----------|
| Functional shell | Correct layout frame, placeholder heading, working skip button → dashboard | ✓ |
| Minimal placeholder | `<div>` with comment — wizard dead-ends during testing | |

**User's choice:** Functional shell

---

### Q2: Where does WizardStep4Import live?

| Option | Description | Selected |
|--------|-------------|----------|
| New file (Recommended) | `src/components/coach/WizardStep4Import.tsx` — consistent with other steps | ✓ |
| Inline in OnboardingWizard | Quick definition inside OnboardingWizard.tsx | |

**User's choice:** New file

---

### Q3: Props in Phase 1?

| Option | Description | Selected |
|--------|-------------|----------|
| Full interface, only onSkip wired (Recommended) | Define userId/apiUrl/jwt/onSkip/onSuccess — only wire onSkip in Phase 1 | ✓ |
| No props yet | Add props in Phase 2 when needed | |

**User's choice:** Full interface defined, only onSkip wired

---

## Progress Indicator Style

### Q1: Keep progress bar or switch to named step dots?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep progress bar (Recommended) | Zero changes to WizardProgress.tsx — pass totalSteps={4} | ✓ |
| Named step dots | Dot indicators with labels: Role / Profil / KYC / Import | |

**User's choice:** Keep progress bar

---

### Q2: Is "Étape 4 / 4 = 100%" acceptable?

| Option | Description | Selected |
|--------|-------------|----------|
| Acceptable (Recommended) | 100% on the final step is fine — no i18n changes needed | ✓ |
| Cap at 75% | Progress override prop — adds complexity | |

**User's choice:** Acceptable

---

## Returning Coach Guard

### Q1: Should step=4 redirect coaches to dashboard?

| Option | Description | Selected |
|--------|-------------|----------|
| Allow coaches through step 4 (Recommended) | Guard only blocks step 1 — step 4 always accessible | ✓ |
| Block coaches from all steps | Redirect to dashboard for any step | |

**User's choice:** Allow coaches through step 4

---

### Q2: Non-coach visiting step=4?

| Option | Description | Selected |
|--------|-------------|----------|
| Allow — guard handles auth (Recommended) | Existing auth check (redirect to /login) is sufficient | ✓ |
| Restrict to coaches only | Add step===4 && role!=='coach' redirect | |

**User's choice:** Allow — existing auth sufficient

---

## Claude's Discretion

- Exact placeholder body text inside WizardStep4Import (beyond heading and skip button)

## Deferred Ideas

None.
