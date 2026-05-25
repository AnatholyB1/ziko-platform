# Phase 29: Plugin "Mon coach" — Full Implementation — Pattern Map

**Mapped:** 2026-05-19
**Files analyzed:** 9 (7 new, 2 modified)
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `plugins/coach/package.json` | config | — | `plugins/habits/package.json` | exact |
| `plugins/coach/tsconfig.json` | config | — | `plugins/habits/tsconfig.json` | exact |
| `plugins/coach/src/manifest.ts` | config | — | `plugins/habits/src/manifest.ts` | exact |
| `plugins/coach/src/index.ts` | utility | — | `plugins/habits/src/index.ts` | exact |
| `plugins/coach/src/screens/CoachScreen.tsx` | component | request-response | `plugins/habits/src/screens/HabitsDashboardScreen.tsx` | role-match |
| `apps/mobile/app/(app)/(plugins)/coach/dashboard.tsx` | route | request-response | `apps/mobile/app/(app)/(plugins)/habits/dashboard.tsx` | exact |
| `apps/mobile/src/lib/PluginLoader.tsx` *(modify)* | provider | event-driven | self (lines 9–127) | exact |
| `packages/plugin-sdk/src/types.ts` *(modify)* | model | — | self (lines 100–111) | exact |
| `packages/plugin-sdk/src/i18n.ts` *(modify)* | utility | — | self (fr lines 456–513, en lines 1254–1312) | exact |
| `apps/mobile/app/(app)/profile/settings.tsx` *(modify)* | component | request-response | self (lines 31–93, 374–402) | exact |
| `apps/mobile/app/(app)/store/[id].tsx` *(modify)* | component | request-response | self (lines 257–266) | exact |

---

## Pattern Assignments

---

### `plugins/coach/package.json` (config)

**Analog:** `plugins/habits/package.json`

**Full file pattern** (lines 1–30):
```json
{
  "name": "@ziko/plugin-habits",
  "version": "1.0.0",
  "private": true,
  "main": "src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./manifest": "./src/manifest.ts",
    "./store": "./src/store.ts",
    "./screens/HabitsDashboardScreen": "./src/screens/HabitsDashboardScreen.tsx",
    "./screens/HabitLogScreen": "./src/screens/HabitLogScreen.tsx"
  },
  "scripts": {
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@ziko/plugin-sdk": "*",
    "zustand": "^5.0.0",
    "date-fns": "^4.0.0"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-native": "^0.81.0"
  }
}
```

**Coach adaptation:** Replace name with `@ziko/plugin-coach`, update `exports` to expose only `./manifest` and `./screens/CoachScreen`. Remove cross-plugin deps (`@ziko/plugin-nutrition`, `@ziko/plugin-persona`, `@ziko/plugin-gamification`) and `expo-constants`/`expo-notifications` peerDeps. Keep `date-fns: "^4.0.0"` (already hoisted). Do NOT add `@tanstack/react-query` to deps — it is available via the app's hoisted workspace dep.

---

### `plugins/coach/src/manifest.ts` (config)

**Analog:** `plugins/habits/src/manifest.ts`

**Imports + export pattern** (lines 1–2, 100):
```typescript
import type { PluginManifest } from '@ziko/plugin-sdk';
// ... const manifest: PluginManifest = { ... };
export default habitsManifest;   // MUST be default export — PluginLoader reads mod.default
```

**Manifest shape pattern** (lines 3–98):
```typescript
const habitsManifest: PluginManifest = {
  id: 'habits',
  name: 'Daily Habits & Goals',
  version: '1.0.0',
  description: '...',
  icon: 'checkmark-circle-outline',    // Ionicons name — passed to <Ionicons name={...} />
  category: 'coaching',
  price: 'free',
  requiredPermissions: ['read_profile', ...],
  userDataKeys: ['habits'],
  aiSkills: [...],
  aiTools: [...],
  aiSystemPromptAddition: `...`,
  routes: [
    {
      path: '/(plugins)/habits/dashboard',
      title: 'Habits',
      icon: 'checkmark-circle-outline',
      showInTabBar: true,
    },
  ],
};
```

