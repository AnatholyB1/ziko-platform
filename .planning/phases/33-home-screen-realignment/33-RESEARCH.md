# Phase 33: Home Screen Realignment — Research

**Researched:** 2026-05-21
**Domain:** React Native / Expo home screen — data integration, animation, DS component assembly
**Confidence:** HIGH

---

## Summary

Phase 33 is a data-wiring and layout-assembly phase, not a ground-up build. The home screen (`apps/mobile/app/(app)/index.tsx`) already exists with all 9 sections rendering and most data partially wired via Zustand stores. The task is to:

1. Replace the hybrid Zustand-store / direct-plugin-store data access with clean TanStack Query hooks
2. Migrate inline local components (FormRing, WeekStrip, PluginsDrawer) to the Phase 32 DS versions from `@ziko/ui`
3. Add missing data connections: `nutrition_logs` (calorie totals), `habit_logs` (streak), `ai_generated_programs` (MissionCard)
4. Wire QuickLog fire-and-forget to `POST /ai/tools/execute`
5. Implement the rule-based AICoachInline tips engine with MMKV dismissal persistence
6. Apply the pixel-exact layout spec from `33-UI-SPEC.md` — typography exceptions, spacing overrides, animation stagger

The existing home screen covers roughly 70% of the target. The remaining 30% is: correct DS component substitution, nutrition data hook, habit-streak computation from `habit_logs`, AICoachInline rule-based engine with MMKV state, SmartActions time-of-day logic, and animation passes using react-native-reanimated v3.

**Primary recommendation:** Write one custom hook file (`hooks/useHomeData.ts`) that consolidates all TanStack Query calls, then assemble the final screen layout against the UI-SPEC pixel spec. Do not attempt to wire animations before the data layer is solid.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| User profile + name | Mobile (TanStack Query → Supabase) | Zustand authStore cache | Name available in authStore.profile already; TQ adds stale-while-revalidate |
| Streak computation | Mobile (computed from TanStack Query result) | — | Pure derivation from `habit_logs` or `workout_sessions` data |
| FormeDuJour score | Mobile (computed) | — | 4 independent queries combined; weighted average is client-side math |
| Sleep data | Mobile (TanStack Query → `sleep_logs`) | — | Replaces Zustand sleep store cross-plugin pattern |
| Hydration data | Mobile (TanStack Query → `hydration_logs`) | — | Replaces Zustand hydration store cross-plugin pattern |
| Nutrition calorie total | Mobile (TanStack Query → `nutrition_logs`) | — | Missing in current code — must be added |
| Active program / MissionCard | Mobile (TanStack Query → `ai_generated_programs`) | workoutStore fallback | `ai_generated_programs` (AI-created) is the source; `workout_programs` is coach-assigned fallback |
| QuickLog mutations | Mobile → Hono API `POST /ai/tools/execute` | Direct Supabase fallback | Existing API endpoint already registered for all 3 tools |
| AICoachInline tips | Mobile (rule-based derivation from query data) | MMKV for dismissal timestamps | Rule engine is pure TS, no AI call |
| SmartActions cards | Mobile (computed from time + FORME data) | — | Time-of-day and deficit logic is client-side |
| WeekStrip session dots | Mobile (from workoutSessions TQ query) | — | Reuses weekly sessions query |
| Recent sessions | Mobile (TanStack Query → `workout_sessions` limit 3) | — | Already partially done via workoutStore |
| PluginsDrawer plugin list | Mobile (usePluginRegistry from plugin-sdk) | — | Registry already loaded at app boot; no extra query needed |

---

## Current State vs Target State

### What the current `apps/mobile/app/(app)/index.tsx` already does

[VERIFIED: direct file read]

- Header: renders `profile.name` from authStore — correct field (`name`, NOT `first_name`). StreakChip uses warm amber background + emoji flame — needs redesign to match spec (orange chip, Ionicons flame icon, `rgba(255,92,26,0.10)` bg).
- FormeDuJour: renders local FormRing (SIZE=140, not 160). Wires sleep and hydration from try/catch Zustand cross-plugin stores. Nutrition is hardcoded `50`. Must replace with @ziko/ui FormRing (size=160) and TanStack Query.
- MissionCard: uses `workout_programs` (`activeProgram.program_workouts`) — the current active program is a coach-assigned `workout_programs` row. The UI-SPEC says `ai_generated_programs`. Both tables exist; plan must handle BOTH sources or confirm priority.
- AICoachInline: renders static `AI_TIPS` array (3 tips), rotates every 6.5s. No rule-based logic, no dismissal. Must add rule engine + MMKV dismiss timestamps.
- QuickLog: water calls `useHydrationStore.getState().logWater?.(supabase, 250)` (direct plugin store). Mood calls `useJournalStore.getState().logMood?.(supabase, m)`. Weight navigates to measurements screen (not an API call). Meal navigates to `/(app)/(plugins)/nutrition/log`. Must migrate to `POST /ai/tools/execute` fire-and-forget per UI-SPEC.
- WeekStrip: uses local component (not @ziko/ui WeekStrip). Uses `workout_sessions` from workoutStore. Must replace with @ziko/ui WeekStrip but the @ziko/ui WeekStrip has different props (`selectedDate`/`onSelect`/`dotDates`) — adapter needed for the "done state" / "scheduled" states required by the home spec.
- Recent: renders `recentSessions.slice(0,3)` from workoutStore. Shows sessions from `workout_sessions`. Missing PR chip, volume display already present.
- PluginsDrawer: uses local component (not @ziko/ui PluginsDrawer). Already uses `usePluginRegistry` for plugin list. Must swap to @ziko/ui PluginsDrawer.

