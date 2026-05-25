# Phase 33: Home Screen Realignment — Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 4 new/modified files
**Analogs found:** 4 / 4

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/mobile/app/(app)/index.tsx` | screen (modify) | CRUD + event-driven | self (current file) | exact — refactor in place |
| `apps/mobile/src/hooks/useHomeData.ts` | hook | CRUD (read-only, multi-query) | `apps/mobile/app/(app)/profile/settings.tsx` (useQuery) | role-match |
| `apps/mobile/src/hooks/useAITips.ts` | hook | transform (pure derivation) | `apps/mobile/src/hooks/useAIDailyTip.ts` | role-match |
| `apps/mobile/src/hooks/useSmartActions.ts` | hook | transform (pure derivation) | `apps/mobile/src/hooks/useAIDailyTip.ts` | role-match |

> `apps/mobile/src/lib/homeApi.ts` is a minor utility (fire-and-forget fetch). Pattern is embedded in the index.tsx section below — no separate analog needed.

---

## Pattern Assignments

### `apps/mobile/app/(app)/index.tsx` (screen, CRUD + event-driven)

**Analog:** Self — the existing file is the target file. Refactor in place.

**Current imports block** (`index.tsx` lines 1–17):
```typescript
import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useAuthStore } from '../../src/stores/authStore';
import { useWorkoutStore } from '../../src/stores/workoutStore';
import { supabase } from '../../src/lib/supabase';
import { usePluginRegistry } from '@ziko/plugin-sdk';
import { useTranslation } from '@ziko/plugin-sdk';
import { useThemeStore } from '../../src/stores/themeStore';
import { format, startOfDay, differenceInCalendarDays, addDays, getDay } from 'date-fns';
import type { ProgramExercise } from '@ziko/plugin-sdk';
```

**Target imports block** (replace the above — adds TanStack Query, Reanimated, LinearGradient, @ziko/ui, QueryClient):
```typescript
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import Animated, { FadeIn, FadeInUp, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useQueryClient } from '@tanstack/react-query';
import { FormRing, PluginsDrawer, Skeleton } from '@ziko/ui';
import { useThemeStore } from '../../src/stores/themeStore';
import { useAuthStore } from '../../src/stores/authStore';
import { usePluginRegistry } from '@ziko/plugin-sdk';
import { format, startOfDay, differenceInCalendarDays, addDays, getDay } from 'date-fns';
import { useProfile, useStreak, useSleepToday, useHydrationToday, useNutritionToday, useWeeklySessions, useActiveAIProgram, useRecentSessions, HOME_DEFAULTS, parseWorkoutFrequency } from '../../src/hooks/useHomeData';
import { useAITips } from '../../src/hooks/useAITips';
import { useSmartActions } from '../../src/hooks/useSmartActions';
import { appStorage } from '../../src/lib/storage';
```

**Fixtures to delete** — search for these constants in the current file and remove them:
```
const AI_TIPS = [...]          // static tips array — replaced by useAITips
// Also remove all cross-plugin require() blocks:
let useSleepStore: any = null;
try { useSleepStore = require(...) } catch {}
// same for useHydrationStore, useJournalStore, useMeasurementsStore
```

**Greeting pattern** (lines 515–520, keep as-is):
```typescript
const greeting = React.useMemo(() => {
  const h = new Date().getHours();
  if (h < 12) return 'Bon matin';
  if (h < 18) return 'Bon aprem';
  return 'Bonsoir';
}, []);
```

**StreakChip target pattern** (replaces amber bg emoji chip at lines 579–584):
```typescript
{streak > 0 && (
  <View style={{
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,92,26,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,92,26,0.20)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
  }}>
    <Ionicons name="flame" size={13} color="#FF5C1A" />
    <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#FF5C1A' }}>
      {streak} jours
    </Text>
  </View>
)}
```

**FormRing (@ziko/ui) invocation pattern** — replaces local `<FormRing parts={...} />`:
```typescript
// @ziko/ui FormRing signature: { score, parts: {value, max, color}[], size? }
// The local FormRing uses { parts: {value, color}[] } — DIFFERENT prop shape.
// Convert: value = sleepPct (0-100), max = 100, color = as-is.
<FormRing
  score={score}
  size={160}
  parts={[
    { value: sleepPct,     max: 100, color: '#8B5CF6' },
    { value: waterPct,     max: 100, color: '#3B82F6' },
    { value: nutritionPct, max: 100, color: '#FF5C1A' },
    { value: loadPct,      max: 100, color: '#22C55E' },
  ]}