**Coach adaptation:**
- `id: 'coach'`, `name: 'Mon coach'`, `icon: 'person-outline'`
- `mandatory: true` — this field exists in `PluginManifest` since Phase 27 (`packages/plugin-sdk/src/types.ts` line 89)
- `routes[0].showInTabBar: false` — coach is accessed from settings, not tab bar
- `aiSkills: []`, `aiTools: []` — Phase 31 wires actual tools; declare empty arrays for now
- No `aiSystemPromptAddition` needed for Phase 29

---

### `plugins/coach/src/screens/CoachScreen.tsx` (component, request-response)

**Analog:** `plugins/habits/src/screens/HabitsDashboardScreen.tsx`

**Imports pattern** (lines 1–20):
```typescript
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { format } from 'date-fns';
import { useThemeStore, useTranslation, showAlert } from '@ziko/plugin-sdk';
```

**TanStack Query import** (no existing analog — use prescribed pattern from RESEARCH.md):
```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../../apps/mobile/src/stores/authStore';
```

**Screen component signature pattern** (line 307):
```typescript
export default function HabitsDashboardScreen({ supabase }: { supabase: any }) {
```
Coach adaptation: `export default function CoachScreen({ supabase }: { supabase: any })`

**Loading state + ActivityIndicator pattern** — no existing analog uses ActivityIndicator for full-screen load; use inline style matching the app's `#FF5C1A` primary:
```typescript
if (isLoading) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color="#FF5C1A" />
    </SafeAreaView>
  );
}
```

**ScrollView + RefreshControl pattern** (SleepDashboard lines 58–61):
```typescript
<ScrollView
  contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
  refreshControl={
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF5C1A" />
  }
>
```
Note: `paddingBottom: 100` is mandatory per CLAUDE.md.

**Modal + TextInput pattern** (HabitsDashboardScreen lines 257–303):
```typescript
<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
  <View style={{ flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' }}>
    <View style={{ backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
      <Text style={{ color: theme.text, fontWeight: '700', fontSize: 18, marginBottom: 4 }}>
        {t('coach.revoke_modal.title')}
      </Text>
      <TextInput
        value={inputValue}
        onChangeText={setInputValue}
        placeholder={t('coach.revoke_modal.placeholder')}
        placeholderTextColor={theme.muted}
        autoCapitalize="characters"
        style={{
          backgroundColor: theme.background,
          borderRadius: 12,
          padding: 14,
          color: theme.text,
          fontSize: 16,
          marginBottom: 16,
        }}
      />
      <TouchableOpacity
        onPress={handleRevoke}
        disabled={inputValue.trim() !== 'COACH'}
        style={{ backgroundColor: theme.primary, borderRadius: 12, padding: 16, alignItems: 'center', opacity: inputValue.trim() === 'COACH' ? 1 : 0.4 }}
      >
        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>{t('coach.revoke_modal.confirm')}</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>
```
Key difference from habits reminder modal: revocation modal uses `justifyContent: 'center'` (centered) per UI-SPEC, not `flex-end` (bottom sheet). Adjust as needed per 028-UI-SPEC.md.

**Auth token fetch pattern** (HabitsDashboardScreen earnCredit helper, lines 24–38):
```typescript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/coach/clients/links/me`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

**Supabase direct query pattern** (HabitsDashboardScreen lines 364–396):
```typescript
const { data: habitsData } = await supabase
  .from('habits')
  .select('*')
  .eq('user_id', user.id)
  .eq('is_active', true);
```
Coach stats adaptation uses `.select('id', { count: 'exact', head: true })` on `workout_sessions`.

**date-fns usage pattern** (HabitsDashboardScreen imports line 10):
```typescript
import { format } from 'date-fns';
// Usage for "Lié depuis":
import { fr, enUS } from 'date-fns/locale';
const dateStr = format(new Date(link.created_at), 'dd/MM/yyyy', { locale: fr });
```

**showAlert pattern** (HabitsDashboardScreen line 11, used throughout):
```typescript
import { showAlert } from '@ziko/plugin-sdk';
// Usage:
showAlert(t('coach.error.link_failed'), t('coach.error.try_again'));
```
NEVER use `Alert.alert` from `react-native` — CLAUDE.md enforces `showAlert` for all alerts except the ConfirmRevocationModal (which uses custom `Modal` + `TextInput`).