### Key mismatches requiring fixes

[VERIFIED: direct file read + UI-SPEC comparison]

| Item | Current | Target | Gap |
|------|---------|--------|-----|
| Header StreakChip | Emoji flame, amber bg | Ionicons `flame`, `rgba(255,92,26,0.10)` bg | Style only |
| FormRing size | 140px | 160px (from @ziko/ui) | Swap component |
| Nutrition pct | Hardcoded 50 | TQ `nutrition_logs` today sum / TDEE | New query |
| MissionCard source | `workout_programs` | `ai_generated_programs` (primary) | New TQ query |
| MissionCard empty state | Minimal TouchableOpacity | Full dark hero empty spec | New layout |
| AICoachInline gradient | `backgroundColor: theme.surface` | `expo-linear-gradient` gradient bg | Wrap in LinearGradient |
| AICoachInline tips | Static 3-tip array | Rule-based from user data | Rule engine |
| AICoachInline dismiss | None | MMKV 6h/24h timestamp | MMKV key |
| QuickLog water | Direct hydration store call | `POST /ai/tools/execute` fire-and-forget | API swap |
| QuickLog water label | Static "+250ml" | Dynamic "X.XXL" total + confirmation badge | State update |
| QuickLog mood | Direct journal store call + Modal | Bottom sheet (5-emoji), then API | UI + API swap |
| QuickLog weight | Navigates to measurements | Bottom sheet with numeric input, then API | UI + API swap |
| WeekStrip component | Local, only done/today states | @ziko/ui WeekStrip with "scheduled" dashed border | Adapter needed |
| WeekStrip "scheduled" logic | Not implemented | Derive from `ai_generated_programs.program_data` days | New logic |
| SmartActions | Static 2-card fixture | Time-of-day + deficit computed | Rule engine |
| Section header style | `fontSize: 13, fontWeight: '700'` | `fontSize: 11, fontWeight: '700', uppercase, letterSpacing` | Style update |
| PluginsDrawer | Local component | @ziko/ui PluginsDrawer | Swap component |
| Entrance animation | None | Reanimated FadeIn + section staggering | Animation pass |

---

## Standard Stack

### Core (all pre-installed, verified in codebase)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@tanstack/react-query` | ^5.62.0 | Server state, caching, stale-while-revalidate | [VERIFIED: package.json] — QueryClient mounted in `_layout.tsx` |
| `react-native-reanimated` | ~4.1.1 | Entrance animations, ring arc, stagger | [VERIFIED: package.json] |
| `moti` | ^0.29.0 | MotiView for skeleton pulse, PluginsDrawer slide | [VERIFIED: package.json] |
| `expo-linear-gradient` | ~15.0.8 | AICoachInline gradient background | [VERIFIED: package.json] |
| `react-native-svg` | ^15.12.1 | FormRing SVG circles (via @ziko/ui FormRing) | [VERIFIED: package.json] |
| `react-native-mmkv` | — | Dismiss timestamps for AICoachInline tips | [ASSUMED] — present in CLAUDE.md stack; verify in package.json |
| `date-fns` | — | Week computation, date formatting | [VERIFIED: used in existing index.tsx] |
| `@ziko/ui` | internal | FormRing, AISuggestion, WeekStrip, PluginsDrawer, Skeleton | [VERIFIED: packages/ui/src/index.ts exports all] |
| `@ziko/plugin-sdk` | internal | useThemeStore, usePluginRegistry, useTranslation | [VERIFIED: existing imports] |

### No new packages required

All dependencies for Phase 33 are already installed. No `npm install` step is needed.

---

## Package Legitimacy Audit