/>
```

**AICoachInline LinearGradient wrapper pattern** (lines 213–258, wrap `<View>` in `<LinearGradient>`):
```typescript
<LinearGradient
  colors={['rgba(255,92,26,0.06)', 'rgba(123,91,208,0.05)']}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
  style={{
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,92,26,0.22)',
  }}
>
  {/* existing AICoachInline row content */}
</LinearGradient>
```

**PluginsDrawer @ziko/ui invocation** (replaces local `<PluginsDrawer>` defined at lines 376–429):
```typescript
// @ziko/ui PluginsDrawer signature: { visible, onClose, onNavigate }
// The local one uses `open` prop — target uses `visible`.
<PluginsDrawer
  visible={drawerOpen}
  onClose={() => setDrawerOpen(false)}
  onNavigate={(path) => router.push(path as any)}
/>
```
Note: `@ziko/ui PluginsDrawer` reads `installedPlugins` (not `enabledPlugins`) from `usePluginRegistry`.
Note: Its header text says "Tous les modules" (not "Tous mes outils") — acceptable for Phase 33.

**QuickLog fire-and-forget pattern** (replaces direct plugin-store calls at lines 744–776):
```typescript
// In homeApi.ts or inline in index.tsx handlers:
async function fireAndForget(tool: string, input: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  fetch(`${process.env.EXPO_PUBLIC_API_URL}/ai/tools/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ tool, input }),
  }).catch(() => {}); // silent fire-and-forget
}

// Usage in handlers (add queryClient.invalidateQueries after each):
const queryClient = useQueryClient();
const handleLogWater = () => {
  fireAndForget('hydration_log', { amount_ml: 250 });
  queryClient.invalidateQueries({ queryKey: ['hydration', 'today'] });
};
const handleLogMood = (n: number) => {
  fireAndForget('journal_log_mood', { mood: n, context: 'morning' });
};
const handleLogWeight = (kg: number) => {
  fireAndForget('measurements_log', { weight_kg: kg });
};
```

**Reanimated entrance stagger pattern** (wrap each section View):
```typescript
// Wrap root ScrollView:
<Animated.ScrollView entering={FadeIn.duration(250)} ...>

// Wrap each major section (FormeDuJour, MissionCard, AICoachInline, etc.):
{SECTIONS.map((section, i) => (
  <Animated.View key={section.key} entering={FadeInUp.delay(i * 60).duration(150)}>
    {section.content}
  </Animated.View>
))}

// QuickLog press scale:
const scale = useSharedValue(1);
const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
// onPressIn: scale.value = withSpring(0.96)
// onPressOut: scale.value = withSpring(1.0)
```

**Section header style** (replaces `fontSize: 13, fontWeight: '700'` used in lines 661, 679):
```typescript
// All section headers ("Quick log", "Cette semaine", "Récent", "Pour toi maintenant"):
<Text style={{
  fontSize: 11,
  fontWeight: '700',
  letterSpacing: 0.06 * 11,  // ~0.66px letterSpacing in RN
  textTransform: 'uppercase',
  color: '#6B6963',
  marginBottom: 10,
}}>
  {label}
</Text>
```

---

### `apps/mobile/src/hooks/useHomeData.ts` (hook, CRUD read-only)

**Analog:** `apps/mobile/app/(app)/profile/settings.tsx` — the only file in the mobile app using `useQuery` from TanStack Query (lines 312–327).

**Analog imports pattern** (settings.tsx lines 8–11):
```typescript
import { useQuery } from '@tanstack/react-query';
import { useThemeStore, showAlert, usePluginRegistry, useTranslation } from '@ziko/plugin-sdk';
import { useAuthStore } from '../../../src/stores/authStore';
import { supabase } from '../../../src/lib/supabase';
```

**Analog useQuery pattern** (settings.tsx lines 312–327):
```typescript
const { data: coachData } = useQuery({
  queryKey: ['coach-link-settings', profile?.id],
  queryFn: async () => {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;
    if (!token) return null;
    const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/coach/clients/links/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  },
  enabled: !!(role === 'client' || role === 'both') && !!profile?.id,
  staleTime: 30_000,
});
```

**Target hook file structure** — copy the useQuery call shape, adapt for each data source:

```typescript
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';

// ── useProfile ────────────────────────────────────────────────
export function useProfile() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('name, goal, workout_frequency, fitness_level')
        .eq('id', userId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 10,
  });
}

// ── useStreak ─────────────────────────────────────────────────
// Streak = consecutive days with at least 1 habit_log (completed=true)
export function useStreak() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['streak', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('habit_logs')
        .select('date')
        .eq('user_id', userId!)
        .eq('completed', true)
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
    staleTime: 1000 * 60 * 5,
  });
}

// ── useSleepToday ─────────────────────────────────────────────
export function useSleepToday() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['sleep', 'today', userId],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('sleep_logs')
        .select('duration_hours, quality, bedtime, wake_time')
        .eq('user_id', userId!)
        .eq('date', today)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 10,
  });
}

// ── useHydrationToday ─────────────────────────────────────────
export function useHydrationToday() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['hydration', 'today', userId],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('hydration_logs')
        .select('amount_ml')
        .eq('user_id', userId!)
        .eq('date', today);
      if (error) throw error;
      const totalMl = (data ?? []).reduce((s: number, r: any) => s + (r.amount_ml ?? 0), 0);
      return { totalMl };
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
  });
}

// ── useNutritionToday ─────────────────────────────────────────
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
      const totalCalories = (data ?? []).reduce((s: number, r: any) => s + (r.calories ?? 0), 0);
      return { totalCalories, logs: data ?? [] };
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

// ── useWeeklySessions ─────────────────────────────────────────
export function useWeeklySessions() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['workouts', 'weekly', userId],
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('id, started_at, name, total_volume_kg')
        .eq('user_id', userId!)
        .gte('started_at', weekAgo)
        .order('started_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

// ── useActiveAIProgram ────────────────────────────────────────
// Source: ai_generated_programs — verified in migration 012
export function useActiveAIProgram() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['program', 'active', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_generated_programs')
        .select('*')
        .eq('user_id', userId!)
        .eq('is_active', true)
        .maybeSingle();
      // Do NOT use .single() — returns error if no row; .maybeSingle() returns null
      if (error) throw error;
      return data ?? null;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 10,
  });
}

// ── useRecentSessions ─────────────────────────────────────────
export function useRecentSessions() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['workouts', 'recent', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('id, name, started_at, total_volume_kg, duration_seconds')
        .eq('user_id', userId!)
        .order('started_at', { ascending: false })
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

// ── useInstalledPlugins ───────────────────────────────────────
// No extra query needed — usePluginRegistry is already loaded at boot
// Access in component: usePluginRegistry((s) => s.installedPlugins)
// Note: PluginsDrawer from @ziko/ui uses `installedPlugins` (not `enabledPlugins`)
// Current index.tsx uses `enabledPlugins` — VERIFY which the home screen needs;
// the @ziko/ui PluginsDrawer handles its own registry access internally.
```

**Key schema notes:**
- `habit_logs` unique constraint is `(habit_id, date)` — NOT `(user_id, date)`. Query must `eq('user_id')` filter.
- `ai_generated_programs.is_active` is BOOLEAN (migration 012) — NOT `status = 'active'`. Use `.eq('is_active', true)`.
- `user_profiles` has no `first_name` column — use `profile.name?.split(' ')[0] ?? 'Athlete'`.
- `user_profiles` has no `daily_water_goal_ml` — hardcode `2500` for hydration goal.
- `user_profiles` has no `weekly_goal` — use `workout_frequency` column (migration 032) as proxy, or hardcode `4`.
- `ai_generated_programs` does NOT support `.select('*, program_workouts(*)')` — workouts are in `program_data JSONB`.

---

### `apps/mobile/src/hooks/useAITips.ts` (hook, transform)

**Analog:** `apps/mobile/src/hooks/useAIDailyTip.ts`

**Analog imports and state pattern** (useAIDailyTip.ts lines 1–18):
```typescript
import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { appStorage } from '../lib/storage';
import { supabase } from '../lib/supabase';

export interface DailyTip {
  tag: string;
  text: string;
  conversationId?: string;
}

type Status = 'idle' | 'loading' | 'ready' | 'dismissed' | 'error';
```

**Analog dismiss/cache pattern using appStorage** (useAIDailyTip.ts lines 43–52):
```typescript
const dismissed = await appStorage.getBoolean(DISMISSED_KEY);
if (dismissed) { setStatus('dismissed'); return; }

const cached = await appStorage.getString(CACHE_KEY);
if (cached) {
  try { setTip(JSON.parse(cached)); setStatus('ready'); return; } catch {}
}
// ...
await appStorage.set(CACHE_KEY, JSON.stringify(result));
```

**Target hook — useAITips.ts** (no AI call, pure derivation + appStorage dismiss timestamps):

```typescript
import { useState, useCallback, useMemo } from 'react';
import { appStorage } from '../lib/storage';

export interface Tip {
  key: string;
  tag: string;
  text: string;
}

export interface HomeDataForTips {
  sleepDurationH: number;
  sleepQuality: number;
  hydrationMl: number;
  hydrationGoalMl: number;
  unmetHabitName?: string;
}

// Rule engine — pure TS, no async, no AI call
function computeTips(data: HomeDataForTips): Tip[] {
  const tips: Tip[] = [];
  const sleepPct = data.sleepDurationH / 8; // target = 8h
  if (sleepPct >= 0.7) {
    const h = Math.floor(data.sleepDurationH);
    const m = Math.round((data.sleepDurationH % 1) * 60);
    tips.push({
      key: 'sleep_good',
      tag: 'Pré-séance',
      text: `Tu as bien dormi (${h}h${m > 0 ? m : ''}). Bon créneau pour pousser — vise +2.5 kg sur ta dernière série.`,
    });
  }
  if (data.hydrationGoalMl > 0 && data.hydrationMl < data.hydrationGoalMl * 0.5) {
    const deficit = Math.round(data.hydrationGoalMl - data.hydrationMl);
    tips.push({
      key: 'hydration',
      tag: 'Hydratation',
      text: `Il manque ${deficit}ml pour atteindre ta cible aujourd'hui. Bois un verre avant ta séance.`,
    });
  }
  if (data.unmetHabitName && new Date().getHours() >= 12) {
    tips.push({
      key: 'habit',
      tag: 'Habitude',
      text: `Tu n'as pas encore loggué ${data.unmetHabitName} aujourd'hui. 2 minutes suffisent.`,
    });
  }
  tips.push({
    key: 'default',
    tag: 'Coach Ziko',
    text: "Consistance > intensité. Montre-toi aujourd'hui, même 30 minutes, ça compte.",
  });
  return tips;
}