**accessibilityState disabled pattern** (per RESEARCH.md UI-SPEC accessibility contract):
```typescript
<TouchableOpacity
  disabled={!isEnabled}
  accessibilityState={{ disabled: !isEnabled }}
  style={{ opacity: isEnabled ? 1 : 0.5 }}
>
```

---

### `apps/mobile/app/(app)/(plugins)/coach/dashboard.tsx` (route, request-response)

**Analog:** `apps/mobile/app/(app)/(plugins)/habits/dashboard.tsx` (exact)

**Full file pattern** (lines 1–7):
```typescript
import React from 'react';
import HabitsDashboardScreen from '@ziko/plugin-habits/screens/HabitsDashboardScreen';
import { supabase } from '../../../../src/lib/supabase';

export default function HabitsDashboardRoute() {
  return <HabitsDashboardScreen supabase={supabase} />;
}
```

**Coach adaptation** — exact copy with name substitutions:
```typescript
import React from 'react';
import CoachScreen from '@ziko/plugin-coach/screens/CoachScreen';
import { supabase } from '../../../../src/lib/supabase';

export default function CoachDashboardRoute() {
  return <CoachScreen supabase={supabase} />;
}
```

---

### `apps/mobile/src/lib/PluginLoader.tsx` — PLUGIN_LOADERS addition (modify)

**Analog:** self — `apps/mobile/src/lib/PluginLoader.tsx`

**PLUGIN_LOADERS map pattern** (lines 9–28):
```typescript
const PLUGIN_LOADERS: Record<string, () => Promise<{ default: PluginManifest }>> = {
  nutrition:     () => import('@ziko/plugin-nutrition/manifest') as any,
  // ...
  pantry:        () => import('@ziko/plugin-pantry/manifest') as any,
};
```
**Addition:** Insert `coach: () => import('@ziko/plugin-coach/manifest') as any,` after `pantry` (line 27), before the closing `}` of the map (line 28). Must be a literal string import — Metro bundler requires static analyzability.

**Mandatory pre-load loop** (lines 72–87) — this is where auto-install logic inserts AFTER the loop completes:
```typescript
// Pre-load mandatory plugins (bypass user_plugins DB)
for (const [pluginId, loader] of Object.entries(PLUGIN_LOADERS)) {
  if (loadedRef.current.has(pluginId)) continue;
  try {
    const mod = await loader();
    if (mod.default.mandatory === true) {
      let manifest: PluginManifest = mod.default;
      manifest = await applyPersonaDynamicPrompt(manifest, user.id);
      registerPlugin(manifest);
      aiBridge.registerPlugin(manifest);
      loadedRef.current.add(pluginId);
    }
  } catch (err) {
    console.warn(`[PluginLoader] Failed to load mandatory plugin "${pluginId}":`, err);
  }
}
// ← INSERT auto-install logic HERE (after loop, before user_plugins SELECT at line 89)
```

**Supabase upsert pattern** (established in codebase — use same `supabase` import at line 4):
```typescript
// Auto-install coach plugin for clients
async function autoInstallCoachPlugin(userId: string) {
  const { data: profileRow } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single();
  const role = profileRow?.role ?? 'client';
  if (role === 'client' || role === 'both') {
    await supabase.from('user_plugins').upsert(
      { user_id: userId, plugin_id: 'coach', is_enabled: true },
      { onConflict: 'user_id,plugin_id' }  // idempotent — safe on every sign-in
    );
  }
}
// Call: await autoInstallCoachPlugin(user.id);
// Place: after mandatory pre-load loop, before `const { data: userPlugins, error } = await supabase...`
```

---

### `packages/plugin-sdk/src/types.ts` — UserProfile role field (modify)

**Analog:** self — `packages/plugin-sdk/src/types.ts`

**Current UserProfile interface** (lines 100–111):
```typescript
export interface UserProfile {
  id: string;
  name: string | null;
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  goal: FitnessGoal | null;
  units: 'metric' | 'imperial';
  avatar_url: string | null;
  avatar_color: string | null;
  onboarding_done: boolean;
  // ← INSERT role field here
}
```