> No external packages are being installed in this phase. All dependencies are pre-installed workspace packages or existing app dependencies.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
HomeScreen (apps/mobile/app/(app)/index.tsx)
  │
  ├─ useHomeData() hook (new: hooks/useHomeData.ts)
  │    ├─ useProfile()         → TQ ['profile']      → supabase.user_profiles
  │    ├─ useStreak()          → TQ ['streak']        → supabase.habit_logs (consecutive days)
  │    ├─ useSleepToday()      → TQ ['sleep','today'] → supabase.sleep_logs (latest)
  │    ├─ useHydrationToday()  → TQ ['hydration','today'] → supabase.hydration_logs (sum today)
  │    ├─ useNutritionToday()  → TQ ['nutrition','today'] → supabase.nutrition_logs (sum today)
  │    ├─ useWeeklySessions()  → TQ ['workouts','weekly'] → supabase.workout_sessions (this week)
  │    ├─ useActiveProgram()   → TQ ['program','active'] → supabase.ai_generated_programs (is_active=true)
  │    ├─ useRecentSessions()  → TQ ['workouts','recent'] → supabase.workout_sessions (limit 3)
  │    └─ useInstalledPlugins() → usePluginRegistry (already loaded at boot, no extra query)
  │
  ├─ useAITips(homeData)       → rule engine (pure TS, derived from homeData)
  ├─ useDismissedTips()        → MMKV read/write (dismiss timestamps)
  ├─ useSmartActions(homeData) → time-of-day + deficit logic (pure TS)
  │
  ├─ QuickLog mutations
  │    ├─ logWater()           → POST /ai/tools/execute {tool:'hydration_log', input:{amount_ml:250}}
  │    ├─ logMood(n)           → POST /ai/tools/execute {tool:'journal_log_mood', input:{mood:n, context}}
  │    └─ logWeight(kg)        → POST /ai/tools/execute {tool:'measurements_log', input:{weight_kg:kg}}
  │
  └─ Renders (all sections use inline styles, no StyleSheet)
       Header → FormeDuJour (@ziko/ui FormRing) → MissionCard → AICoachInline
       → SmartActions → QuickLog → WeekStrip (@ziko/ui) → Recent → PluginsDrawer CTA
       → @ziko/ui PluginsDrawer (Modal)
```

### Recommended File Structure

```
apps/mobile/app/(app)/
  index.tsx                      ← home screen (refactored)

apps/mobile/src/hooks/
  useHomeData.ts                 ← all TanStack Query hooks for home screen
  useAITips.ts                   ← rule-based tips engine
  useSmartActions.ts             ← time-of-day smart actions logic

apps/mobile/src/lib/
  supabase.ts                    ← existing, no change
  homeApi.ts                     ← fire-and-forget QuickLog API calls (POST /ai/tools/execute)
```

### Pattern 1: TanStack Query direct Supabase hook

```typescript
// Source: [ASSUMED] — standard TanStack Query v5 + Supabase pattern used in settings.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export function useNutritionToday() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['nutrition', 'today', userId],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('nutrition_logs')
        .select('calories, protein_g, carbs_g, fat_g')
        .eq('user_id', userId!)
        .eq('date', today);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}
