---
phase: "37"
plan: "37-02"
subsystem: plugins/hydration
tags: [hydration, svg, tanstack-query, react-native-svg, subtabs]
dependency_graph:
  requires: [37-01]
  provides: [HydrationPlugin]
  affects: [apps/mobile/(plugins)/hydration/dashboard.tsx]
tech_stack:
  added: []
  patterns: [svg-clip-path-fill, tanstack-query-mutation, modal-bottom-sheet, 300ms-flash-confirmation]
key_files:
  created:
    - plugins/hydration/src/screens/HydrationPlugin.tsx
  modified:
    - apps/mobile/app/(app)/(plugins)/hydration/dashboard.tsx
    - plugins/hydration/src/index.ts
  deleted:
    - plugins/hydration/src/screens/HydrationDashboard.tsx
decisions:
  - "SVG bottle uses ClipPath + Rect fill approach (react-native-svg) per UI-SPEC §2.3 — not a polygon approach"
  - "user_profiles.eq('id') used for hydration_goal_ml query (linter corrected from user_id — user_profiles PK is id)"
  - "HydrationDashboardRoute function name kept in route wrapper (internal export name, not an import reference)"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-26"
  tasks: 2
  files: 4
---

# Phase 37 Plan 02: Hydration Plugin Redesign Summary

**One-liner:** SVG bottle-fill Hydration plugin with 3 SubTabs, TanStack Query real data, +250/+500/+750ml quick-log with flash confirmation, 7-day bar chart, and goal editor saving to user_profiles JSONB.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Build HydrationPlugin.tsx — 3-tab entrypoint with SVG bottle and quick-log | 8bfec48 | plugins/hydration/src/screens/HydrationPlugin.tsx (created) |
| 2 | Wire route wrapper + barrel, delete old dashboard | 093c126 | dashboard.tsx, index.ts (modified), HydrationDashboard.tsx (deleted) |

## What Was Built

### HydrationPlugin.tsx

Single-entrypoint screen with internal `useState<string>("Aujourd'hui")` tab switching across 3 tabs:

**Aujourd'hui tab:**
- SVG bottle-fill visualization using `react-native-svg` Defs/ClipPath approach. `fillRatio = Math.min(1, today_ml / goal_ml)`. Fill rect at `y = 140 - fillRatio * 120`, surface line at same Y position. Blue `#2E7BF6` fill.
- Stats column: HYDRATATION label, remaining liters display (28px), streak chip with `flame-outline` icon
- AISuggestion (tintColor `#2E7BF6`): rule checks if majority of logs created after 14h00 → distribution tip; else generic progress text
- Logger rapide: 4-column grid — +250/+500/+750ml quick buttons with 300ms flash (`flashingButton` state + setTimeout), Custom button opens Modal BottomSheet
- Custom BottomSheet: numeric TextInput + "Logger" CTA; validates 1–5000ml (T-37-02-01 mitigated)
- Today log list: entries with blue icon circle, amount_ml, formatted time

**Historique tab:**
- 7-day bar chart: `height: 112`, aligned flex-end, today bar `#2E7BF6`, reached-goal past bars `rgba(46,123,246,0.35)`, below-goal bars `rgba(46,123,246,0.18)`, minHeight 4
- Stats 2-up row: MOYENNE 7J (avg ml/day) + STREAK RECORD
- AISuggestion: workout vs rest day tip

**Réglages tab:**
- Daily goal card: shows current goal in L, "Modifier" CTA opens Modal for numeric input + save
- Goal saved to `user_profiles.settings.hydration_goal_ml` JSONB via `useMutation` + `useQueryClient.invalidateQueries`
- Settings list: 4 rows (Rappels, Taille verre, Café/thé toggle, Bonus séance) — UI only, non-functional per spec

### Route + Barrel Wiring

- `apps/mobile/app/(app)/(plugins)/hydration/dashboard.tsx`: now imports and renders `HydrationPlugin` (was `HydrationDashboard`)
- `plugins/hydration/src/index.ts`: exports `HydrationPlugin` added alongside existing `manifest`, `useHydrationStore` exports

### Cleanup

- `plugins/hydration/src/screens/HydrationDashboard.tsx`: deleted after verifying zero import references

## Security (Threat Model)

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-37-02-01 | Custom TextInput amount parsed with `parseInt` and validated `> 0 && <= 5000 && !isNaN` before mutation — invalid values show alert, never reach DB |
| T-37-02-02 | All `hydration_logs` queries use `.eq('user_id', userId)` — RLS enforces at DB level as well |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] user_profiles primary key is `id`, not `user_id`**
- **Found during:** Task 1, linter correction on hydration_goal query
- **Issue:** Goal query used `.eq('user_id', userId)` but `user_profiles` extends `auth.users` with PK `id`
- **Fix:** Query uses `.eq('id', userId)` — linter caught and auto-corrected this
- **Files modified:** `plugins/hydration/src/screens/HydrationPlugin.tsx`

## Known Stubs

None. All data is wired to real Supabase queries. The Réglages rows (Rappels, Taille verre, Café/thé, Bonus séance) are intentionally UI-only per plan spec ("non-functional, UI only, acceptable").

## Threat Flags

None. No new network endpoints or auth paths introduced beyond the planned `hydration_logs` and `user_profiles` queries already present in the threat model.

## Self-Check: PASSED

- `plugins/hydration/src/screens/HydrationPlugin.tsx` — EXISTS
- `apps/mobile/app/(app)/(plugins)/hydration/dashboard.tsx` imports HydrationPlugin — VERIFIED
- `plugins/hydration/src/index.ts` exports HydrationPlugin — VERIFIED
- `plugins/hydration/src/screens/HydrationDashboard.tsx` — DELETED
- TypeScript errors: 0
- ClipPath in HydrationPlugin.tsx: FOUND
- useMutation in HydrationPlugin.tsx: FOUND
- WATER fixture constant: NOT PRESENT
- HydrationDashboard imports remaining (excl. route function name): 0