**Addition** — add after `onboarding_done` (line 110), before closing `}`:
```typescript
  /** User role from migration 034. Default 'client'. Coach-only users have role 'coach'. */
  role?: 'client' | 'coach' | 'both';
```

---

### `packages/plugin-sdk/src/i18n.ts` — coach.* keys (modify)

**Analog:** self — `packages/plugin-sdk/src/i18n.ts`

**Insertion point in `fr`:** After line 513 (last `store.*` key in the fr block), before `// ── Community ──` section (line 514). Insert a new comment block:

```typescript
  // ── Coach plugin ──
  'coach.screen_title': 'Mon coach',
  'coach.settings_section': 'MON COACH',
  'coach.state_a.subtitle': 'Entrez le code de votre coach pour lier votre compte.',
  'coach.state_a.placeholder': 'XXXXXX',
  'coach.state_a.submit': 'Valider le code',
  'coach.state_a.error': 'Code invalide ou expiré. Vérifiez avec votre coach.',
  'coach.state_b.subtitle': 'Votre coach',
  'coach.state_b.kyc_badge': 'Certifié KYC',
  'coach.state_b.confirm': 'Lier mon compte',
  'coach.state_b.cancel': 'Retour à la saisie',
  'coach.state_b.linking': 'Liaison en cours…',
  'coach.state_c.linked_since': 'Lié depuis {{date}}',
  'coach.state_c.sessions_label': 'Séances',
  'coach.state_c.progress_label': 'Progression',
  'coach.state_c.revoke': 'Retirer ce coach',
  'coach.revoke_modal.title': 'Retirer ce coach ?',
  'coach.revoke_modal.body': 'Cette action supprime le lien avec votre coach. Tapez COACH pour confirmer.',
  'coach.revoke_modal.placeholder': 'COACH',
  'coach.revoke_modal.cancel': 'Garder mon coach',
  'coach.revoke_modal.confirm': 'Confirmer',
  'coach.error.link_failed': 'Impossible de lier le compte.',
  'coach.error.revoke_failed': 'Impossible de retirer le coach.',
  'coach.error.try_again': 'Veuillez réessayer.',
  'store.mandatory_tooltip': "Ce plugin est requis par l'application",
```

**Insertion point in `en`:** After the last `store.*` key in the en block (~line 1312), before the next section comment. Same structure with English values:
```typescript
  // ── Coach plugin ──
  'coach.screen_title': 'My coach',
  'coach.settings_section': 'MY COACH',
  'coach.state_a.subtitle': 'Enter your coach code to link your account.',
  'coach.state_a.placeholder': 'XXXXXX',
  'coach.state_a.submit': 'Validate code',
  'coach.state_a.error': 'Invalid or expired code. Check with your coach.',
  'coach.state_b.subtitle': 'Your coach',
  'coach.state_b.kyc_badge': 'KYC Certified',
  'coach.state_b.confirm': 'Link my account',
  'coach.state_b.cancel': 'Back to entry',
  'coach.state_b.linking': 'Linking…',
  'coach.state_c.linked_since': 'Linked since {{date}}',
  'coach.state_c.sessions_label': 'Sessions',
  'coach.state_c.progress_label': 'Progress',
  'coach.state_c.revoke': 'Remove this coach',
  'coach.revoke_modal.title': 'Remove this coach?',
  'coach.revoke_modal.body': 'This action removes the link with your coach. Type COACH to confirm.',
  'coach.revoke_modal.placeholder': 'COACH',
  'coach.revoke_modal.cancel': 'Keep my coach',
  'coach.revoke_modal.confirm': 'Confirm',
  'coach.error.link_failed': 'Unable to link account.',
  'coach.error.revoke_failed': 'Unable to remove coach.',
  'coach.error.try_again': 'Please try again.',
  'store.mandatory_tooltip': 'This plugin is required by the app',
```

**Flat dict pattern** — no nesting, all keys as plain strings, consistent with all existing entries in the file.

---

### `apps/mobile/app/(app)/profile/settings.tsx` — MON COACH section (modify)

**Analog:** self — `apps/mobile/app/(app)/profile/settings.tsx`