// Dismiss timestamp helpers — uses appStorage (AsyncStorage-backed)
// appStorage.set stores string; store numeric timestamp as string
async function isDismissed(tipKey: string, hoursWindow: number): Promise<boolean> {
  const ts = await appStorage.getNumber(`tip_dismissed_${tipKey}`);
  if (ts === undefined) return false;
  return Date.now() - ts < hoursWindow * 3600 * 1000;
}
export async function dismissTip(tipKey: string): Promise<void> {
  await appStorage.set(`tip_dismissed_${tipKey}`, Date.now());
}

export function useAITips(data: HomeDataForTips) {
  const tips = useMemo(() => computeTips(data), [
    data.sleepDurationH, data.hydrationMl, data.hydrationGoalMl, data.unmetHabitName,
  ]);
  return { tips };
}
```

**MMKV note:** `react-native-mmkv` is NOT installed in the mobile app — confirmed by Grep showing zero matches. The existing `appStorage` (AsyncStorage-backed) at `apps/mobile/src/lib/storage.ts` is the correct persistence layer. Use `appStorage` (sync-equivalent API) for dismiss timestamps. Do NOT add `react-native-mmkv` as a dependency.

---

### `apps/mobile/src/hooks/useSmartActions.ts` (hook, transform)

**Analog:** Same as useAITips.ts — pure derivation hook with no async.

**Target hook structure:**
```typescript
import { useMemo } from 'react';

