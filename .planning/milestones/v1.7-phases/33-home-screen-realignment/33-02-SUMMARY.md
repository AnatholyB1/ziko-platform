---
phase: 33-home-screen-realignment
plan: "02"
subsystem: mobile-hooks
tags: [hooks, tips-engine, smart-actions, appStorage, useMemo]
dependency_graph:
  requires: []
  provides:
    - apps/mobile/src/hooks/useAITips.ts
    - apps/mobile/src/hooks/useSmartActions.ts
  affects:
    - apps/mobile/app/(app)/index.tsx
tech_stack:
  added: []
  patterns:
    - "useMemo-only hook (no useEffect, no network)"
    - "appStorage numeric timestamp for 24h TTL dismiss"
    - "navigate callback injection for testability"
key_files:
  created:
    - apps/mobile/src/hooks/useAITips.ts
    - apps/mobile/src/hooks/useSmartActions.ts
  modified: []
decisions:
  - "isDismissed accepts hoursWindow param for flexibility; callers always pass 24 (HOME-03)"
  - "useSmartActions receives navigate as a parameter (not useRouter internally) for pure derivation"
  - "computeTips is a separate exported pure function so unit tests can call it directly"
metrics:
  duration: "~10min"
  completed: "2026-05-21"
  tasks_completed: 2
  files_changed: 2
---

# Phase 33 Plan 02: useAITips + useSmartActions Hooks Summary

Rule-based AICoachInline tips engine and time-of-day SmartActions hook — pure useMemo derivations, no network calls, appStorage dismiss with 24h TTL.

## What Was Built

### `apps/mobile/src/hooks/useAITips.ts`

6 exports as required:

- **`Tip`** interface: `{ key, tag, text }`
- **`HomeDataForTips`** interface: `{ sleepDurationH, hydrationMl, hydrationGoalMl, unmetHabitName? }`
- **`computeTips(data)`** — pure synchronous function, returns 1–4 tips:
  1. Sleep tip (if sleepDurationH / 8 >= 0.7) — tag "Pré-séance" with actual h/m values
  2. Hydration tip (if hydrationMl < hydrationGoalMl * 0.5) — tag "Hydratation" with ml deficit
  3. Habit tip (if unmetHabitName present AND hour >= 12) — tag "Habitude" with habit name
  4. Default tip — always present — tag "Coach Ziko"
- **`isDismissed(tipKey, hoursWindow)`** — async, reads appStorage numeric timestamp, returns true if within window
- **`dismissTip(tipKey)`** — async, stores `Date.now()` to `appStorage` key `coach_tip_dismissed_${tipKey}`
- **`useAITips(data)`** — returns `{ tips: Tip[] }` via useMemo keyed on 4 data fields

### `apps/mobile/src/hooks/useSmartActions.ts`

3 exports as required:

- **`SmartAction`** interface: `{ key, tintColor, icon, tag, title, subtitle, onPress }`
- **`HomeDataForSmartActions`** interface: `{ hour, nutritionPct, hydrationPct, sleepPct }`
- **`useSmartActions(data, navigate)`** — returns at most 2 actions via useMemo:
  1. Morning mobility (hour < 11) → stretching/dashboard — violet tint
  2. Nutrition gap (nutritionPct < 60) → nutrition/log — primary orange tint
  3. Evening sleep prep (hour >= 19 && sleepPct < 50) → sleep/dashboard — violet tint
  4. Hydration catch-up (hydrationPct < 50 && actions.length < 2) → hydration/dashboard — blue tint

## Verification Results

| Check | Result |
|-------|--------|
| `grep -c "export function computeTips"` | 1 |
| `grep -c "export async function dismissTip"` | 1 |
| `grep -c "appStorage"` | 3 |
| `grep -c "slice(0, 2)"` | 1 |
| No MMKV usage | 0 |
| TypeScript errors (`grep -c 'error TS'`) | 0 |

## Commits

| Hash | Message |
|------|---------|
| b405132 | feat(33-02): add useAITips and useSmartActions hooks |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `apps/mobile/src/hooks/useAITips.ts` — FOUND
- `apps/mobile/src/hooks/useSmartActions.ts` — FOUND
- commit b405132 — FOUND
