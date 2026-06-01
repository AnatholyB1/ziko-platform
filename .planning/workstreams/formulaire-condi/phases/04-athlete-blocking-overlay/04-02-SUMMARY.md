---
phase: 4
plan: "04-02"
subsystem: "formulaire-condi / mobile form components"
tags: [react-native, forms, animated, ui-components]
dependency_graph:
  requires: ["04-01"]
  provides: ["04-03"]
  affects: ["apps/mobile/src/components/forms/"]
tech_stack:
  added: []
  patterns:
    - "Animated.sequence press feedback (scale dip + spring rebound)"
    - "Animated.timing with useNativeDriver:false for width interpolation (progress bar)"
    - "flexGrow:1 layout for equal-width scale buttons"
    - "Named exports only — no default exports"
    - "inline style objects — zero StyleSheet"
key_files:
  created:
    - apps/mobile/src/components/forms/QuestionFreeText.tsx
    - apps/mobile/src/components/forms/QuestionScale.tsx
    - apps/mobile/src/components/forms/QuestionYesNo.tsx
    - apps/mobile/src/components/forms/QuestionSingleChoice.tsx
    - apps/mobile/src/components/forms/FormQuestion.tsx
    - apps/mobile/src/components/forms/FormProgressBar.tsx
    - apps/mobile/src/components/forms/SubmitButton.tsx
  modified: []
decisions:
  - "QuestionSingleChoice initializes choiceScaleAnims from choices at render time; if choices array changes identity, anims reset — acceptable for static form definitions"
  - "FormQuestion renders question.label inside the router (above the renderer) rather than inside each renderer to avoid duplication"
  - "SubmitButton uses opacity on the TouchableOpacity style rather than a wrapper View to match the 3-state spec exactly"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-28"
  tasks_completed: 2
  files_created: 7
  files_modified: 0
---

# Phase 4 Plan 02: Form Sub-Components Summary

**One-liner:** 7 pure presentational form components — 4 question type renderers, 1 type router, animated progress bar, and 3-state submit button — all using react-native Animated API, no external libraries, no StyleSheet.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create 4 question type renderers | 5e210fb | QuestionFreeText, QuestionScale, QuestionYesNo, QuestionSingleChoice |
| 2 | Create FormQuestion router, FormProgressBar, SubmitButton | a196508 | FormQuestion, FormProgressBar, SubmitButton |

---

## What Was Built

### Task 1 — 4 Question Renderers

**QuestionFreeText** (`QuestionFreeText.tsx`)
- Multiline `TextInput` with `placeholder="Écris ta réponse ici…"`, `minHeight: 148`, `borderRadius: 12`
- Live character counter: `{value.length} / 500 caractères`
- Type badge "Texte libre" with `#F0EFE9` background

**QuestionScale** (`QuestionScale.tsx`)
- 10 `TouchableOpacity` buttons in a `flexRow` with `flexGrow: 1` and `gap: 3`
- Selected button: `backgroundColor: theme.primary`, orange shadow (`shadowColor: '#FF5C1A'`, `elevation: 4`)
- Press animation: `Animated.sequence` — scale to 1.08 (80ms timing) then spring back to 1.0
- Endpoint labels: "Pas du tout" (left) / "Totalement" (right)
- Zero external libraries — react-native primitives only

**QuestionYesNo** (`QuestionYesNo.tsx`)
- Two full-width stacked option cards (`height: 80, borderRadius: 14`)
- Selected card: `rgba(255,92,26,0.08)` bg + `2px borderColor: theme.primary`
- Radio dot: 22×22, selected = orange fill + 8×8 white inner dot
- Checkmark `✓` renders on selected card (marginLeft: 'auto')
- Press animation: scale dip to 0.97 then spring rebound

**QuestionSingleChoice** (`QuestionSingleChoice.tsx`)
- Maps `question.choices` to option cards (`height: 64, borderRadius: 12`)
- Same radio visual pattern as QuestionYesNo
- Empty guard: renders "Aucune option" when choices array is empty/undefined

### Task 2 — Router + Utility Components

**FormQuestion** (`FormQuestion.tsx`)
- Renders "Question {index + 1} / {total}" label
- `switch` on `question.type` → delegates to correct renderer
- Type-safe value casting for each case (string/number/yes|no/string)
- Default case renders "Type de question inconnu"

**FormProgressBar** (`FormProgressBar.tsx`)
- `TRACK_WIDTH = 350` constant
- `Animated.timing` with `useNativeDriver: false` (required for width layout animation)
- `progressAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 350] })` drives fill width
- `useEffect` triggers on `current` or `total` changes

**SubmitButton** (`SubmitButton.tsx`)
- 3 opacity states: `0.4` (disabled), `0.7` (loading), `1.0` (active)
- Loading state: `<ActivityIndicator size="small" color="#FFFFFF" />` + "Envoi en cours…"
- Press animation: `handlePressIn` (timing 0.97, 100ms) + `handlePressOut` (spring to 1.0)
- Hint text "Toutes les réponses sont requises" shown only when `isDisabled && !isLoading`

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None — all components are pure presentational with correct prop contracts. No hardcoded data, no placeholders. They will be wired in Plan 04-03 (PendingFormsOverlay assembly).

---

## Threat Flags

No new security surface introduced — all components are purely presentational (no API calls, no auth, no network I/O).

---

## Self-Check: PASSED

- All 7 files exist at `apps/mobile/src/components/forms/`
- Commit `5e210fb` found: feat(04-02) — 4 question renderers
- Commit `a196508` found: feat(04-02) — FormQuestion, FormProgressBar, SubmitButton
- TypeScript: 0 errors in all 7 form component files
- `flexGrow` in QuestionScale: 1 occurrence (confirmed)
- No slider/Slider library in QuestionScale: 0 occurrences (confirmed)
- `ActivityIndicator` in SubmitButton: 2 occurrences (import + JSX) (confirmed)
- `useNativeDriver: false` in FormProgressBar: 1 occurrence (confirmed)