```

### Pattern 2: Streak computation from habit_logs

```typescript
// Source: [ASSUMED] based on habit_logs schema (user_id, habit_id, date) in migration 002
// Streak = max consecutive days (descending from today) where at least 1 log exists
export function useStreak(userId: string | undefined) {
  return useQuery({
    queryKey: ['streak', userId],
    queryFn: async () => {
      // Pull last 60 days of habit_logs, deduplicate by date
      const { data } = await supabase
        .from('habit_logs')
        .select('date')
        .eq('user_id', userId!)
        .gte('date', new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0])
        .order('date', { ascending: false });
      const uniqueDays = new Set((data ?? []).map((r: any) => r.date));
      let streak = 0;
      let date = new Date();
      date.setHours(0, 0, 0, 0);
      while (uniqueDays.has(date.toISOString().split('T')[0])) {
        streak++;
        date = new Date(date.getTime() - 86400000);
      }
      return streak;
    },
    enabled: !!userId,
  });
}
```

### Pattern 3: AI-generated program MissionCard query

```typescript
// Source: [VERIFIED: migration 012] — ai_generated_programs has is_active BOOLEAN
// program_data JSONB contains session/workout definitions
export function useActiveAIProgram(userId: string | undefined) {
  return useQuery({
    queryKey: ['program', 'active', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_generated_programs')
        .select('*')
        .eq('user_id', userId!)
        .eq('is_active', true)
        .single();
      return data ?? null; // null → empty state
    },
    enabled: !!userId,
  });
}
```

### Pattern 4: QuickLog fire-and-forget via Hono API

```typescript
// Source: [VERIFIED: backend/api/src/tools/hydration.ts + registry.ts]
// The API endpoint POST /ai/tools/execute accepts {tool, input}
// Auth: Bearer token from supabase session
async function fireAndForget(tool: string, input: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  fetch(`${apiUrl}/ai/tools/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ tool, input }),
  }).catch(() => {}); // fire-and-forget, silent error
}
// Usage:
fireAndForget('hydration_log', { amount_ml: 250 });
fireAndForget('journal_log_mood', { mood: n, context: 'morning' });
fireAndForget('measurements_log', { weight_kg: kg });
```

### Pattern 5: MMKV tip dismissal state

> **SUPERSEDED — Use appStorage (AsyncStorage wrapper) from apps/mobile/src/lib/storage.ts per useAIDailyTip.ts pattern. MMKV is NOT installed. See plan 33-02 for implementation.**

```typescript
// Source: [ASSUMED] — MMKV is in stack per CLAUDE.md; verify import path
import { MMKV } from 'react-native-mmkv';
const storage = new MMKV({ id: 'home-tips' });

function isDismissed(tipKey: string, hoursWindow: number): boolean {
  const ts = storage.getNumber(`tip_dismissed_${tipKey}`);
  if (!ts) return false;
  return Date.now() - ts < hoursWindow * 3600 * 1000;
}
function dismissTip(tipKey: string) {
  storage.set(`tip_dismissed_${tipKey}`, Date.now());
}
```

### Pattern 6: Rule-based AICoachInline tips engine

```typescript
// Source: UI-SPEC section "AICoachInline Tip Rotation"
// 3 tips derived from user data: sleep_score, hydration_deficit, unmet_habit
// Rules (in priority order):
//   1. sleep_score >= 70%: pre-workout tip
//   2. hydration_ml < 50% of goal: hydration tip
//   3. any unmet habit by midday: habit tip
//   4. default tip (always shown if others dismissed)
function computeTips(data: HomeData): Tip[] {
  const tips: Tip[] = [];
  const sleepPct = data.sleepDurationH / (data.sleepTargetH || 8);
  if (sleepPct >= 0.7) {
    tips.push({ key: 'sleep_good', tag: 'Pré-séance',
      text: `Tu as bien dormi (${Math.floor(data.sleepDurationH)}h${Math.round((data.sleepDurationH % 1)*60)}). Bon créneau pour pousser — vise +2.5 kg sur ta dernière série.` });
  }
  if (data.hydrationMl < data.hydrationGoalMl * 0.5) {
    const deficit = Math.round(data.hydrationGoalMl - data.hydrationMl);
    tips.push({ key: 'hydration', tag: 'Hydratation',
      text: `Il manque ${deficit}ml pour atteindre ta cible aujourd'hui. Bois un verre avant ta séance.` });
  }
  if (data.unmetHabitName && new Date().getHours() >= 12) {
    tips.push({ key: 'habit', tag: 'Habitude',
      text: `Tu n'as pas encore loggué ${data.unmetHabitName} aujourd'hui. 2 minutes suffisent.` });
  }
  tips.push({ key: 'default', tag: 'Coach Ziko',
    text: 'Consistance > intensité. Montre-toi aujourd\'hui, même 30 minutes, ça compte.' });
  return tips;
}
```

### Pattern 7: @ziko/ui WeekStrip adapter for home screen

The `@ziko/ui WeekStrip` has props `{ selectedDate, onSelect, dotDates }` but the home screen needs `done/today/scheduled/rest` states from the UI-SPEC. The Phase 32 WeekStrip does NOT implement the "scheduled (dashed border)" state [VERIFIED: read WeekStrip.tsx].

Two options:
- **Option A (recommended):** Use `@ziko/ui WeekStrip` as-is (renders dots) and add a thin wrapper card that adds the week count header row above it.
- **Option B:** Build a home-screen-specific `HomeWeekStrip` inline component (not from @ziko/ui) that implements the exact done/today/scheduled/rest state machine.

The UI-SPEC states "Reuses @ziko/ui WeekStrip component" but the @ziko/ui WeekStrip does NOT have the "scheduled (dashed border)" state. **Option B is safer** — build `HomeWeekStrip` as a local component in index.tsx rather than extending the @ziko/ui shared component with home-specific state logic. Mark as needing planner decision.

### Anti-Patterns to Avoid

- **Cross-plugin Zustand try/catch imports:** The current home screen uses `require('@ziko/plugin-sleep').useSleepStore` in a try/catch. Replace with direct TanStack Query → Supabase instead. The plugin stores should not be the data bus for the home screen.
- **StyleSheet.create:** Forbidden by CLAUDE.md. All styles must be inline objects.
- **Alert.alert:** Forbidden in plugins. Use `showAlert` from `@ziko/plugin-sdk`. (Home screen is not a plugin but follow the same convention for QuickLog error handling.)
- **No className=:** NativeWind not used in this codebase despite being installed.
- **WeekStrip "scheduled" state from program_data JSONB:** The `ai_generated_programs.program_data` has opaque JSONB structure — do not parse JSONB for day-of-week scheduled state in Phase 33. Use `workout_programs.program_workouts[].day_of_week` if needed, or simply show `done/today/rest` states only and mark scheduled as optional enhancement.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FormRing SVG ring | Custom Svg Circle logic | `FormRing` from `@ziko/ui` | Already built, typed, correct segment math |
| Plugin grid drawer | Custom Modal + FlatList | `PluginsDrawer` from `@ziko/ui` | Already built with navigation wiring |
| Skeleton shimmer | Custom Animated component | `Skeleton` from `@ziko/ui` (uses MotiView) | Already built, uses correct shimmer pattern |
| Section card wrapper | Custom View styles | `Card` from `@ziko/ui` | Already provides shadow/flat/outlined variants |
| Date arithmetic | Manual date math | `date-fns` `addDays`, `format`, `getDay` | Already in codebase, handles DST |
| Stagger animation | Manual setTimeout delays | `Animated.FadeInUp.delay(i * 60)` from reanimated | Built-in stagger API |

---

## Data Contract Details

### `user_profiles` columns available for home screen

[VERIFIED: migrations 001, 032, 034, 038]

| Column | Type | Available | Notes |
|--------|------|-----------|-------|
| `name` | TEXT | YES | The UI-SPEC uses "firstName" — the actual column is `name`. Extract first word: `name?.split(' ')[0]` |
| `goal` | TEXT | YES | For FormeDuJour copy |
| `weekly_goal` | — | **NO** | Column does NOT exist in schema. Use hardcoded `4` (current value) or store in Zustand. |
| `daily_water_goal_ml` | — | **NO** | Column does NOT exist. Use hardcoded `2500` ml or read from hydration plugin store. |
| `fitness_level` | TEXT | YES (migration 032) | |
| `workout_frequency` | TEXT | YES (migration 032) | Possible source for weeklyGoal ('2','3','4','5+') |

**Important:** `weekly_goal` and `daily_water_goal_ml` are referenced in the UI-SPEC data contract but do NOT exist as DB columns. The planner must use `workout_frequency` as the weekly goal proxy, and hardcode `2500` ml for hydration goal (or read from hydration plugin's Zustand store).

### `ai_generated_programs` vs `workout_programs`

[VERIFIED: migrations 001, 012]

The current home screen uses `workout_programs` (coach-assigned programs from `loadPrograms()`). The UI-SPEC targets `ai_generated_programs` for MissionCard. These are separate tables:

- `workout_programs` — coach-assigned or user-created structured programs with `program_workouts[]` joins
- `ai_generated_programs` — AI-generated, stores session plan in `program_data JSONB`, has `is_active` boolean

For Phase 33, the planner must decide: **use `ai_generated_programs` as primary source** (as UI-SPEC states). If no active AI program exists, fall back to the empty state. The existing `workout_programs` → MissionCard flow can optionally be retained as secondary fallback, but that adds complexity.

### `habit_logs` schema for streak

[VERIFIED: migration 002]

```sql
CREATE TABLE public.habit_logs (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id  UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  date      DATE NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(habit_id, date)
);
```

Streak = count of consecutive days (descending from today) where at least one `habit_logs` row exists for `user_id` with `completed = true`.

---

## Common Pitfalls

### Pitfall 1: WeekStrip "scheduled" state requires program data
**What goes wrong:** The UI-SPEC shows "scheduled" days with dashed orange border. Computing which future days are "scheduled" requires parsing `ai_generated_programs.program_data` JSONB (opaque structure) or `workout_programs.program_workouts[].day_of_week`.
**Why it happens:** The schema for `ai_generated_programs.program_data` is JSONB with no fixed schema.
**How to avoid:** In Phase 33, render only `done/today/rest` states for the WeekStrip (omit "scheduled"). The "scheduled" state is an enhancement for a later phase when the JSONB program_data structure is better documented.
**Warning signs:** If the plan tries to parse `program_data.sessions[].dayOfWeek` — that path may not exist.

### Pitfall 2: `user_profiles.name` vs `first_name`
**What goes wrong:** The UI-SPEC data contract says `user_profiles → first_name`. The actual column is `name`.
**Why it happens:** UI-SPEC was written ahead of schema verification.
**How to avoid:** Always use `profile.name?.split(' ')[0] ?? 'Athlete'` to extract first name.

### Pitfall 3: `ai_generated_programs` has no `program_workouts` join
**What goes wrong:** The `ai_generated_programs` table stores workouts in `program_data JSONB`, not via a relational join. You cannot `.select('*, program_workouts(*)')` on it.
**Why it happens:** This table was designed for AI-generated content with flexible schema.
**How to avoid:** Read `program_data` as JSONB. The MissionCard needs to display the next session's name and exercises — those fields live inside `program_data`. Inspect the actual structure of a real row before planning the parse logic.
**Warning signs:** Any plan task that tries `supabase.from('ai_generated_programs').select('*, program_workouts(*)')`.

### Pitfall 4: AICoachInline gradient requires expo-linear-gradient wrapper
**What goes wrong:** The UI-SPEC requires a gradient background for AICoachInline: `rgba(255,92,26,0.06)` → `rgba(123,91,208,0.05)`. React Native's `backgroundColor` does not support gradients.
**Why it happens:** CSS gradients don't exist in React Native.
**How to avoid:** Wrap the AICoachInline View in `<LinearGradient>` from `expo-linear-gradient`. This package is pre-installed (`~15.0.8`).

### Pitfall 5: @ziko/ui WeekStrip props mismatch
**What goes wrong:** The UI-SPEC says "use @ziko/ui WeekStrip" but the @ziko/ui WeekStrip has `{ selectedDate, onSelect, dotDates }` props — designed for date-picker use cases, not the done/today/scheduled/rest state machine.
**Why it happens:** Phase 32 built the WeekStrip for plugin screens (habits, sleep). The home screen needs a different state rendering.
**How to avoid:** Build `HomeWeekStrip` as a local component in index.tsx implementing the exact 4-state visual spec. Alternatively, extend the @ziko/ui WeekStrip in Phase 32 cleanup with `sessionDates` and `scheduledDates` props.

### Pitfall 6: MissionCard duration not in `ai_generated_programs`
**What goes wrong:** The MissionCard sub-line shows `~{duration} min`. The `ai_generated_programs` schema has no `duration` column — only `program_data JSONB`.
**Why it happens:** Duration is implicit in the program structure.
**How to avoid:** Parse `program_data` to compute or read duration, or show a static estimate.

### Pitfall 7: Fire-and-forget QuickLog + TQ invalidation
**What goes wrong:** After water QuickLog fires, the hydration TQ cache is stale. The FormeDuJour water segment won't update.
**Why it happens:** TanStack Query won't know the underlying data changed.
**How to avoid:** After a successful fire-and-forget, call `queryClient.invalidateQueries({ queryKey: ['hydration', 'today'] })`. Use `useQueryClient()` hook inside QuickLog handlers.

---

## Schema Gap Analysis

These columns are referenced in the UI-SPEC but do NOT exist in the current schema:

| Referenced in UI-SPEC | Actual Schema | Fix |
|-----------------------|--------------|-----|
| `user_profiles.first_name` | `user_profiles.name` | Use `name.split(' ')[0]` |
| `user_profiles.daily_water_goal_ml` | Does not exist | Hardcode 2500ml or read hydration plugin store |
| `user_profiles.weekly_goal` | Does not exist | Read `workout_frequency` column (migration 032) as proxy |
| `user_profiles.sleep_goal` | Does not exist | Hardcode 8h target |

No migration is required for Phase 33 — use fallback values for missing columns.

---

## Phase 32 DS Components — Compatibility Summary

[VERIFIED: direct file reads of packages/ui/src/components/]

| Component | Exported from @ziko/ui | Props | Home-screen compatible? |
|-----------|----------------------|-------|------------------------|
| `FormRing` | YES | `{ score, parts: {value, max, color}[], size? }` | YES — `size={160}`, pass 4 parts with `value/max` |
| `AISuggestion` | YES | `{ text, actionLabel?, onAction?, tintColor? }` | PARTIAL — AICoachInline needs a different layout (horizontal row with avatar + two action buttons). Use `AISuggestion` style inspiration but build AICoachInline as a custom inline component. |
| `WeekStrip` | YES | `{ selectedDate, onSelect, dotDates? }` | NO for home spec — see Pitfall 5. Build `HomeWeekStrip` locally. |
| `PluginsDrawer` | YES | `{ visible, onClose, onNavigate }` | YES — direct drop-in, uses `usePluginRegistry` internally |
| `Skeleton` | YES | `{ width, height, borderRadius }` | YES — use for all skeleton states |
| `Card` | YES | `{ children, padding, animate, delay, cardStyle }` | YES — use for section cards |

**Critical note:** The `@ziko/ui PluginsDrawer` renders "Tous les modules" as header — the UI-SPEC says "Tous mes outils". Update the @ziko/ui component OR accept the text difference. The CTA button on the home screen already says "Tous mes outils".

---

## Animation Implementation Guide

[VERIFIED: react-native-reanimated ~4.1.1 installed, moti ^0.29.0 installed]

Per the UI-SPEC Motion Design section:

```typescript
// 1. Screen entrance — wrap root Animated.ScrollView
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
<Animated.ScrollView entering={FadeIn.duration(250)}>