export interface SmartAction {
  key: string;
  tintColor: string;
  icon: string;
  tag: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}

export interface HomeDataForSmartActions {
  hour: number;               // current hour 0-23
  nutritionPct: number;       // 0-100
  hydrationPct: number;       // 0-100
  sleepPct: number;           // 0-100
}

export function useSmartActions(
  data: HomeDataForSmartActions,
  navigate: (path: string) => void,
): SmartAction[] {
  return useMemo(() => {
    const actions: SmartAction[] = [];
    const { hour, nutritionPct, hydrationPct, sleepPct } = data;

    // Morning / pre-workout (before 11am): suggest mobility
    if (hour < 11) {
      actions.push({
        key: 'mobility',
        tintColor: '#8B5CF6',
        icon: 'body-outline',
        tag: 'Récup',
        title: '5 min de mobilité épaules',
        subtitle: 'Avant ta séance push — débloque les rotateurs',
        onPress: () => navigate('/(app)/(plugins)/stretching/dashboard'),
      });
    }

    // Nutrition gap: if calories < 60% of goal
    if (nutritionPct < 60) {
      const kcalMissing = Math.round((1 - nutritionPct / 100) * 2000); // rough estimate
      actions.push({
        key: 'nutrition',
        tintColor: '#FF5C1A',
        icon: 'restaurant-outline',
        tag: 'Nutrition',
        title: `Manque ~${kcalMissing} kcal aujourd'hui`,
        subtitle: 'Loggue ton dîner pour atteindre ta cible',
        onPress: () => navigate('/(app)/(plugins)/nutrition/log'),
      });
    }

    // Evening (after 19h): log sleep
    if (hour >= 19 && sleepPct < 50) {
      actions.push({
        key: 'sleep',
        tintColor: '#8B5CF6',
        icon: 'moon-outline',
        tag: 'Sommeil',
        title: 'Prépare-toi à dormir',
        subtitle: 'Routine de coucher + log demain matin',
        onPress: () => navigate('/(app)/(plugins)/sleep/dashboard'),
      });
    }

    // Default: hydration if below 50%
    if (hydrationPct < 50 && actions.length < 2) {
      actions.push({
        key: 'hydration',
        tintColor: '#3B82F6',
        icon: 'water-outline',
        tag: 'Hydratation',
        title: 'Complète ton hydratation',
        subtitle: 'Il te manque de l'eau pour la journée',
        onPress: () => navigate('/(app)/(plugins)/hydration/dashboard'),
      });
    }

    return actions.slice(0, 2); // max 2 cards per spec
  }, [data.hour, data.nutritionPct, data.hydrationPct, data.sleepPct]);
}
```

---

## Shared Patterns

### Theme Access
**Source:** All existing screens (index.tsx line 442, settings.tsx line 139)
**Apply to:** All new hook-consuming components in index.tsx
```typescript
const theme = useThemeStore((s) => s.theme);
// Available tokens: theme.background, theme.surface, theme.text, theme.muted,
//   theme.primary, theme.border, theme.cardDark, theme.cardDarkText,
//   theme.success, theme.warn, theme.info, theme.violet
```

### Auth + userId guard
**Source:** settings.tsx lines 305–327 + authStore.ts lines 66–74
**Apply to:** Every `useQuery` in useHomeData.ts
```typescript
const userId = useAuthStore((s) => s.user?.id);
// All queries must include: enabled: !!userId
// All queries must use userId! (non-null assertion) inside queryFn — safe because enabled guards it
```

### Supabase query template
**Source:** authStore.ts `refreshProfile` (lines 64–74)
```typescript
const { data, error } = await supabase
  .from('<table>')
  .select('<columns>')
  .eq('user_id', userId!)
  // ... additional filters
  .single();   // or .maybeSingle() for optional rows, or no terminator for arrays
