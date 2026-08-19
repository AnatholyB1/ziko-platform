---
phase: 21-mobile-ui-credit-display-exhaustion-ux
plan: "02"
subsystem: mobile-credit-ui
tags: [credits, zustand, ui, toast, balance-chip, cost-label, earn-toast, 402]
dependency_graph:
  requires: [phase-21-plan-01]
  provides: [balance-chip-ai-chat, dual-balance-card-gamification, cost-labels-3-screens, earn-toast-6-screens, 402-exhaustion-trigger]
  affects:
    - apps/mobile/app/(app)/ai/index.tsx
    - plugins/gamification/src/screens/GamificationDashboard.tsx
    - plugins/ai-programs/src/screens/GenerateProgram.tsx
    - plugins/nutrition/src/screens/LogMealScreen.tsx
    - plugins/habits/src/screens/HabitsDashboardScreen.tsx
    - plugins/measurements/src/screens/MeasurementsLog.tsx
    - plugins/stretching/src/screens/StretchingSession.tsx
    - plugins/cardio/src/screens/CardioTracker.tsx
    - apps/mobile/src/stores/workoutStore.ts
    - apps/mobile/src/lib/earnCredits.ts
tech_stack:
  added: []
  patterns: [useFocusEffect-balance-refresh, 402-regex-parse, non-blocking-earn-then, cross-plugin-creditStore]
key_files:
  created: []
  modified:
    - apps/mobile/app/(app)/ai/index.tsx
    - apps/mobile/src/lib/earnCredits.ts
    - plugins/gamification/src/screens/GamificationDashboard.tsx
    - plugins/ai-programs/src/screens/GenerateProgram.tsx
    - plugins/nutrition/src/screens/LogMealScreen.tsx
    - plugins/habits/src/screens/HabitsDashboardScreen.tsx
    - plugins/measurements/src/screens/MeasurementsLog.tsx
    - plugins/stretching/src/screens/StretchingSession.tsx
    - plugins/cardio/src/screens/CardioTracker.tsx
    - apps/mobile/src/stores/workoutStore.ts
decisions:
  - "CREDIT_COSTS inlined in plugins (not imported from apps/mobile) — plugins cannot cross-import from the app layer; display-only values so duplication is acceptable"
  - "earnCredit helper upgraded in-place in each plugin (not replaced with callCreditsEarnWithResult) — maintains inline independence pattern while adding toast feedback"
  - "workoutStore uses require() for creditStore import to avoid circular dependency (store imports store)"
  - "Gallery scan button cost label uses theme.muted color (not white) since background is theme.surface — same cost value 3 as camera button"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-09"
  tasks_completed: 2
  files_changed: 10
---

# Phase 21 Plan 02: Credit UI Screen Wiring Summary

**One-liner:** Balance chip + 402 exhaustion trigger in AI chat, dual-balance card in gamification, cost labels on 3 AI action buttons, earn toast wired on all 6 activity saves via non-blocking .then() pattern.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | AI chat screen — balance chip, cost label, 402 detection | 99685f2 | apps/mobile/app/(app)/ai/index.tsx |
| 2 | Dual-balance card, cost labels on 2 screens, earn toast wiring on 6 screens | 280bfc2 | 9 files across mobile + plugins |

## What Was Built

### apps/mobile/app/(app)/ai/index.tsx
Three additions to the AI chat screen:

