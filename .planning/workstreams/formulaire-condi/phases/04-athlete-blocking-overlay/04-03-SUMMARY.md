---
phase: 4
plan: "04-03"
subsystem: mobile/overlay
tags: [mobile, forms, overlay, submit, ux]
dependency_graph:
  requires: ["04-01", "04-02"]
  provides: ["MOBILE-04", "MOBILE-05"]
  affects: ["apps/mobile/src/components/PendingFormsOverlay.tsx"]
tech_stack:
  added: []
  patterns:
    - KeyboardAvoidingView + ScrollView for form questions
    - Animated.timing fade-out dismiss (D-08)
    - showAlert from @ziko/plugin-sdk for error dialogs
    - Per-type answer validation (text/scale/yes_no/choice)
    - useEffect reset pattern on currentFormIndex change
key_files:
  created: []
  modified:
    - apps/mobile/src/components/PendingFormsOverlay.tsx
decisions:
  - "FormQuestion component imported as FormQuestionRenderer alias to avoid name collision with FormQuestion type from forms/types.ts"
  - "onChange callback in questions map filters null values before calling setAnswer (type safety)"
  - "Pre-existing TS2307 plugin module errors are out of scope — only PendingFormsOverlay errors were 0"
metrics:
  duration: "15 min"
  completed: "2026-05-28"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
---

# Phase 4 Plan 03: Complete PendingFormsOverlay (entry header + question view + submit flow) Summary

**One-liner:** Full blocking overlay with S1 entry header, question ScrollView (FormProgressBar + FormQuestion + SubmitButton), sequential advance (D-07), showAlert error handling (D-06), and Animated.timing fade-out dismiss on last form (D-08).

---

## What Was Built

`PendingFormsOverlay.tsx` fully replaces the placeholder shell from Plan 04-01 with the complete athlete-facing form experience:

### Task 1: Entry header view (S1/S4)
- Counter pill "Formulaire N / N" — index 0 uses `#F0EFE9`/muted, index > 0 uses `rgba(255,92,26,0.15)`/primary (S4 advance spec)
- Absolute lock icon pill (top-right, `accessibilityLabel="Formulaire obligatoire"`)
- 72×72 form icon block (primary background, clipboard-outline icon)
- Form title, question count badge, body copy "Ton coach a besoin de tes réponses\navant de continuer."
- Divider + "Ce formulaire contient :" section with deduplicated icon rows per question type (Set dedup)
- Absolute CTA "Remplir le formulaire" → `setFormView('questions')`
- New state: `answers`, `isSubmitting`, `setAnswer` helper, `answeredCount`, `isAllAnswered`
- `useEffect` on `currentFormIndex`: resets `answers({})` and `setFormView('header')`

### Task 2: Question ScrollView + submit flow
- `KeyboardAvoidingView` (behavior: `'padding'` iOS / `'height'` Android)
- Counter pill repeated at top (same conditional styling)
- `ScrollView` with `FormProgressBar` (current=answeredCount, total=question_count)
- `FormQuestionRenderer` (alias for `FormQuestion` component to avoid type collision) per question with answer binding
- Absolute `SubmitButton` at bottom: `label="Valider le formulaire"`, `isAllAnswered`, `isLoading={isSubmitting}`
- `handleSubmit`: POST to `/athlete/forms/${instance_id}/submit` with Bearer token + answers array
  - D-06: `showAlert('Erreur', ...)` with Réessayer/Annuler on failure
  - D-07: `setCurrentFormIndex(i => i + 1)` for non-last form
  - D-08: `dismissOverlay()` on last form (Animated.timing 300ms fade → setLocalForms([]))

---

## Verification Results

| Check | Expected | Result |
|-------|----------|--------|
| TS errors in PendingFormsOverlay | 0 | 0 |
| `Alert.alert` calls | 0 | 0 |
| `StyleSheet` imports | 0 | 0 |
| `Réessayer` | ≥1 | 1 |
| `dismissOverlay` | ≥2 | 2 |
| `Valider le formulaire` | ≥1 | 1 |
| `Remplir le formulaire` | ≥1 | 1 |
| `setCurrentFormIndex` | ≥1 | 4 |
| `handleSubmit` | ≥1 | 3 |
| `FormProgressBar` | ≥1 | 2 |
| `SubmitButton` | ≥1 | 2 |
| `KeyboardAvoidingView` | ≥1 | 3 |

Pre-existing TS2307 errors (11 plugin module imports across unrelated files) — out of scope for this plan.

---

## Deviations from Plan

### Auto-resolved Issues

**1. [Rule 1 - Bug] Name collision: FormQuestion type vs FormQuestion component**
- **Found during:** Task 1 — both `forms/types.ts` and `forms/FormQuestion.tsx` export a symbol named `FormQuestion`
- **Issue:** Importing both would cause a TypeScript name collision
- **Fix:** Imported component as `FormQuestionRenderer`: `import { FormQuestion as FormQuestionRenderer } from './forms/FormQuestion'`
- **Files modified:** `PendingFormsOverlay.tsx`
- **Commit:** 95c3899

**2. [Rule 2 - Correctness] onChange null guard**
- **Found during:** Task 2 — `FormQuestion` component's `onChange` callback type accepts `QuestionValue` (string | number | null), but `setAnswer` only accepts `string | number`
- **Fix:** Added null guard in onChange: `if (v !== null) { setAnswer(q.id, v); }`
- **Files modified:** `PendingFormsOverlay.tsx`
- **Commit:** 95c3899

---

## Known Stubs

None — all data flows from `currentForm` (live TanStack Query result), all answers bound to real state.

---

## Threat Flags

None — no new network endpoints or auth paths introduced beyond those specified in the plan's threat model.

---

## Self-Check: PASSED

- `apps/mobile/src/components/PendingFormsOverlay.tsx` — EXISTS
- Commit `95c3899` — EXISTS (`git log --oneline | grep 95c3899`)