// 2. FormRing arc animation — only if @ziko/ui FormRing exposes animated variant
// Current FormRing is NOT animated (static SVG). Wrap with useAnimatedProps if needed.

// 3. Section stagger — wrap each major section
{sections.map((s, i) => (
  <Animated.View key={s.id} entering={FadeInUp.delay(i * 60).duration(150)}>
    {s.content}
  </Animated.View>
))}

// 4. QuickLog press scale
const scale = useSharedValue(1);
const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
// onPressIn: scale.value = withSpring(0.96)
// onPressOut: scale.value = withSpring(1.0)

// 5. Skeleton pulse — use Skeleton from @ziko/ui (already uses MotiView internally)
import { Skeleton } from '@ziko/ui';
<Skeleton width={160} height={160} borderRadius={80} />  // FormRing skeleton

// 6. PluginsDrawer slide — MotiView (moti) already used inside @ziko/ui PluginsDrawer
// Uses Modal animationType="slide" — verify if spec requires spring or timing
```

**Note:** The current @ziko/ui `FormRing` has no animated props. The 600ms arc animation from the spec requires either: (a) extending @ziko/ui FormRing to accept an `animated` prop, or (b) animating the score counter only (simpler). Recommend counting-up the score number only for Phase 33; arc animation is an enhancement.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@tanstack/react-query` | All data hooks | YES | ^5.62.0 | — |
| `react-native-reanimated` | Animations | YES | ~4.1.1 | — |
| `moti` | Skeleton, drawer | YES | ^0.29.0 | — |
| `expo-linear-gradient` | AICoachInline bg | YES | ~15.0.8 | Use flat bg if unavailable |
| `react-native-svg` | FormRing (via @ziko/ui) | YES | ^15.12.1 | — |
| `react-native-mmkv` | Tip dismissal | [ASSUMED present] | — | Use AsyncStorage as fallback |
| Hono API `/ai/tools/execute` | QuickLog mutations | YES | deployed | Direct Supabase call as fallback |
| Supabase client | All queries | YES | authenticated | — |

