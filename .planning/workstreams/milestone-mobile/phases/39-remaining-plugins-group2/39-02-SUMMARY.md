---
phase: 39
plan: "39-02"
subsystem: "milestone-mobile"
tags: [plugins, supplements, wearables, subtabs, tanstack-query, async-storage]
dependency_graph:
  requires: []
  provides: [SupplementsPlugin, WearablesPlugin]
  affects: [apps/mobile/app/(app)/(plugins)/supplements/list.tsx, apps/mobile/app/(app)/(plugins)/wearables/dashboard.tsx]
tech_stack:
  added: ["@react-native-async-storage/async-storage (MMKV fallback — daily checklist persistence)"]
  patterns: ["SubTabs + AISuggestion + PluginHeader from @ziko/ui", "TanStack Query useQuery for all DB operations", "AsyncStorage keyed by userId+date for daily supplement checklist"]
key_files:
  created:
    - plugins/supplements/src/screens/SupplementsPlugin.tsx
    - plugins/wearables/src/screens/WearablesPlugin.tsx
  modified:
    - apps/mobile/app/(app)/(plugins)/supplements/list.tsx
    - apps/mobile/app/(app)/(plugins)/wearables/dashboard.tsx
    - plugins/supplements/src/index.ts
    - plugins/wearables/src/index.ts
    - plugins/supplements/package.json
    - plugins/wearables/package.json
  deleted:
    - plugins/supplements/src/screens/SupplementsListScreen.tsx
    - plugins/wearables/src/screens/WearablesDashboard.tsx
decisions:
  - "AsyncStorage used instead of MMKV for daily supplement checklist (react-native-mmkv not installed in project)"
  - "SupplementDetail and SupplementCompare screens kept intact as per plan"
  - "WearablesPlugin connection tab is display-only (D-14) — no native Health SDK calls"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-27"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 6
  files_deleted: 2
---

# Phase 39 Plan 02: Supplements + Wearables Plugins Complete

**One-liner:** SupplementsPlugin (3 SubTabs: checklist/search-prices/reminders) + WearablesPlugin (2 SubTabs: health-summary/connection-status) fully replace old dashboards with TanStack Query + real DB data.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | SupplementsPlugin.tsx — 3 SubTabs | 3629e4f | plugins/supplements/src/screens/SupplementsPlugin.tsx |
| 2 | WearablesPlugin.tsx — 2 SubTabs | 3629e4f | plugins/wearables/src/screens/WearablesPlugin.tsx |
| 3 | Route wrappers, barrels, delete old screens | 24a2ee7 | list.tsx, dashboard.tsx, index.ts x2, package.json x2, -SupplementsListScreen, -WearablesDashboard |

## What Was Built

### SupplementsPlugin.tsx
- **Aujourd'hui tab:** Daily supplement checklist loaded from DB (`supplements` table, first 10). Taken/not-taken state persisted via AsyncStorage key `supplements_daily_{userId}_{YYYY-MM-DD}`. Progress bar + "X/Y pris aujourd'hui" counter. AISuggestion tintColor='#2E9E5B' with contextual message.
- **Mon stack tab:** TextInput search with 300ms debounce. `useQuery` fetches `supplements` JOIN `supplement_prices(*)` filtered by ILIKE on name. RowList shows name, source · price_eur€, per_serving_eur€/dose in #2E9E5B.
- **Rappels tab:** 4 static reminder cards (Matin/Pré-entraînement/Midi/Soir) with Switch toggle (local state). AISuggestion reminder tip.

### WearablesPlugin.tsx
- **Aujourd'hui tab:** `useQuery` on `wearable_daily_summary` WHERE user_id + date = today. If no data: empty state with watch icon + AISuggestion. If data: 2×2 metric grid (steps/heart_rate_avg/calories_burned/sleep_hours) with color-coded icons. AISuggestion adapts based on step count (< 5000 = encouragement, ≥ 5000 = congratulation).
- **Connexion tab:** `useQuery` on `health_sync_log` WHERE user_id. If connected: cards per platform showing last_sync_at + "Déconnecter" CTA with showAlert confirmation. If not connected: Apple Health + Health Connect CTA cards (display-only, D-14).

### Route + Barrel Updates
- `supplements/list.tsx`: imports `SupplementsPlugin` from `@ziko/plugin-supplements/screens/SupplementsPlugin`
- `wearables/dashboard.tsx`: imports `WearablesPlugin` from `@ziko/plugin-wearables/screens/WearablesPlugin`
- Both `package.json` exports updated to new screen paths
- Both `index.ts` barrels updated (kept SupplementDetail + SupplementCompare intact)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] react-native-mmkv not installed — replaced with AsyncStorage**
- **Found during:** Task 1 implementation
- **Issue:** Plan specified `import { MMKV } from 'react-native-mmkv'` for daily supplement checklist persistence; `react-native-mmkv` is not installed in the project (not in any package.json, not in node_modules)
- **Fix:** Used `@react-native-async-storage/async-storage` (already installed in apps/mobile: `"@react-native-async-storage/async-storage": "^2.2.0"`). API changed from synchronous `mmkv.getString(key)` to async `AsyncStorage.getItem(key)` via `useEffect`. Same storage key format `supplements_daily_{userId}_{YYYY-MM-DD}` preserved.
- **Files modified:** `plugins/supplements/src/screens/SupplementsPlugin.tsx`
- **Impact:** Functionally equivalent — daily checklist persists across app restarts. Minor: async load on mount (useEffect) vs synchronous MMKV. Not user-visible.

## Verification Results

| Check | Status |
|-------|--------|
| TypeScript: 0 errors | PASS |
| SupplementsPlugin export | PASS |
| WearablesPlugin export | PASS |
| supplement_prices in query | PASS (PLUG-SUP-01) |
| wearable_daily_summary in query | PASS |
| SupplementsListScreen deleted | PASS |
| SupplementCompareScreen intact | PASS |
| WearablesDashboard deleted | PASS |

## Known Stubs

None. Both plugins query real DB tables with no fixture data.

## Threat Flags

None beyond plan scope. All queries are scoped by user_id per T-39-02-02 and T-39-02-04 mitigations.

## Self-Check: PASSED

- `plugins/supplements/src/screens/SupplementsPlugin.tsx` — EXISTS
- `plugins/wearables/src/screens/WearablesPlugin.tsx` — EXISTS
- Commit 3629e4f — EXISTS (Tasks 1+2)
- Commit 24a2ee7 — EXISTS (Task 3)
- SupplementsListScreen.tsx — DELETED
- WearablesDashboard.tsx — DELETED
- SupplementDetailScreen.tsx — EXISTS (untouched)
- SupplementCompareScreen.tsx — EXISTS (untouched)
