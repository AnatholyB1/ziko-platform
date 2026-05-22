---
phase: 34-auth-onboarding-redesign
plan: 02
subsystem: ui
tags: [react-native, expo-router, reanimated, expo-linear-gradient, onboarding, context]

requires:
  - phase: 34-01
    provides: Auth screens rebuild (welcome, login, register, forgot)

provides:
  - OBContext React context (OBState type + setObState) in _layout.tsx
  - 7-step onboarding layout (step-1 → step-7, no step-8)
  - step-1 OBWelcome: LinearGradient icon badge (#FF5C1A → #FF8E5A)
  - step-2 OBGoal: TOTAL=7, 5 per-goal tint cards, withTiming progress bar, OBContext save
  - step-3 OBLevel: 3 cards with vertical bar indicators (18/24/30px), TOTAL=7, OBContext save
  - step-4 OBFreq: 64px frequency display, 7-button grid, FadeIn AI tip, TOTAL=7, OBContext save

affects: [34-03, 34-04, 34-05]

tech-stack:
  added: []
  patterns:
    - OBContext for accumulating onboarding state locally across steps
    - withTiming(350ms) on progress bar fill per OnboardingShell spec
    - withTiming(200ms) on CTA opacity for canNext transitions
    - FadeIn.duration(200) on contextual tip text when value changes

key-files:
  created: []
  modified:
    - apps/mobile/app/(auth)/onboarding/_layout.tsx
    - apps/mobile/app/(auth)/onboarding/step-1.tsx
    - apps/mobile/app/(auth)/onboarding/step-2.tsx
    - apps/mobile/app/(auth)/onboarding/step-3.tsx
    - apps/mobile/app/(auth)/onboarding/step-4.tsx

key-decisions:
  - "OBContext defined and exported from _layout.tsx (not a sibling file) to match Expo Router layout conventions"
  - "OBShell component duplicated per step file — intentional per plan (no shared file to avoid cross-plan deps)"
  - "step-3 level IDs: beg/med/conf (spec IDs), not beginner/intermediate/advanced (old DB values)"
  - "step-4 canNext=true always since default freq=4 is always valid"
  - "expo-linear-gradient confirmed installed (~15.0.8), used for gradient icon badge instead of 2-View fallback"

patterns-established:
  - "OBShell: animated progress bar via useSharedValue + withTiming(350), animated CTA via withTiming(200)"
  - "Level bar indicator: 3 bars at heights [18,24,30], colored by barIndex < barsFilled"
  - "OBFreq AI tip: Animated.Text with key={v} + entering={FadeIn.duration(200)} for re-render animation"

requirements-completed: [OB-01, OB-02, OB-03, OB-04, OB-05]

duration: 25min
completed: 2026-05-22
---

# Phase 34 Plan 02: Onboarding Steps 1–4 Rebuild Summary

**Rebuilt onboarding steps 1–4 with OBContext shared state, TOTAL=7, animated progress bar (withTiming 350ms), LinearGradient icon badge, per-goal tint cards, bar-indicator level cards, and 64px frequency display with 7-button grid**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-22T00:00:00Z
- **Completed:** 2026-05-22T00:25:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- `_layout.tsx` provides `OBContext` with `OBState` type + `setObState`, registers 7 steps (step-1 → step-7), removes step-8
- `step-1.tsx` replaces solid orange badge with `expo-linear-gradient` (#FF5C1A → #FF8E5A) with 8dp shadow
- `step-2.tsx` rebuilt: TOTAL=7, Supabase call removed, OBContext save, withTiming 350ms progress bar + 200ms CTA opacity animation
- `step-3.tsx` rebuilt: OBLevel with 3 vertical bar indicators (heights 18/24/30), new IDs (beg/med/conf), TOTAL=7, OBContext save
- `step-4.tsx` rebuilt: OBFreq with 64px number, 7-button flex row, contextual AI tip with FadeIn.duration(200) animation, TOTAL=7, OBContext save

## Task Commits

1. **Task 1: _layout.tsx + OBContext + step-1 gradient badge** - `741dd3b` (feat)
2. **Task 2: OBGoal — TOTAL=7, OBContext, withTiming** - `5d15bbe` (feat)
3. **Task 3: OBLevel + OBFreq full rebuild** - `c27be15` (feat)

## Files Created/Modified

- `apps/mobile/app/(auth)/onboarding/_layout.tsx` — OBContext + OBState type + 7-step Stack
- `apps/mobile/app/(auth)/onboarding/step-1.tsx` — LinearGradient icon badge
- `apps/mobile/app/(auth)/onboarding/step-2.tsx` — TOTAL=7, OBContext, animated shell, no Supabase
- `apps/mobile/app/(auth)/onboarding/step-3.tsx` — Full rebuild: bar indicators, beg/med/conf IDs
- `apps/mobile/app/(auth)/onboarding/step-4.tsx` — Full rebuild: 64px display, 7-grid, FadeIn tip

## Decisions Made

- `OBContext` exported from `_layout.tsx` directly (not a sibling `context.ts` file) — cleaner import path for step files importing via `'./_layout'`
- `OBShell` is duplicated in each step file rather than extracted to a shared file — intentional per plan to avoid cross-plan dependencies
- Level IDs changed from `beginner/intermediate/advanced` (old DB values) to `beg/med/conf` (UI-SPEC values) — these are local OBContext values only, Supabase upsert happens in OBReady (step-7)
- `canNext = true` always in step-4 since the frequency defaults to 4, which is always a valid selection
- Used `expo-linear-gradient` (already installed ~15.0.8) for the gradient badge rather than the 2-View fallback approximation

## Deviations from Plan

None — plan executed exactly as written. All must_haves fulfilled, all acceptance criteria met.

## Issues Encountered

None. Pre-existing TypeScript errors in `chat.tsx` and `ImportFileScreen.tsx` are unrelated to this plan and out of scope.

## Known Stubs

None — steps 1–4 accumulate local state in OBContext; no UI displays placeholder data. The Supabase upsert is intentionally deferred to step-7 (OBReady), which is within plan design.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes in this plan.

## Self-Check

- [x] `_layout.tsx` contains `step-7` and NOT `step-8`
- [x] `_layout.tsx` exports `OBContext` and `OBState`
- [x] `step-1.tsx` contains `FF8E5A`
- [x] `step-2.tsx` contains `TOTAL = 7`, `withTiming`, `setObState`, `muscle_gain`, no `user_profiles`
- [x] `step-3.tsx` contains `Débutant`, `barsFilled`, `TOTAL = 7`, `withTiming`, no `user_profiles`
- [x] `step-4.tsx` contains `fontSize: 64`, `[1, 2, 3, 4, 5, 6, 7]`, `FadeIn`, `withTiming`, `setObState`
- [x] All 3 commits exist: `741dd3b`, `5d15bbe`, `c27be15`

## Self-Check: PASSED

## Next Phase Readiness

- Steps 1–4 complete with OBContext accumulation ready for steps 5–7
- step-5 (OBEquip), step-6 (OBBio), step-7 (OBPrep/OBReady) remain to be built in plan 34-03
- The OBReady screen will perform the single Supabase upsert using `obState` from OBContext

---
*Phase: 34-auth-onboarding-redesign*
*Completed: 2026-05-22*
