---
phase: 21-mobile-ui-credit-display-exhaustion-ux
plan: "01"
subsystem: mobile-credit-ui
tags: [credits, zustand, ui, toast, bottom-sheet, hono]
dependency_graph:
  requires: [phase-17-db-foundation, phase-20-activity-earn-hooks]
  provides: [creditStore, CreditEarnToast, CreditExhaustionSheet, creditCosts]
  affects: [apps/mobile/app/_layout.tsx, backend/api/src/middleware/creditGate.ts]
tech_stack:
  added: []
  patterns: [zustand-store, motiview-animation, modal-bottom-sheet, hono-402-body]
key_files:
  created:
    - apps/mobile/src/stores/creditStore.ts
    - apps/mobile/src/lib/creditCosts.ts
    - apps/mobile/src/components/CreditEarnToast.tsx
    - apps/mobile/src/components/CreditExhaustionSheet.tsx
  modified:
    - backend/api/src/middleware/creditGate.ts
    - apps/mobile/app/_layout.tsx
decisions:
  - "earned_today uses Set deduplication before returning in 402 body — prevents duplicate source entries on multiple earn events of same type"
  - "CreditEarnToast uses useRef for timer to prevent flickering on rapid showEarnToast calls"
  - "CreditExhaustionSheet countdown interval polls every 30s (not 1s) — sufficient granularity, lower battery impact"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-09"
  tasks_completed: 2
  files_changed: 6
---

# Phase 21 Plan 01: Credit UI Foundation Summary

**One-liner:** Zustand credit store + MotiView earn toast + exhaustion bottom sheet with 6-activity checklist, plus 402 body extended with earned_today and reset_timestamp.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Extend 402 body + create creditCosts.ts | f1dfa05 | creditGate.ts, creditCosts.ts |
| 2 | Create creditStore + CreditEarnToast + CreditExhaustionSheet + mount in layout | 6c50211 | creditStore.ts, CreditEarnToast.tsx, CreditExhaustionSheet.tsx, _layout.tsx |

## What Was Built

### backend/api/src/middleware/creditGate.ts
Extended the 402 response body with two new fields:
- `earned_today`: deduplicated string array of activity sources earned today (queried from `ai_credit_transactions` filtered by user_id + type='earn' + today UTC)
- `reset_timestamp`: next UTC midnight ISO string (computed inline, no DB hit)

The `ai_credit_transactions` table has an index on `(user_id, created_at DESC)` covering this query efficiently (T-21-03 mitigated).

### apps/mobile/src/lib/creditCosts.ts
Static constants `{ chat: 4, scan: 3, program: 4 }` mirroring the backend. Display-only — server enforces authoritative values.

### apps/mobile/src/stores/creditStore.ts
Zustand store (following `useAlertStore` pattern from plugin-sdk) exposing:
- Balance state: `balance`, `dailyEarned`, `dailyCap`, `resetTimestamp`
- `fetchBalance(accessToken)` — fetches `/credits/balance`, silently fails on error
- Toast control: `toastVisible`, `showEarnToast`, `hideEarnToast`
- Exhaustion sheet control: `exhaustionVisible`, `exhaustionData`, `showExhaustionSheet`, `hideExhaustionSheet`

### apps/mobile/src/components/CreditEarnToast.tsx
Floating pill toast with:
- MotiView `from={{ opacity:0, translateY:20 }}` → `animate={{ opacity:1, translateY:0 }}` (300ms timing)
- 2500ms auto-dismiss via `useRef<setTimeout>` (prevents flicker on rapid calls)
- `pointerEvents="none"` so it never blocks touch events below
- `zIndex: 999`, `bottom: 80` (above tab bar)

### apps/mobile/src/components/CreditExhaustionSheet.tsx
Modal bottom sheet with:
- 6 earn activities (workout, habit, meal, measurement, stretch, cardio) with checkmark/empty indicators driven by `earned_today` array
- Done activities shown with strikethrough + muted color
- Reset countdown (hh mm format) refreshed every 30s via `setInterval`
- MotiView slide-up animation (translateY 300 → 0, 300ms)
- Backdrop press to dismiss

### apps/mobile/app/_layout.tsx
`<CreditEarnToast />` and `<CreditExhaustionSheet />` mounted after `<BugReportModal />`, inside `<PluginLoader>`.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all components are wired to real store state. The store's `fetchBalance` is ready to be called from screen-level code (Plan 02).

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. The earned_today query operates within existing trust boundaries documented in the plan's threat model.

## Self-Check: PASSED

Files exist:
- FOUND: apps/mobile/src/stores/creditStore.ts
- FOUND: apps/mobile/src/lib/creditCosts.ts
- FOUND: apps/mobile/src/components/CreditEarnToast.tsx
- FOUND: apps/mobile/src/components/CreditExhaustionSheet.tsx

Commits exist:
- FOUND: f1dfa05 (feat(21-01): extend 402 body + create creditCosts.ts)
- FOUND: 6c50211 (feat(21-01): credit store + earn toast + exhaustion sheet + layout mount)
