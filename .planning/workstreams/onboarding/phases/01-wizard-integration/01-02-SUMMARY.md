---
plan: 01-02
phase: 01-wizard-integration
status: complete
completed: 2026-05-30
---

# Summary — Plan 01-02: Wire WizardStep4Import into OnboardingWizard

## What Was Built

Made 4 targeted edits to `OnboardingWizard.tsx` to complete the 4-step wizard shell:

1. **Import** — added `import { WizardStep4Import } from '@/components/coach/WizardStep4Import'`
2. **Step clamp** — `Math.min(3, ...)` → `Math.min(4, ...)` so `?step=4` is valid
3. **Progress bar** — `totalSteps={3}` → `totalSteps={4}` 
4. **Step 3 onSuccess** — `router.push(dashboard)` → `goToStep(4)` so KYC completion goes to Step 4
5. **Step 4 mount** — `{step === 4 && <WizardStep4Import userId apiUrl jwt onSuccess onSkip />}` block added

## Key Files

### Modified
- `apps/web/src/app/[locale]/coach/onboarding/OnboardingWizard.tsx` — 4-step wizard, Step 4 mounted, KYC routes to Step 4

## Requirements Covered

- WIZARD-01: progress bar now shows 4 steps ✓
- WIZARD-02: completing KYC (Step 3) navigates to Step 4 instead of dashboard ✓
- WIZARD-03: `OnboardingWizard` mounts `WizardStep4Import` when `step === 4` ✓

## Deviations

None. All 4 changes exactly match the plan spec.

## Self-Check: PASSED

- ✓ Import `WizardStep4Import` from `@/components/coach/WizardStep4Import` present
- ✓ `Math.min(4, ...)` in step clamp
- ✓ `<WizardProgress currentStep={step} totalSteps={4} />`
- ✓ WizardStep3Kyc block contains `onSuccess={() => goToStep(4)}`
- ✓ WizardStep3Kyc block still contains `onSkip={() => router.push(...)` to dashboard
- ✓ `{step === 4 && (` block present with WizardStep4Import receiving userId, apiUrl, jwt, onSuccess, onSkip
- ✓ Steps 1, 2, 3 blocks unchanged
- ✓ TypeScript: zero new errors
