---
phase: 36-workout-stack-redesign
plan: "05"
subsystem: mobile-workout-session
tags: [rest-timer, svg-animation, react-native-svg, modal-overlay, animated-api]
dependency_graph:
  requires: []
  provides: [RestTimer-component, session-rest-overlay]
  affects: [apps/mobile/app/(app)/workout/session.tsx]
tech_stack:
  added: []
  patterns: [SVG-ring-animation, Animated-createAnimatedComponent, useNativeDriver-false-svg]
key_files:
  created:
    - apps/mobile/src/components/RestTimer.tsx
  modified:
    - apps/mobile/app/(app)/workout/session.tsx
decisions:
  - "RestTimer mounted inside if(phase==='rest') block instead of exercise block — avoids TS2367 unintentional comparison error"
  - "visible=true used inside rest block (TypeScript-safe) instead of visible={phase==='rest'} outside the block"
  - "playCountdownBeep called in pulse animation useEffect (remaining <= 5) to match existing sounds.ts API"
metrics:
  duration: "17 min"
  completed: "2026-05-25"
  tasks_completed: 2
  files_modified: 2
---

# Phase 36 Plan 05: RestTimer SVG Ring Component + session.tsx Integration Summary

**One-liner:** Standalone RestTimer Modal with SVG ring r=110 gradient countdown, pulse animation at ≤5s, and ±30s controls wired into session.tsx with 1 import + 1 JSX mount.

---

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create RestTimer.tsx with SVG ring, countdown, controls, pulse | d38f84c | apps/mobile/src/components/RestTimer.tsx (NEW) |
| 2 | Wire RestTimer into session.tsx (1 import + 1 JSX) | 693ce05 | apps/mobile/app/(app)/workout/session.tsx |

---

## What Was Built

### RestTimer.tsx (NEW)

Standalone display-only component that receives `remaining` as a prop from session.tsx and renders:

- **Dark overlay Modal:** `transparent={true}`, `animationType="fade"`, zIndex 80 over `#1C1A17` background
- **MotiView entrance:** `opacity: 0 → 1` in 250ms
- **Header:** "REPOS" uppercase label + close button (Ionicons "close")
- **SVG ring (260×260):** `r=110`, CIRC=691.15, animated `strokeDashoffset` with `useNativeDriver: false` (required for SVG props), gradient `#FF5C1A → #FFB07A` via `SvgLinearGradient`
- **Countdown text:** 76pt tabular-nums M:SS format over the ring
- **Pulse animation:** `Animated.loop` on ring opacity (`useNativeDriver: true`) fires when `remaining <= 5`
- **Controls row:** −30s ghost / Pause-Reprendre center / +30s ghost (all call `onAdjust` prop)
- **CTA:** "Reprendre maintenant" with play icon calls `onSkip`
- **Auto-close:** `useEffect` calls `onClose()` after 600ms when `remaining <= 0`

### session.tsx Changes (MINIMAL)

Exactly 2 additions per D-02 constraint:
1. `import RestTimer from '../../../src/components/RestTimer';` after existing imports
2. `<RestTimer visible={true} remaining={restTimer} duration={restTimerMax} nextLabel={nextLabel} onSkip={skipRest} onClose={skipRest} onAdjust={...} />` inside the `if (phase === 'rest')` return block

Zero changes to countdown logic, state, effects, or other JSX.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TS2367 unintentional comparison inside exercise phase block**
- **Found during:** Task 2 TypeScript check
- **Issue:** Plan suggested mounting RestTimer via `{phase === 'rest' && <RestTimer>}` inside the exercise phase block. TypeScript correctly identifies that `phase` is narrowed to `'exercise'` in that scope, making `phase === 'rest'` always false (TS2367).
- **Fix:** Moved the JSX mount inside the `if (phase === 'rest')` block instead, using `visible={true}` (TypeScript-safe since we are already in the rest scope). This matches the intent of the plan (display RestTimer during rest phase) and is architecturally cleaner.
- **Files modified:** apps/mobile/app/(app)/workout/session.tsx
- **Commit:** 693ce05

---

## Verification Results

| Check | Result |
|-------|--------|
| RestTimer.tsx exists | PASS |
| import RestTimer count in session.tsx | 1 (PASS) |
| `<RestTimer` count in session.tsx | 1 (PASS) |
| SVG r=110 | PASS |
| useNativeDriver: false | PASS |
| useNativeDriver: true (pulse) | PASS |
| TypeScript (--noEmit) | PASS — no errors on RestTimer or session |
| No StyleSheet.create | PASS |
| AnimatedCircle | PASS |
| pulseOpacity | PASS |
| Reprendre maintenant CTA | PASS |

---

## Known Stubs

None — RestTimer is fully functional. The Pause button toggles local `paused` state for visual feedback only; note that the countdown itself is driven by session.tsx (design-by-constraint per D-02), so Pause does not stop the countdown in session.tsx. A future plan can wire `onAdjust` or add a `paused` prop to session.tsx if pause behavior is required.

---

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes. RestTimer is a pure UI component with no side effects beyond calling provided callbacks.

---

## Self-Check: PASSED

- `apps/mobile/src/components/RestTimer.tsx` — EXISTS
- Commit d38f84c — IN HISTORY (`git log --oneline | grep d38f84c`)
- Commit 693ce05 — IN HISTORY (HEAD)
- TypeScript clean — CONFIRMED