**Missing dependencies with no fallback:** None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None configured for mobile (no jest.config found) |
| Config file | None — Wave 0 gap |
| Quick run command | Manual testing via Expo dev server |
| Full suite command | N/A |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HOME-01 | FormRing renders with real score | Manual smoke | Expo dev + inspect | N/A |
| HOME-02 | MissionCard shows program or empty | Manual smoke | Expo dev + toggle is_active | N/A |
| HOME-03 | AICoachInline rotates tips, J'applique/Plus tard work | Manual smoke | Expo dev | N/A |
| HOME-04 | QuickLog buttons log data + confirmation flash | Manual smoke | Expo dev + Supabase table check | N/A |
| HOME-05 | SmartActions time-of-day logic | Manual smoke | Expo dev at different hours | N/A |
| HOME-06 | WeekStrip session dots from workout_sessions | Manual smoke | Expo dev + log a session | N/A |
| HOME-07 | Recent shows 3 latest sessions | Manual smoke | Expo dev | N/A |
| HOME-08 | PluginsDrawer opens and navigates | Manual smoke | Expo dev | N/A |
| HOME-09 | Header shows name + streak | Manual smoke | Expo dev | N/A |
| HOME-10 | No fixture objects remain | Grep audit | `grep -r "const PROFILE\|const STREAK\|const TODAY\|const FORME\|const RECENT\|const ALL_PLUGINS" apps/mobile/app/(app)/index.tsx` | Manual |