if (error) throw error;
return data;
```

### Inline style + no StyleSheet
**Source:** index.tsx throughout — all styles are inline objects
**Apply to:** All new code in Phase 33
```typescript
// CORRECT — inline object:
<View style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 16 }}>

// FORBIDDEN — StyleSheet.create:
// const styles = StyleSheet.create({ ... });
```

### showAlert instead of Alert.alert
**Source:** settings.tsx lines 278, 338, 340, 344
**Apply to:** Any error handling in QuickLog bottom sheets
```typescript
import { showAlert } from '@ziko/plugin-sdk';
// Not: import { Alert } from 'react-native'; Alert.alert(...)
showAlert('Titre', 'Message', [{ text: 'OK' }]);
```

### paddingBottom: 100 on root ScrollView
**Source:** CLAUDE.md known-bugs-fixed section
**Apply to:** The root ScrollView's contentContainerStyle in index.tsx
```typescript
<ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100, ... }}>
```

### Card shadow token
**Source:** index.tsx FormeDuJour component (lines 97–101)
```typescript
// Standard card shadow (all section cards):
{
  shadowColor: '#1C1A17',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
}
// Lighter card shadow (QuickLog cells, Recent rows, PluginsDrawer CTA):
{
  shadowColor: '#1C1A17',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
}
```

### Skeleton loading pattern
**Source:** `packages/ui/src/components.tsx` — Skeleton component uses MotiView
**Apply to:** FormeDuJour, MissionCard, AICoachInline, Recent while `isLoading === true`
```typescript
import { Skeleton } from '@ziko/ui';

