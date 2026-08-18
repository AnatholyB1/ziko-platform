---
phase: 33-home-screen-realignment
plan: "04"
subsystem: mobile/home-screen
tags: [home-screen, final-assembly, tanstack-query, quicklog, formring, plugins-drawer, ai-coach-inline]
dependency_graph:
  requires:
    - 33-01 (useHomeData hooks)
    - 33-02 (useAITips + useSmartActions hooks)
    - 33-03 (MissionCard, WeekStrip, Recent wired)
  provides:
    - Fully assembled data-driven home screen (HOME-01 through HOME-10)
  affects:
    - apps/mobile/app/(app)/index.tsx
    - packages/ui/src/components/PluginsDrawer.tsx
tech_stack:
  added: []
  patterns:
    - "@ziko/ui FormRing (score + 4 parts, max:100 each)"
    - "fireAndForget helper — supabase.auth.getSession() + fetch POST /ai/tools/execute"
    - "user_plugins TanStack Query with enabled: !!userId guard"
    - "6.5s tip rotation via setInterval + tipIndex state"
    - "24h dismiss window via appStorage (HOME-03)"
    - "React Native Modal for mood (5-emoji) and weight (TextInput) bottom sheets"
key_files:
  created: []
  modified:
    - apps/mobile/app/(app)/index.tsx
    - packages/ui/src/components/PluginsDrawer.tsx
decisions:
  - "Used @ziko/ui FormRing (score + parts[{value,max,color}]) — local FormRing definition deleted"
  - "fireAndForget defined as module-level async function (reads session fresh each call)"
  - "PluginsDrawer installedPluginIds prop is optional — falls back to usePluginRegistry (backward compat)"
  - "Mood emojis encoded as Unicode escapes to avoid shell encoding corruption"
  - "onRefresh uses queryClient.invalidateQueries for all wellness queries (no plugin store calls)"
  - "SmartActions section only rendered when smartActions.length > 0"
  - "DEFERRED: habit tip (HOME-03 rule 3) left as unmetHabitName=undefined pending useHabitsToday (Phase 37)"
metrics:
  duration: 25min
  completed: 2026-05-21
  tasks_completed: 2
  files_created: 0
  files_modified: 2
---

# Phase 33 Plan 04: Final Assembly — Home Screen Summary

**One-liner:** Home screen fully assembled with @ziko/ui FormRing wired to real wellness data, QuickLog firing /ai/tools/execute, AICoachInline rotating rule-based tips every 6.5s, and PluginsDrawer reading user_plugins from Supabase.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Wire Header, FormRing, AICoachInline — replace fixtures and local FormRing | c4a7ac6 | apps/mobile/app/(app)/index.tsx, packages/ui/src/components/PluginsDrawer.tsx |
| 2 | Wire QuickLog mutations + update PluginsDrawer for user_plugins + final purge | c4a7ac6 | (same commit) |

## What Was Built

### `apps/mobile/app/(app)/index.tsx` — complete rewrite

**Header:**
- `profile?.name?.split(' ')[0] ?? 'Athlete'` for first name (no PROFILE fixture)
- `useStreak()` for streak count with Ionicons `flame` chip, orange styling per PATTERNS.md

**FormeDuJour:**
- Local `FormRing` function deleted
- `@ziko/ui FormRing` imported and used: `score + parts[{value, max:100, color}]` with 4 segments (sleep violet, water blue, nutrition orange, load green)
- Loading: 160×160 circle Skeleton + 4 row Skeletons
- Score headline: ≥70 "Tu es en forme aujourd'hui", ≥40 "Journée correcte — pousse un peu", else "Corps en récupération — écoute-toi"
- 4 segment rows with icon tile + label + sub text + percentage

**AICoachInline:**
- `useAITips({ sleepDurationH, hydrationMl, hydrationGoalMl })` → rule-based tips
- 6.5s interval rotation via `setInterval` + `tipIndex` state
- "Plus tard": `dismissTip(key)` then advance tipIndex (24h TTL per HOME-03)
- "J'applique": `dismissTip(key + '_apply')` then advance tipIndex; routing by key: `hydration` → fireAndForget + invalidate, `habit` → navigate to habits/dashboard
- `AI_TIPS` constant fully removed

**QuickLog (4 cells):**
- Water: `fireAndForget('hydration_log', {amount_ml: 250})` + `queryClient.invalidateQueries(['hydration','today'])` + 2s confirmation state
- Mood: opens Modal with 5 emojis (Unicode escapes), calls `journal_log_mood` fire-and-forget
- Weight: opens Modal with TextInput (decimal-pad), Confirmer disabled when invalid, calls `measurements_log` fire-and-forget
- Meal: `router.push('/(app)/(plugins)/nutrition/log')` — no API call

**SmartActions ("Pour toi maintenant"):**
- `useSmartActions({hour, nutritionPct, hydrationPct: waterPct, sleepPct}, router.push)` → max 2 actions
- Horizontal ScrollView with 232px cards, tintColor icon tile, tag/title/subtitle