### Wave 0 Gaps

- No automated test infrastructure configured for mobile — manual smoke testing via Expo dev is the validation method
- Grep command for HOME-10 verification should be included in the verification plan

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | YES — QuickLog calls Hono API | Bearer token from `supabase.auth.getSession()` |
| V3 Session Management | NO | Handled by Supabase Auth |
| V4 Access Control | YES — all Supabase queries | RLS policies enforce `auth.uid() = user_id` |
| V5 Input Validation | MINIMAL | Weight input (numeric keyboard) — no server-side concern for home screen |
| V6 Cryptography | NO | No new crypto |

**QuickLog API security:** The `POST /ai/tools/execute` endpoint requires a valid Supabase Bearer token. The fire-and-forget function must always include `Authorization: Bearer ${session.access_token}`. Silent failure on 401 is acceptable (fire-and-forget).

**MMKV data:** Only stores timestamps (numeric), not PII. No security concern.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `react-native-mmkv` is installed as a mobile app dependency | Standard Stack | If not installed, must use AsyncStorage for tip dismissal (slower but functional) |
| A2 | `ai_generated_programs.program_data` JSONB contains session name and exercise list accessible for MissionCard | Data Contract | If JSONB structure differs, MissionCard may need to display fallback info |
| A3 | The Hono API `/ai/tools/execute` endpoint accepts `{tool, input}` and requires Bearer token auth | QuickLog Pattern | Verified tool names in registry.ts; format ASSUMED from backend tool registration pattern |
| A4 | `usePluginRegistry` from `@ziko/plugin-sdk` exposes `installedPlugins` (not `enabledPlugins`) as the correct property name | PluginsDrawer | @ziko/ui PluginsDrawer uses `installedPlugins` per file read; current index.tsx uses `enabledPlugins` — verify which is correct |

