---
plan: 01-01
phase: 01-wizard-integration
status: complete
completed: 2026-05-30
---

# Summary — Plan 01-01: WizardStep4Import Shell + i18n Keys

## What Was Built

Created `WizardStep4Import.tsx` as a new component matching `WizardStep3Kyc`'s card structure exactly — same root div classes, same prop interface (userId, apiUrl, jwt, onSuccess, onSkip), same button style. Phase 1 wires only `onSkip`; a placeholder comment marks where the Phase 2 upload UI will go.

Added 3 i18n keys to both `fr.json` and `en.json` inside the `Onboarding` namespace: `step4Heading`, `step4Subtitle`, `step4Skip`.

## Key Files

### Created
- `apps/web/src/components/coach/WizardStep4Import.tsx` — Step 4 shell component, exports `WizardStep4Import`

### Modified
- `apps/web/messages/fr.json` — added step4Heading, step4Subtitle, step4Skip keys
- `apps/web/messages/en.json` — added step4Heading, step4Subtitle, step4Skip keys

## Deviations

None. Followed plan exactly.

## Self-Check: PASSED

- ✓ `WizardStep4Import.tsx` exists and exports named function `WizardStep4Import`
- ✓ Props: userId, apiUrl, jwt (string), onSuccess and onSkip (() => void)
- ✓ Root div: `bg-white rounded-2xl p-8 border border-border shadow-sm`
- ✓ h2: `text-xl font-bold text-text mb-2`
- ✓ p: `text-sm font-normal text-muted mb-6`
- ✓ Skip button: `onClick={onSkip}`, `h-11 px-4 text-sm font-normal text-muted hover:text-text transition-colors`
- ✓ fr.json: step4Heading = "Importer vos documents", step4Skip = "Ignorer pour l'instant"
- ✓ en.json: step4Heading = "Import your documents", step4Skip = "Skip for now"
- ✓ TypeScript: pre-existing error in VocalReview.test.tsx (unrelated); new file compiles clean