// FormRing placeholder:
<Skeleton width={160} height={160} borderRadius={80} />

// Text line placeholders:
<Skeleton width="90%" height={14} borderRadius={6} />
<Skeleton width="70%" height={12} borderRadius={6} />
```

---

## @ziko/ui Component Compatibility Confirmed

| Component | Import | Props | Phase 33 compatible? | Notes |
|-----------|--------|-------|----------------------|-------|
| `FormRing` | `@ziko/ui` | `{ score, parts: {value, max, color}[], size? }` | YES | Props differ from local version: needs `max` per part, not percentage. Pass `max: 100` with `value = pct`. |
| `PluginsDrawer` | `@ziko/ui` | `{ visible, onClose, onNavigate }` | YES | Uses `installedPlugins` internally. Header text is "Tous les modules" (not "Tous mes outils" — minor copy diff). |
| `WeekStrip` | `@ziko/ui` | `{ selectedDate, onSelect, dotDates? }` | NO for home spec | Props are for date-picker, not done/today/scheduled state machine. Keep existing local `HomeWeekStrip` implementation in index.tsx. |
| `Skeleton` | `@ziko/ui` | `{ width, height, borderRadius }` | YES | Already uses MotiView for shimmer. |
| `AISuggestion` | `@ziko/ui` | `{ text, actionLabel?, onAction?, tintColor? }` | NO for AICoachInline | Its layout (left border strip + single action) doesn't match the two-button horizontal avatar layout spec. Build AICoachInline as a local inline component using LinearGradient. |

---

## No Analog Found

| File | Role | Reason |
|------|------|--------|
| `apps/mobile/src/lib/homeApi.ts` | utility | No existing fire-and-forget API utility in codebase — pattern inlined above in Shared Patterns. Optionally create as thin module or inline in index.tsx. |

---

## Critical Reminders for Planner

1. **`is_active` not `status`:** `ai_generated_programs` uses `.eq('is_active', true)` — the UI-SPEC's data contract says `status = 'active'` which is WRONG per migration 012.
2. **`.maybeSingle()` for optional rows:** Use `.maybeSingle()` (not `.single()`) for `sleep_logs` and `ai_generated_programs` queries — both may have zero rows and `.single()` throws on no result.
3. **No MMKV:** The project uses `appStorage` (AsyncStorage) at `apps/mobile/src/lib/storage.ts`. Do not introduce `react-native-mmkv`.
4. **Local HomeWeekStrip:** Keep the existing `WeekStrip` component from index.tsx (lines 318–373) as `HomeWeekStrip`. It already implements done/today/rest states correctly. The `@ziko/ui WeekStrip` is a date-picker, not compatible.
5. **PluginsDrawer prop rename:** Current code uses `open={drawerOpen}`. The `@ziko/ui PluginsDrawer` uses `visible={drawerOpen}`. This is the only prop difference to update.
6. **FormRing prop conversion:** Current local `FormRing` takes `{ value, color }` per part (value = percentage 0–100, no `max`). The `@ziko/ui FormRing` takes `{ value, max, color }` and computes `value/max` internally. Pass `max: 100` with the existing percentage values.
7. **Section header `letterSpacing`:** React Native's `letterSpacing` is in points, not em. For `letterSpacing: 0.06em` at 11px font: `letterSpacing: 0.66` (approximately).

---

## Metadata

**Analog search scope:** `apps/mobile/app/(app)/`, `apps/mobile/src/hooks/`, `apps/mobile/src/stores/`, `apps/mobile/src/lib/`, `packages/ui/src/`
**Files read:** 11 source files
**Pattern extraction date:** 2026-05-21