**PluginsDrawer (HOME-08):**
- `useQuery(['user_plugins', userId])` fetches `user_plugins WHERE is_enabled=true`, maps to `plugin_id[]`
- Passed as `installedPluginIds` to `<PluginsDrawer>` from `@ziko/ui`

**Fixture purge:**
- Removed: `AI_TIPS`, `EMPTY`, `const PROFILE`, `const STREAK`, `const TODAY`, `const FORME`
- Removed: all `try { require('@ziko/plugin-sleep/hydration/journal/measurements') } catch {}` blocks
- Removed: `useSleepStore`, `useHydrationStore`, `useJournalStore`, `useMeasurementsStore` usages
- Removed: local `FormRing`, local `AICoachInline`, local `PluginsDrawer`, local `QuickLogSheet`, local `QuickLogRow` sub-components (all inlined or replaced)
- Removed: `useWorkoutStore` import and all its usages

**Root ScrollView:** `paddingBottom: 100` (tab bar clearance per CLAUDE.md)

### `packages/ui/src/components/PluginsDrawer.tsx`

- Added optional `installedPluginIds?: string[]` prop to `PluginsDrawerProps`
- Component body: `const pluginIds = installedPluginIds ?? registryPlugins;` (renamed old `installedPlugins` to `registryPlugins` for clarity)
- Render loop changed from `installedPlugins.map(...)` to `pluginIds.map(...)`
- Backward compatible: other callers that don't pass the prop still use the in-memory registry

## Deviations from Plan

**1. [Rule 2 - Missing critical functionality] onRefresh uses queryClient.invalidateQueries**
- The plan described the old pattern using `useHydrationStore.setState({_loaded: false})` to trigger plugin store reloads
- After the fixture purge those stores are gone — replaced with `queryClient.invalidateQueries` on all 7 wellness query keys
- Behavioral outcome is equivalent; data reloads on pull-to-refresh via TanStack Query

**2. [Rule 2 - Missing null guard] tips.length guard in setInterval effect**
- Added `if (tips.length === 0) return;` guard before registering the interval
- `computeTips` always returns at least 1 tip (default motivational), so this guard is defensive only

## Known Stubs

**Habit tip (HOME-03 rule 3):** `unmetHabitName` is hardcoded to `undefined` in `useAITips` call. The habit tip rule only fires when an unmet habit name is available. Wiring requires `useHabitsToday` hook — deferred to Phase 37.

Two of three tip rules (sleep_good, hydration) deliver HOME-03 compliant behavior. The habit tip is explicitly deferred per plan annotation.

## Threat Flags

No new network endpoints. Two boundaries:
- T-33-04-01 mitigated: `fireAndForget` reads session fresh via `supabase.auth.getSession()` and returns early if no session
- T-33-04-02 mitigated: `parseFloat(weightInput)` with `Number.isFinite` guard; Confirmer button disabled when invalid
- T-33-04-04 mitigated: `enabled: !!userId` on user_plugins query; RLS enforced at DB level

## Verification Results

| Check | Command | Expected | Result |
|-------|---------|----------|--------|
| Fixture purge | grep -c `PROFILE\|STREAK\|TODAY\|FORME\|AI_TIPS\|EMPTY` | 0 | 0 |
| No require() | grep -c `require('@ziko/plugin-` | 0 | 0 |
| fireAndForget | grep -c `ai/tools/execute` | >=1 | 1 |
| PluginsDrawer | grep -c `visible={drawerOpen}` | 1 | 1 |
| user_plugins query | grep -c `user_plugins` | >=1 | 3 |
| installedPluginIds prop | grep -c in PluginsDrawer.tsx | >=2 | 3 |
| TypeScript errors | grep -c `error TS` in index.tsx scope | 0 | 0 (2 pre-existing in unrelated files) |

## Self-Check: PASSED

- [x] `apps/mobile/app/(app)/index.tsx` — FOUND (509 insertions, 433 deletions)
- [x] `packages/ui/src/components/PluginsDrawer.tsx` — FOUND (installedPluginIds prop added)
- [x] Commit c4a7ac6 — FOUND
- [x] `@ziko/ui FormRing` imported and used with score + 4 parts (max: 100 each)
- [x] `useProfile` wired for first name in Header
- [x] `useStreak` wired for streak chip
- [x] `useSleepToday/useHydrationToday/useNutritionToday` wired for wellness percentages
- [x] `useAITips` result drives AICoachInline (no AI_TIPS constant)
- [x] `dismissTip` called on both buttons with 24h window
- [x] `fireAndForget` function defined and used for water/mood/weight
- [x] Water QuickLog invalidates `['hydration', 'today']` TQ cache
- [x] Mood bottom sheet with 5 emojis opens via Modal
- [x] Weight bottom sheet with TextInput opens via Modal
- [x] Meal navigates to nutrition/log (no API call)
- [x] `useSmartActions` wired to render SmartActions section
- [x] `user_plugins` query added with `enabled: !!userId` guard
- [x] `installedPluginIds` passed to PluginsDrawer
- [x] All cross-plugin `require()` blocks removed
- [x] All fixture constants removed
- [x] `paddingBottom: 100` on root ScrollView
- [x] TypeScript: 0 new errors (2 pre-existing in unrelated files)