---

## Open Questions (RESOLVED)

1. **MissionCard source: `ai_generated_programs` vs `workout_programs`** [RESOLVED]
   - What we know: Both tables exist. Current code uses `workout_programs`. UI-SPEC targets `ai_generated_programs`.
   - Resolution: Use `ai_generated_programs` as primary source (per UI-SPEC). Show empty state if no active AI program. The `workout_programs` path belongs to Phase 36 (Workout Stack Redesign). Implemented in plan 33-03 Task 1.

2. **`program_data` JSONB structure for MissionCard exercise list** [RESOLVED]
   - What we know: `ai_generated_programs.program_data` is JSONB with no enforced schema.
   - Resolution: Defensive access pattern adopted in plan 33-03: `program_data?.sessions ?? program_data?.workouts ?? []`. Executor inspects real row shape at runtime; fallbacks handle all JSONB variants. Duration defaults to 45 min if not present in JSONB.

3. **WeekStrip "scheduled" state** [RESOLVED]
   - What we know: The UI-SPEC shows dashed orange border for scheduled days. Computing "scheduled" requires knowing the user's training days.
   - Resolution: "Scheduled" state omitted from Phase 33. HomeWeekStrip renders only done/today/rest states. Scheduled state deferred to Phase 36 when ai_generated_programs.program_data structure is documented. Decision recorded in plan 33-03 PATTERNS and action.

4. **`usePluginRegistry` property name: `installedPlugins` vs `enabledPlugins`** [RESOLVED]
   - What we know: @ziko/ui PluginsDrawer uses `installedPlugins`. The home screen index.tsx uses `enabledPlugins`.
   - Resolution: `packages/plugin-sdk/src/hooks.ts` verified — both `installedPlugins` and `enabledPlugins` exist as separate arrays. PluginsDrawer correctly uses `installedPlugins`. HOME-08 is now served by a TQ query against `user_plugins` (is_enabled=true) passed as `installedPluginIds` prop, bypassing the Zustand registry for the home screen drawer. Implemented in plan 33-04 Task 2.
---

## Sources

### Primary (HIGH confidence)
- `apps/mobile/app/(app)/index.tsx` — direct file read, current home screen implementation
- `packages/ui/src/components/*.tsx` — direct file reads, Phase 32 DS components
- `packages/ui/src/index.ts` — verified exports
- `packages/ui/src/components.tsx` — verified Skeleton, Card exports
- `supabase/migrations/001_initial_schema.sql` — user_profiles schema
- `supabase/migrations/012_new_plugins_schema.sql` — ai_generated_programs schema
- `supabase/migrations/032_onboarding_profile_fields.sql` — workout_frequency column
- `apps/mobile/app/_layout.tsx` — QueryClient setup confirmed
- `apps/mobile/src/stores/workoutStore.ts` — workout_programs query pattern
- `backend/api/src/tools/hydration.ts` — hydration_log tool
- `backend/api/src/tools/registry.ts` (inferred) — tool names: hydration_log, journal_log_mood, measurements_log
- `apps/mobile/app/(app)/profile/settings.tsx` — TanStack Query usage pattern in mobile app
- `.planning/phases/33-home-screen-realignment/33-UI-SPEC.md` — pixel-for-pixel design contract
- `C:/Users/Anatholy/Downloads/ziko/home.jsx` — canonical mockup

### Secondary (MEDIUM confidence)
- `apps/mobile/package.json` — dependency versions (react-native-reanimated ~4.1.1, moti ^0.29.0, expo-linear-gradient ~15.0.8, @tanstack/react-query ^5.62.0, react-native-svg ^15.12.1)

---

## Metadata

**Confidence breakdown:**
- Current screen state: HIGH — read source directly
- DS component compatibility: HIGH — read all Phase 32 component files
- Data schema: HIGH — read all relevant migrations
- TanStack Query patterns: HIGH — verified in settings.tsx
- MMKV tip dismissal: LOW (A1 assumption) — not found in search results
- ai_generated_programs JSON structure: LOW (A2 assumption) — schema only, no example data
- Animation API: HIGH — reanimated v4 API verified in existing usage + UI-SPEC

**Research date:** 2026-05-21
**Valid until:** 2026-06-21 (stable codebase, no fast-moving dependencies)
