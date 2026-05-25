---
phase: 36-workout-stack-redesign
plan: "02"
subsystem: mobile/workout
tags: [wizard, ai-generate, motiview, animation, cardio]
dependency_graph:
  requires: [36-01]
  provides: [ai-generate-wizard]
  affects: [apps/mobile/app/(app)/workout/ai-generate.tsx]
tech_stack:
  added: []
  patterns: [4-step wizard, MotiView pulse orb, LinearGradient loading, Promise.all min-delay]
key_files:
  modified:
    - apps/mobile/app/(app)/workout/ai-generate.tsx
decisions:
  - "Replaced variant='light' with WSHeader's dark=false default — variant prop does not exist in WSHeaderProps"
  - "Used 10-button tap grid instead of @react-native-community/slider — not installed in project"
  - "MotiView from/animate/transition defined as constants outside render to prevent loop restart"
  - "Promise.all(fetch, 1800ms delay) pattern ensures minimum loading duration regardless of API speed"
  - "isGenerating flag disables Régénérer button during generation (T-36-02-03 DoS mitigation)"
metrics:
  duration: "~25 min"
  completed: "2026-05-25"
  tasks_completed: 2
  files_modified: 1
---

# Phase 36 Plan 02: AIGenerator 4-Step Wizard Summary

**One-liner:** 4-step wizard with MotiView sparkle-orb loading, cardio zone option, and real POST /ai/tools/execute API call.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | 4-step wizard redesign (steps 0–3) | 103e1fd | apps/mobile/app/(app)/workout/ai-generate.tsx |
| 2 | MotiView loading + generated session (step 4) + API call | 103e1fd | apps/mobile/app/(app)/workout/ai-generate.tsx |

## What Was Built

`apps/mobile/app/(app)/workout/ai-generate.tsx` fully redesigned as a 4-step wizard:

- **Step 0 — Énergie:** 64pt number display + 10-button tap grid (1–10) + scale labels (Épuisé / Modéré / Au top)
- **Step 1 — Durée:** 5 vertical option cards (20/30/45/60/90 min) with tags (express/standard/complète/long)
- **Step 2 — Zone:** 4 vertical option cards with icon badge (haut/bas/full/cardio) — cardio zone added per D-05
- **Step 3 — Matériel:** 4 options in 2×2 grid (salle/maison/outdoor/hotel)
- **Loading state (`step === 'generating'`):** MotiView sparkle orb with LinearGradient `#FF5C1A → #FFB07A` pulsing animation — replaces ActivityIndicator per D-06
- **Step 4 — Generated session:** AI adaptation card + exercise list + Régénérer ghost button + Démarrer CTA
- **API call:** `POST /ai/tools/execute` with `{ tool: 'ai_programs_generate', input: { energy, duration, zone, equipment } }` — Bearer token from `useAuthStore`
- **Minimum loading:** 1800ms via `Promise.all([fetch, minDelay])` pattern
- **Progress dots:** 4 dots, orange if index ≤ current step
- **Footer:** Single button on step 0, Retour + Continuer on steps 1–2, Retour + "Générer ma séance" on step 3

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed non-existent `variant` prop from WSHeader**
- **Found during:** TypeScript check after Task 1
- **Issue:** Plan specified `WSHeader` with `variant="light"` prop, but `WSHeaderProps` interface only has `dark?: boolean`
- **Fix:** Removed `variant` prop; WSHeader defaults to `dark={false}` (light mode)
- **Files modified:** `apps/mobile/app/(app)/workout/ai-generate.tsx`
- **Commit:** 103e1fd

**2. [Rule 3 - Blocking] Slider package not available**
- **Found during:** Task 1 implementation
- **Issue:** `@react-native-community/slider` is not in `apps/mobile/package.json`
- **Fix:** Used 10 `TouchableOpacity` buttons (1–10 grid) as a functionally equivalent energy picker — no new package installed
- **Files modified:** `apps/mobile/app/(app)/workout/ai-generate.tsx`
- **Commit:** 103e1fd

**3. [Rule 1 - Bug] Removed `@ts-ignore` on WSHeader import**
- **Found during:** Post-fix review
- **Issue:** WSHeader was already created by plan 36-01 (commit `01d760e`) and exists in the codebase
- **Fix:** Removed the `@ts-ignore` comment — import is fully typed
- **Files modified:** `apps/mobile/app/(app)/workout/ai-generate.tsx`
- **Commit:** 103e1fd

## Known Stubs

- **Exercise data fallback:** When the API returns an unrecognized structure, the component falls back to 5 hardcoded exercises (Développé incliné, etc.). This is intentional — the real API response parsing handles `data.result.exercises` and `data.exercises` structures. Future plan should normalize the API response contract.

## Threat Flags

None — all threat register items from plan spec addressed:
- T-36-02-01 (Spoofing): Bearer token always included from `useAuthStore`
- T-36-02-02 (Info Disclosure): `generatedSession` stored in local component state only
- T-36-02-03 (DoS): `isGenerating` flag disables Régénérer button during API call

## Self-Check: PASSED

- [x] `apps/mobile/app/(app)/workout/ai-generate.tsx` exists
- [x] Commit `103e1fd` exists in git log
- [x] `grep -c "cardio|MotiView|ai_programs_generate"` returns 6
- [x] TypeScript check: zero errors on `ai-generate.tsx`
- [x] No `StyleSheet.create` in file
- [x] No `Alert.alert` in file