**STGroup + STRow pattern** (lines 31–93 — defined inline in the same file, NOT exported):
```typescript
function STGroup({ title, children }: { title: string; children: React.ReactNode }) { ... }
function STRow({ icon, tint, label, sub, right, danger, onPress, toggleValue, onToggle }: {...}) { ... }
```

**Existing injection location** (lines 388–402): insert the MON COACH block between `<STGroup title="Préférences">` (ends line 394) and `<STGroup title="Aide & infos">` (line 396):
```typescript
        </STGroup>  {/* end of Préférences — line 394 */}

        {/* ── Mon coach (role-gated + link-gated) ── */}
        {(role === 'client' || role === 'both') && linkedCoachName && (
          <STGroup title={t('coach.settings_section')}>
            <STRow
              icon="person-outline"
              tint="#FF5C1A"
              label={linkedCoachName}
              onPress={() => router.push('/(plugins)/coach/dashboard' as any)}
            />
          </STGroup>
        )}

        <STGroup title="Aide & infos">  {/* line 396 */}
```

**Role + link status data fetch pattern** — settings currently uses only `useAuthStore` (line 9). Phase 29 must add:
```typescript
// After existing state declarations (~line 1):
import { useQuery } from '@tanstack/react-query';

// In SettingsScreen component body (after existing const declarations):
const profile = useAuthStore((s) => s.profile);
const role = (profile as any)?.role ?? 'client';   // cast until UserProfile.role is typed

const { data: coachData } = useQuery({
  queryKey: ['coach-link-settings', profile?.id],
  queryFn: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/coach/clients/links/me`, {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (!res.ok) return null;
    return res.json();
  },
  enabled: !!(role === 'client' || role === 'both') && !!profile?.id,
  staleTime: 30_000,
});
const linkedCoachName = coachData?.preview?.display_name ?? null;
```
Note: `supabase` import needs to be added to settings.tsx — it is not currently imported. Use `import { supabase } from '../../../src/lib/supabase';` (same relative depth as other `(app)` screens).

**useTranslation hook** (already imported via `useThemeStore, showAlert, usePluginRegistry` from `@ziko/plugin-sdk` at line 8 — add `useTranslation` to the same import):
```typescript
import { useThemeStore, showAlert, usePluginRegistry, useTranslation } from '@ziko/plugin-sdk';
// In component: const { t } = useTranslation();
```

---

### `apps/mobile/app/(app)/store/[id].tsx` — trash button tooltip (modify)

**Analog:** self — `apps/mobile/app/(app)/store/[id].tsx`

**Current mandatory gate** (lines 257–260):
```typescript
{manifest.mandatory ? (
  <View style={{ backgroundColor: '#F4F3F0', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', opacity: 0.5 }}>
    <Ionicons name="trash-outline" size={18} color="#F44336" />
  </View>
) : (
```

**Phase 29 change** — replace `View` with `TouchableOpacity` to support `onLongPress`. All other styles remain identical:
```typescript
{manifest.mandatory ? (
  <TouchableOpacity
    onLongPress={() => showAlert(t('store.mandatory_tooltip'), '')}
    style={{ backgroundColor: '#F4F3F0', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', opacity: 0.5 }}
  >
    <Ionicons name="trash-outline" size={18} color="#F44336" />
  </TouchableOpacity>
) : (
```

Requires `t` from `useTranslation()` — verify it is already destructured in the component; if not, add `const { t } = useTranslation();` and add `useTranslation` to the `@ziko/plugin-sdk` import in that file.

---

## Shared Patterns

### Theme Access
**Source:** Every plugin screen in the codebase
**Apply to:** `CoachScreen.tsx`, `dashboard.tsx` (not needed — no JSX), `settings.tsx` (already uses it)
```typescript
import { useThemeStore } from '@ziko/plugin-sdk';
const theme = useThemeStore((s) => s.theme);
// Use: theme.background, theme.surface, theme.text, theme.muted, theme.border, theme.primary
// Primary color is always '#FF5C1A' — also hardcoded in RefreshControl tintColor
```

### No StyleSheet
**Source:** CLAUDE.md project rules + all plugin screens
**Apply to:** All files with JSX in this phase
All styles must be inline style objects. `StyleSheet.create` is forbidden. Example from HabitsDashboard:
```typescript
// CORRECT
<View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 20 }}>
// WRONG
const styles = StyleSheet.create({ card: { ... } });
```

### paddingBottom: 100 on ScrollView
**Source:** CLAUDE.md + SleepDashboard line 59
**Apply to:** `CoachScreen.tsx` (all three state scroll views)
```typescript
<ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
```

### showAlert (not Alert.react-native)
**Source:** CLAUDE.md + `plugins/habits/src/screens/HabitsDashboardScreen.tsx` line 11
**Apply to:** `CoachScreen.tsx` (State B link failure, State C revoke failure), `store/[id].tsx` (tooltip)
```typescript
import { showAlert } from '@ziko/plugin-sdk';
showAlert(t('coach.error.link_failed'), t('coach.error.try_again'));
// Exception: ConfirmRevocationModal uses custom Modal+TextInput, NOT showAlert
```

### Auth Token Injection
**Source:** `plugins/habits/src/screens/HabitsDashboardScreen.tsx` lines 25–27
**Apply to:** `CoachScreen.tsx` (all 4 backend API calls), `settings.tsx` (coach link query)
```typescript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
// Header: { Authorization: `Bearer ${token}` }
```

### useAuthStore Pattern
**Source:** `apps/mobile/src/lib/PluginLoader.tsx` lines 6, 62
**Apply to:** `PluginLoader.tsx` (already uses it), `settings.tsx` (already uses it), `CoachScreen.tsx`
```typescript
import { useAuthStore } from '../../../src/stores/authStore';  // adjust relative path
const user = useAuthStore((s) => s.user);
```

### Ionicons Icons
**Source:** CLAUDE.md + all screens
**Apply to:** All JSX files in this phase
```typescript
import { Ionicons } from '@expo/vector-icons';
<Ionicons name="person-outline" size={20} color={theme.text} />
// Coach manifest icon: 'person-outline'
// Settings row tint for coach: '#FF5C1A'
```

---

## No Analog Found

No files in this phase lack an analog. All patterns have direct codebase matches.

However, **TanStack Query (`useQuery`)** has no existing usage in plugins or the mobile app — the RESEARCH.md patterns are the implementation guide for this pattern specifically. The TanStack Query dependency is available via the monorepo's hoisted workspace; it does not need to be added to `plugins/coach/package.json`.

---

## Critical Notes for Planner

1. **Wave 0 type fix is a hard dependency:** `packages/plugin-sdk/src/types.ts` `UserProfile.role` addition MUST ship before `PluginLoader.tsx` auto-install logic and `settings.tsx` coach section. Any wave that reads `profile.role` without this type will produce TypeScript errors.

2. **Metro static import constraint:** The `coach` entry in `PLUGIN_LOADERS` at `PluginLoader.tsx` line 27 MUST be a literal string import `() => import('@ziko/plugin-coach/manifest') as any`. Dynamic template string imports will fail Metro bundler.

3. **`onConflict` in upsert:** The `user_plugins` upsert in `autoInstallCoachPlugin` MUST include `{ onConflict: 'user_id,plugin_id' }` to be idempotent across sign-ins.

4. **settings.tsx path:** The file is at `apps/mobile/app/(app)/profile/settings.tsx` (inside `profile/` subdirectory), NOT `apps/mobile/app/(app)/settings.tsx`.

5. **ConfirmRevocationModal exception:** This is the ONE place in the codebase where `showAlert` is NOT used for a confirmation. It requires `<Modal transparent animationType="fade">` with a controlled `TextInput` because `showAlert` does not support text input. The confirm button enables only when `inputValue.trim() === 'COACH'` (exact uppercase).

6. **`photo_signed_url` TTL:** TanStack Query `staleTime: 30_000` (30s) is mandatory to keep the signed URL fresh within its 5-minute TTL window. Do not set `staleTime` higher than 4 minutes.

---

## Metadata

**Analog search scope:** `plugins/`, `apps/mobile/app/`, `apps/mobile/src/lib/`, `packages/plugin-sdk/src/`
**Files scanned:** 12 analog files read
**Pattern extraction date:** 2026-05-19
