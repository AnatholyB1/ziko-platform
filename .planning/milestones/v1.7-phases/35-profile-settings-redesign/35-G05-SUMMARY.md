---
phase: 35
plan: G05
subsystem: mobile/profile-settings
tags: [settings, i18n, units, db-migration, zustand]
dependency_graph:
  requires: [35-G01, 35-G04]
  provides: [user-prefs-store, units-hook, language-region-db]
  affects: [measurements-plugin, cardio-plugin, profile-index]
tech_stack:
  added: [userPrefsStore (Zustand persist), useUnits hook]
  patterns: [zustand-persist-async-storage, relative-path-cross-plugin-hooks]
key_files:
  created:
    - supabase/migrations/052_language_region.sql
    - apps/mobile/src/stores/userPrefsStore.ts
    - apps/mobile/src/hooks/useUnits.ts
  modified:
    - apps/mobile/app/(app)/_layout.tsx
    - apps/mobile/app/(app)/profile/settings.tsx
    - plugins/measurements/src/screens/MeasurementsDashboard.tsx
    - plugins/cardio/src/screens/CardioDashboard.tsx
    - apps/mobile/app/(app)/profile/index.tsx
decisions:
  - AsyncStorage (not MMKV) used for Zustand persist — project uses AsyncStorage throughout mobile app
  - InlinePicker component (Modal-based bottom sheet) used instead of ActionSheet — no ActionSheet lib installed
  - PersonalRecords and SessionCard in CardioDashboard updated to accept distanceLabel/convertDistance as props
metrics:
  duration: ~8 minutes
  completed: 2026-05-23
  tasks: 6
  files: 8
---

# Phase 35 Plan G05: Apparences — Remove Theme, Wire Langue/Région/Unités to DB

Remove theme picker from AppearanceSubScreen, add Langue/Région pickers backed by DB columns, wire Unités to `user_profiles.units` directly, and propagate unit conversion to measurement-showing screens via a reusable `useUnits` hook.

## What Was Built

**Migration 052:** Adds `language TEXT DEFAULT 'fr' CHECK (language IN ('fr', 'en'))` and `region TEXT DEFAULT 'FR'` columns to `user_profiles`.

**`userPrefsStore`:** Zustand store with `persist` + `createJSONStorage(() => AsyncStorage)` (matching project pattern — MMKV is not used in mobile stores). Persists `units`, `language`, `region` under key `user-prefs`.

**`useUnits` hook:** Subscribes to `userPrefsStore.units` and returns `weightLabel`, `distanceLabel`, `heightLabel`, `convertWeight(kg)`, `convertDistance(km)`.

**`_layout.tsx`:** Added `useEffect` that fetches `user_profiles.units, language, region` after auth resolves and hydrates the prefs store on cold start.

**`settings.tsx` — AppearanceSubScreen rewrite:**
- Removed `THEMES` constant and all `handleThemeSelect` / `activeTheme` code
- Added `InlinePicker` (Modal bottom-sheet) for Langue (fr/en) and Région (FR/BE/CH/CA/US)
- Langue/Région changes call `UPDATE user_profiles SET language = ?` / `SET region = ?` and `setPrefs()`
- Units now writes to `user_profiles.units` directly (was writing to `settings JSONB` appearance blob)

**`MeasurementsDashboard`:** Weight stat card uses `convertWeight(latest.weight_kg)` + `weightLabel`; history list weight display updated.

**`CardioDashboard`:** Distance in header, quick-stats card, PersonalRecords (best run/cycle/total), and SessionCard all use `convertDistance` + `distanceLabel`. Cross-plugin weight display updated with `convertWeight` + `weightLabel`.

**`profile/index.tsx`:** PR weight rows (barbell 1RM PRs) use `convertWeight` + `weightLabel`.

## Deviations from Plan

### Auto-adapted Implementation

**1. [Rule 2 - Completeness] InlinePicker instead of ActionSheet**
- **Found during:** Task 5
- **Issue:** No ActionSheet library (e.g., `@react-native-community/action-sheet`) installed in project
- **Fix:** Implemented `InlinePicker` — a transparent Modal with bottom-sheet style, matching the project's inline style pattern
- **Files modified:** `settings.tsx`

**2. [Rule 1 - Bug] Relative path correction for measurements import**
- **Found during:** Task 6 TypeScript check
- **Issue:** Used 5 `..` segments; correct depth from `plugins/measurements/src/screens/` to `apps/mobile/src/hooks/` is 4 segments
- **Fix:** Changed `../../../../../apps/mobile/...` to `../../../../apps/mobile/...`
- **Commit:** 9726107

**3. [Rule 2 - Completeness] AsyncStorage instead of MMKV for persist**
- **Found during:** Task 2
- **Issue:** Plan specified `MMKV` storage but project's `src/lib/storage.ts` exports AsyncStorage wrappers and no MMKV is installed
- **Fix:** Used `createJSONStorage(() => AsyncStorage)` matching the plugin-sdk persist pattern already in the codebase

## TypeScript Status

- **Pre-existing errors (6):** habits/notifications.ts (2), ai/chat.tsx (1), security.tsx (1), ImportFileScreen.tsx (1), settings.tsx NotifSubScreen useRef (1)
- **New errors introduced: 0**

## Known Stubs

None — all pickers are functional and write to DB.

## Self-Check: PASSED

- `supabase/migrations/052_language_region.sql` — FOUND
- `apps/mobile/src/stores/userPrefsStore.ts` — FOUND
- `apps/mobile/src/hooks/useUnits.ts` — FOUND
- Commit `9726107` — FOUND
