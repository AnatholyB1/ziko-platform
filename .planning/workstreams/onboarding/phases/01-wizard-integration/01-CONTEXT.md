# Phase 1: Wizard Integration — Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire a 4th step into the existing 3-step wizard shell. Three mechanical changes to `OnboardingWizard.tsx` + one new component file (`WizardStep4Import`). No backend changes. No changes to `WizardProgress.tsx`.

</domain>

<decisions>
## Implementation Decisions

### WizardStep4Import — Placeholder Scope
- **D-01:** Functional shell, not a minimal `<div>`. Contains: correct layout container (`max-w-lg w-full mx-auto py-12 px-4`), a placeholder heading ("Importer vos documents"), and a working "Ignorer pour l'instant" button that redirects to `/coach/dashboard`. Phase 2 fills in the upload UI.
- **D-02:** Lives in a new file: `apps/web/src/components/coach/WizardStep4Import.tsx` — consistent with `WizardStep1Role`, `WizardStep2Profile`, `WizardStep3Kyc` pattern. Phases 2–4 fill it in without touching `OnboardingWizard.tsx`.
- **D-03:** Full prop interface defined upfront (`userId: string`, `apiUrl: string`, `jwt: string`, `onSkip: () => void`, `onSuccess: () => void`) but only `onSkip` is wired in Phase 1. Remaining props used starting Phase 2.

### Progress Indicator
- **D-04:** No changes to `WizardProgress.tsx`. Pass `totalSteps={4}` — the component already supports any total. Keep progress bar + "Étape X / 4" text. "Étape 4 / 4 = 100%" when on step 4 is acceptable.

### Coach Guard & Step Clamping
- **D-05:** Existing coach guard only redirects on `step === 1` (role already set). Step 4 remains accessible to coaches who revisit — intentional. No additional guard for step 4.
- **D-06:** No additional guard for non-coaches visiting `?step=4`. Existing auth check (redirect to `/login` if no session) is sufficient. Keep it simple.
- **D-07:** Step clamping: change `Math.min(3, ...)` → `Math.min(4, ...)` in `OnboardingWizard.tsx` line 17.

### Claude's Discretion
- Exact placeholder text inside `WizardStep4Import` body (beyond heading and skip button) — Claude's call, keep it minimal.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/workstreams/onboarding/REQUIREMENTS.md` — WIZARD-01, WIZARD-02, WIZARD-03 are the exact acceptance criteria for Phase 1

### Project Context
- `.planning/workstreams/onboarding/PROJECT.md` — Existing wizard structure, Phase 28 backend context, key decisions

### Files to Modify
- `apps/web/src/app/[locale]/coach/onboarding/OnboardingWizard.tsx` — 3 changes: step clamp (→4), totalSteps prop (→4), WizardStep3Kyc.onSuccess (→step 4)

### Files to Create
- `apps/web/src/components/coach/WizardStep4Import.tsx` — new component, functional shell

### Files to Read (no changes)
- `apps/web/src/components/coach/WizardProgress.tsx` — verify totalSteps={4} works as-is (it does)
- `apps/web/src/components/coach/WizardStep3Kyc.tsx` — understand onSuccess/onSkip prop signature before modifying the caller

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WizardProgress` — generic, already accepts `totalSteps` as prop. Zero changes needed. Just call with `totalSteps={4}`.
- `goToStep(n)` helper in `OnboardingWizard.tsx` — reuse for `onSuccess={() => goToStep(4)}` in Step 3 and `onSkip` navigation in Step 4.
- `useRouter` / `useLocale` already imported — available for `WizardStep4Import`'s skip redirect.

### Established Patterns
- Step components receive: `userId`, `apiUrl`, `jwt`, `onSuccess`, `onSkip` props — follow this exact interface.
- Layout: `max-w-lg w-full mx-auto py-12 px-4` — must match other step components.
- Auth check: `supabase.auth.getSession()` in `useEffect` — already handled by `OnboardingWizard`, no need to repeat in step component.
- Coach guard: `if (p?.role === 'coach' || p?.role === 'both') { if (step === 1) router.push(...) }` — guard checks `step === 1` only, step 4 is unaffected.

### Integration Points
- `WizardStep3Kyc` `onSuccess` callback (line 89 of `OnboardingWizard.tsx`): change `router.push(/${locale}/coach/dashboard)` → `goToStep(4)`.
- New `{step === 4 && <WizardStep4Import ... />}` block added after the existing step 3 block.
- Step clamp line 17: `Math.min(3, ...)` → `Math.min(4, ...)`.

</code_context>

<specifics>
## Specific Ideas

- The skip button label is "Ignorer pour l'instant" — confirmed during discussion (matches COMPLETE-01 wording in REQUIREMENTS.md).
- The `WizardStep4Import` shell uses the same container class as the parent `OnboardingWizard` div — `max-w-lg w-full mx-auto py-12 px-4` (though the parent already applies this, the step component should be self-contained like others).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-Wizard Integration*
*Context gathered: 2026-05-29*