1. **Balance chip in header** — `Ionicons name="flash"` (gold #FFB800) + credit balance number in a pill chip (`#FFB80015` background). Placed before the community friends button. `useFocusEffect` refreshes balance on every screen focus via `fetchBalance(session.access_token)`.

2. **Cost label on send button** — Send button widened from fixed 44px to `paddingHorizontal: 14` pill shape. Displays `<Ionicons name="send" /> {CREDIT_COSTS.chat}⚡` side by side. ActivityIndicator shown during streaming (cost label hidden).

3. **402 detection in handleSend** — Catches errors matching `/^AI API error 402: (.+)$/`, JSON-parses the body, calls `Keyboard.dismiss()` then `useCreditStore.getState().showExhaustionSheet(...)` with parsed `balance`, `required`, `earned_today`, `earn_hint`, `reset_timestamp`. Also refreshes balance after 402.

### apps/mobile/src/lib/earnCredits.ts
Added `callCreditsEarnWithResult` — awaitable version of `callCreditsEarn` that returns `{ credited: boolean }`. The original fire-and-forget `callCreditsEarn` is preserved unchanged. New function uses `await fetch()` (not fire-and-forget), returns `{ credited: true }` when server responds with `credited: true`, `{ credited: false }` on any error — never throws.

### plugins/gamification/src/screens/GamificationDashboard.tsx
Two additions:

1. **Dual-balance card** — Added between the Stats Row and Shop Button. Side-by-side layout: left shows `💰` emoji + coins count + "coins" label; right shows `Ionicons name="flash"` (#FFB800) + credit balance + "credits IA" label. Separated by a 1px vertical divider.

2. **Daily earn progress bar** — Below the dual-balance card: `{dailyEarned} / {dailyCap} bonus credits earned today` in a `#FFB80010` pill with flash icon. Both values from `useCreditStore`.

`useFocusEffect` added to refresh credit balance on every focus.

### plugins/ai-programs/src/screens/GenerateProgram.tsx
Inline `CREDIT_COSTS` constant added. Generate button shows `{CREDIT_COSTS.program}⚡` (4⚡) after the button text when not generating.

### plugins/nutrition/src/screens/LogMealScreen.tsx
- Inline `CREDIT_COSTS` constant added.
- `earnCredit` helper upgraded from fire-and-forget to awaitable returning `{ credited: boolean }`.
- `useCreditStore` import added for toast.
- Camera button shows `{CREDIT_COSTS.scan}⚡` (3⚡, white text on primary background).
- Gallery button shows `{CREDIT_COSTS.scan}⚡` (3⚡, muted text on surface background).
- Meal log save calls `.then((r) => { if (r.credited) useCreditStore.getState().showEarnToast(); })`.

### plugins/habits/src/screens/HabitsDashboardScreen.tsx
- `earnCredit` helper upgraded to awaitable returning `{ credited: boolean }`.
- `useCreditStore` import added.
- Both earn call sites (boolean toggle + count increment) wired with `.then()` toast pattern.

### plugins/measurements/src/screens/MeasurementsLog.tsx
- `earnCredit` helper upgraded to awaitable.
- `useCreditStore` import added.
- Measurement save earn call wired with `.then()` toast pattern.

### plugins/stretching/src/screens/StretchingSession.tsx
- `earnCredit` helper upgraded to awaitable.
- `useCreditStore` import added.
- Stretch session save earn call wired with `.then()` toast pattern.

### plugins/cardio/src/screens/CardioTracker.tsx
- `earnCredit` helper upgraded to awaitable.
- `useCreditStore` import added.
- Cardio session save earn call wired with `.then()` toast pattern.

### apps/mobile/src/stores/workoutStore.ts
- Import updated to also import `callCreditsEarnWithResult`.
- `endSession` earn call replaced: `callCreditsEarnWithResult(...).then((result) => { if (result.credited) { const { useCreditStore } = require('../stores/creditStore'); useCreditStore.getState().showEarnToast(); } })`.
- Uses `require()` to avoid circular dependency (store importing store).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all cost labels display real CREDIT_COSTS values. Balance chip reads from live creditStore (fetched on focus). Earn toast fires on real server response. Exhaustion sheet receives real 402 body data.

## Threat Flags

None — no new network endpoints introduced. All changes are client-side UI wiring to existing stores and existing API endpoints. Trust boundaries unchanged from Plan 01 threat model.

## Self-Check: PASSED

Files modified:
- FOUND: apps/mobile/app/(app)/ai/index.tsx
- FOUND: apps/mobile/src/lib/earnCredits.ts
- FOUND: plugins/gamification/src/screens/GamificationDashboard.tsx
- FOUND: plugins/ai-programs/src/screens/GenerateProgram.tsx
- FOUND: plugins/nutrition/src/screens/LogMealScreen.tsx
- FOUND: plugins/habits/src/screens/HabitsDashboardScreen.tsx
- FOUND: plugins/measurements/src/screens/MeasurementsLog.tsx
- FOUND: plugins/stretching/src/screens/StretchingSession.tsx
- FOUND: plugins/cardio/src/screens/CardioTracker.tsx
- FOUND: apps/mobile/src/stores/workoutStore.ts

Commits exist:
- FOUND: 99685f2 (feat(21-02): AI chat screen — balance chip, cost label, 402 detection)
- FOUND: 280bfc2 (feat(21-02): dual-balance card, cost labels, earn toast on all 6 activity screens)
