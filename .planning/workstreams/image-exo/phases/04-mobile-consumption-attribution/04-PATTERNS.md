# Phase 4: Mobile Consumption & Attribution - Pattern Map

**Mapped:** 2026-08-17
**Files analyzed:** 4 (2 modified screens, 1 new shared component, 1 modified i18n dictionary)
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/mobile/app/(app)/workout/exercise/[exerciseId].tsx` | component (screen) | request-response (CRUD read) | itself (in-place edit) — sub-patterns from `apps/mobile/app/(app)/profile/avatar.tsx` (Storage URL) + `apps/mobile/app/(app)/ai/index.tsx` (expo-image) | exact (self) / role-match (sub-patterns) |
| `apps/mobile/src/components/ExercisePicker.tsx` | component (list/modal) | request-response (CRUD read) | itself (in-place edit) — thumbnail sub-pattern same as above | exact (self) |
| `packages/ui/src/components/AttributedMedia.tsx` | component (shared UI, presentational) | transform (uri → media+badge+fallback) | `packages/ui/src/components/EmptyState.tsx` (variant-driven fallback/placeholder shape) + `packages/ui/src/components.tsx`'s `Card`/`Badge` (spacing/radius token usage, theme wiring) | role-match |
| `packages/plugin-sdk/src/i18n.ts` | utility (i18n dictionary + hook) | transform (key → localized string) | itself — extend existing `fr`/`en` `TranslationDict` objects and optionally `tExercise`-style helper | exact (self) |

## Pattern Assignments

### `apps/mobile/app/(app)/workout/exercise/[exerciseId].tsx` (component, request-response)

**Analog:** self (existing file, being edited in place) + `avatar.tsx` (Storage URL) + `ai/index.tsx` (expo-image)

**Imports pattern** (current, lines 1-19 — add `Image` from `expo-image` and `useTranslation` from `@ziko/plugin-sdk`):
```typescript
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useThemeStore } from '@ziko/plugin-sdk';
import { showAlert } from '@ziko/plugin-sdk';
import { supabase } from '../../../../src/lib/supabase';
import WSHeader from '../../../../src/components/WSHeader';
import ExercisePicker from '../../../../src/components/ExercisePicker';
// ADD:
// import { Image } from 'expo-image';
// import { useTranslation } from '@ziko/plugin-sdk';
// import { AttributedMedia } from '@ziko/ui';
```

**Query key pattern (MOBILE-06 version bump)** (lines 28-45):
```typescript
const {
  data: exercise,
  isLoading,
  isError,
  refetch,
} = useQuery({
  queryKey: ['exercise', exerciseId],   // → bump to ['exercises', 'v2', exerciseId]
  queryFn: async () => {
    const { data, error } = await supabase
      .from('exercises')
      .select('*')                       // '*' already includes image/gif/instruction_steps/instructions_fr — no select() change needed here (unlike ExercisePicker)
      .eq('id', exerciseId)
      .single();
    if (error) throw error;
    return data;
  },
  enabled: !!exerciseId,
});
```

**Storage public URL pattern — copy from `apps/mobile/app/(app)/profile/avatar.tsx:109-111`:**
```typescript
// avatars bucket precedent (mutable, cache-busted):
const { data } = supabase.storage.from('avatars').getPublicUrl(path);
return `${data.publicUrl}?t=${Date.now()}`;

// This phase's equivalent — exercise-media bucket, immutable asset, NO cache-bust:
const { data: gifUrlData } = exercise?.gif
  ? supabase.storage.from('exercise-media').getPublicUrl(exercise.gif)
  : { data: null };
const publicGifUrl = gifUrlData?.publicUrl ?? null;
```

**expo-image pattern — copy from `apps/mobile/app/(app)/ai/index.tsx:14,322-327`:**
```tsx
import { Image } from 'expo-image';
...
<Image
  source={{ uri: publicGifUrl }}
  style={{ width: '100%', height: '100%' }}
  contentFit="cover"
  transition={150}
/>
```

**Hero block to REPLACE** (lines 200-297 — the fake 16:9 video placeholder, entirely deleted per D-01/D-02):
```tsx
{/* 16:9 Video Placeholder */}
<View style={{ borderRadius: 14, aspectRatio: 16 / 9, overflow: 'hidden', position: 'relative', backgroundColor: '#1C1A17' }}>
  {/* diagonal overlay, play button, "Démo · 0:42" badge, "HD" badge — ALL removed */}
</View>
```
Replace with (per UI-SPEC §1-§2, using `AttributedMedia` from `@ziko/ui`):
```tsx
<AttributedMedia uri={publicGifUrl} size={heroWidth /* screen width - 32 */} showBadge />
```
Note the existing card-shadow convention this hero must now match (already used by the stat tiles at lines 302-316 and tab-content cards at 464-476): `borderRadius: 14`, `theme.surface`, `borderWidth: 1`, `theme.border`, `shadowColor: theme.text`, `shadowOpacity: 0.08`, `shadowRadius: 12`, `shadowOffset: { width: 0, height: 2 }`, `elevation: 3`.

**Instructions fallback chain to REPLACE (MOBILE-04)** (lines 125-136 — the fragile chain):
```typescript
// CURRENT — being removed:
const cues: string[] = (() => {
  if (!exercise?.instructions) return ['Pas de consignes disponibles.'];
  if (Array.isArray(exercise.instructions)) return exercise.instructions;
  try {
    const parsed = JSON.parse(exercise.instructions);
    if (Array.isArray(parsed)) return parsed;
    return [exercise.instructions];
  } catch {
    return exercise.instructions.split('\n').filter(Boolean);
  }
})();
```
```typescript
// NEW — direct JSONB read + locale selection (MOBILE-04/05), per RESEARCH.md Pattern 3 + Code Examples:
const { tExercise, locale, t } = useTranslation();

const steps: string[] =
  exercise?.instruction_steps?.[locale] ??
  exercise?.instruction_steps?.en ??
  [];
// steps.length === 0 (and legacy instructions/instructions_fr also empty) → render
// <EmptyState variant="no-data" title={t('exercise.instructionsEmptyTitle')} message={t('exercise.instructionsEmptyBody')} />
// inside the Consignes tab's existing card shell (see UI-SPEC §5), instead of the numbered list below.
```
The numbered-steps render loop itself (lines 490-513) is UNCHANGED — same 22×22 circle, `rgba(255,92,26,0.14)` fill, `#FF5C1A` number text, 12px/18px body — it just now maps over `steps` instead of `cues`.

**Bilingual name pattern — copy `tExercise` usage convention from `packages/plugin-sdk/src/i18n.ts:1728-1734` (see Shared Patterns below):**
```typescript
const displayName = tExercise(exercise.name, exercise.name_fr);
// WSHeader title={displayName} instead of title={exercise?.name ?? 'Exercice'} (line 182)
```

**Error/loading pattern (UNCHANGED — reuse verbatim, lines 144-177):**
```tsx
if (isLoading) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <WSHeader title="Exercice" onBack={() => router.back()} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.primary} size="large" />
      </View>
    </View>
  );
}
if (isError || !exercise) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <WSHeader title="Exercice" onBack={() => router.back()} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: theme.text, fontSize: 14, textAlign: 'center', marginBottom: 12 }}>
          Impossible de charger les données. Réessaie.
        </Text>
        <TouchableOpacity onPress={() => refetch()} style={{ backgroundColor: theme.primary, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 10 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

---

### `apps/mobile/src/components/ExercisePicker.tsx` (component, request-response)

**Analog:** self (existing file, being edited in place)

**`select()` + interface pattern to extend (Pitfall 4 — must add `image` or every row silently falls to placeholder)** (lines 27-33, 41-57):
```typescript
// CURRENT interface:
interface ExerciseRow {
  id: string;
  name: string;
  muscle_groups: string[] | null;
  equipment: string | null;
  target_muscle: string | null;
}
// ADD: image: string | null;

// CURRENT query:
const {
  data: exercises = [],
  isError,
  refetch,
} = useQuery<ExerciseRow[]>({
  queryKey: ['exercises-picker'],           // → bump to ['exercises', 'v2', 'picker']
  queryFn: async () => {
    const { data, error } = await supabase
      .from('exercises')
      .select('id, name, muscle_groups, equipment, target_muscle')  // → add 'image'
      .order('name')
      .limit(200);
    if (error) throw error;
    return (data ?? []) as ExerciseRow[];
  },
  staleTime: 5 * 60 * 1000,
});
```

**Storage URL pattern for thumbnail — same `getPublicUrl` call as `avatar.tsx:109`, no cache-bust (immutable asset):**
```tsx
const publicThumbUrl = ex.image
  ? supabase.storage.from('exercise-media').getPublicUrl(ex.image).data.publicUrl
  : null;
```

**Row structure to modify — checkbox insertion point** (lines 253-306, current row `TouchableOpacity` with `flexDirection: 'row', alignItems: 'center', gap: 12`):
```tsx
<TouchableOpacity
  onPress={() => toggleSelection(ex.id)}
  style={{
    borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: isSelected ? 'rgba(255,92,26,0.06)' : theme.surface,
    borderWidth: isSelected ? 1.5 : 1, borderColor: isSelected ? '#FF5C1A' : theme.border,
    shadowColor: theme.text, shadowOpacity: 0.08, shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  }}
>
  {/* NEW — insert BEFORE the existing Checkbox (line 274), per UI-SPEC §3: */}
  {/* {publicThumbUrl ? <Image source={{uri: publicThumbUrl}} style={{width:40,height:40,borderRadius:10}} contentFit="cover" />
       : <View style={{width:40,height:40,borderRadius:10,alignItems:'center',justifyContent:'center',
            backgroundColor: theme.background, borderWidth:1, borderColor: theme.border}}>
           <Ionicons name="barbell-outline" size={18} color={theme.muted} />
         </View>} */}

  {/* Checkbox — UNCHANGED, 22x22, borderRadius: 6 */}
  <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: isSelected ? '#FF5C1A' : 'transparent', borderWidth: isSelected ? 0 : 1.5, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
  </View>

  {/* Exercise info — UNCHANGED */}
  <View style={{ flex: 1, minWidth: 0 }}>
    <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }} numberOfLines={1}>{ex.name}</Text>
    <Text style={{ fontSize: 10, color: theme.muted, marginTop: 2 }} numberOfLines={1}>
      {[ex.target_muscle, ex.equipment].filter(Boolean).join(' · ')}
    </Text>
  </View>
</TouchableOpacity>
```
No `<AttributedMedia>` wrapper here — per D-06, deliberately bypassed for list rows.

**Error state pattern (UNCHANGED, lines 212-229) — reuse verbatim, same shape as `[exerciseId].tsx`'s error block but compact:**
```tsx
{isError && (
  <View style={{ padding: 24, alignItems: 'center' }}>
    <Text style={{ color: theme.muted, fontSize: 12, marginBottom: 12, textAlign: 'center' }}>
      Impossible de charger les exercices.
    </Text>
    <TouchableOpacity onPress={() => refetch()} style={{ backgroundColor: theme.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Réessaie</Text>
    </TouchableOpacity>
  </View>
)}
```

---

### `packages/ui/src/components/AttributedMedia.tsx` (new shared component, transform)

**Analog:** `packages/ui/src/components/EmptyState.tsx` (variant-driven presentational component shape, no theme store dependency — uses hardcoded hex, consistent with this component's UI-SPEC-locked hex values) + `packages/ui/src/components.tsx` (export-from-package-root convention, `spacing`/`radius` token usage, `useThemeStore` wiring pattern used by `Card`/`Badge`).

**Full existing analog for file shape/exports** (`EmptyState.tsx`, all 89 lines — this is the direct structural template: props interface → variant config map → functional component → default export):
```tsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type EmptyStateVariant = 'no-data' | 'error' | 'offline' | 'no-results';

interface EmptyStateProps {
  variant: EmptyStateVariant;
  title: string;
  message?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

const VARIANT_CONFIG: Record<EmptyStateVariant, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  'no-data':    { icon: 'file-tray-outline', color: '#E2E0DA' },
  'error':      { icon: 'warning-outline',   color: '#F59E0B' },
  'offline':    { icon: 'wifi-outline',      color: '#6B6963' },
  'no-results': { icon: 'search-outline',    color: '#E2E0DA' },
};

export function EmptyState({ variant, title, message, ctaLabel, onCta }: EmptyStateProps) {
  const config = VARIANT_CONFIG[variant];
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 24 }}>
      <View style={{ width: 80, height: 80, borderRadius: 999, backgroundColor: '#F7F6F3', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#E2E0DA' }}>
        <Ionicons name={config.icon} size={36} color={config.color} />
      </View>
      <Text style={{ fontWeight: '700', fontSize: 17, color: '#1C1A17', textAlign: 'center', marginBottom: 4 }}>{title}</Text>
      {message ? <Text style={{ fontSize: 14, color: '#6B6963', textAlign: 'center', lineHeight: 20 }}>{message}</Text> : null}
      {ctaLabel && onCta ? (
        <TouchableOpacity onPress={onCta} activeOpacity={0.8} style={{ backgroundColor: '#FF5C1A', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 16 }}>
          <Text style={{ fontWeight: '700', color: '#FFFFFF', fontSize: 14 }}>{ctaLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default EmptyState;
```

**Export registration pattern — copy from `packages/ui/src/index.ts:32-33`:**
```typescript
export { EmptyState } from './components/EmptyState';
export { ErrorScreen } from './components/ErrorScreen';
// ADD:
// export { AttributedMedia } from './components/AttributedMedia';
```

**Component contract to implement (UI-SPEC §2, locked pixel values — not open to reinterpretation):**
```typescript
interface AttributedMediaProps {
  uri: string | null;
  size?: number;                 // default 180, clamp: Math.min(size ?? 180, 180)
  borderRadius?: number;         // default 14
  showBadge?: boolean;           // default true
  credit?: string;                // default '© Gym visual — https://gymvisual.com/'
  fallbackIconSize?: number;     // default 48
}
```
Badge visual spec (from UI-SPEC, exact values):
```
position: absolute; bottom: 8; right: 8; paddingHorizontal: 8; paddingVertical: 4;
borderRadius: 6; backgroundColor: 'rgba(28,26,23,0.55)';
text: fontSize 9, fontWeight '700', color '#FFFAF6', numberOfLines 1
```
Fallback placeholder (hero size, 180 slot): `barbell-outline` Ionicons, size 48, color `#6B6963` (theme.muted), centered, background `#FFFFFF` (theme.surface — inherited from container), optional caption "Aperçu indisponible"/"Preview unavailable" fontSize 11 fontWeight 700 color `#6B6963` marginTop 8.
Behavior: `uri` falsy → render fallback, never mount badge. `showBadge && uri` both true → mount badge.

**expo-image usage inside the component — same pattern as `ai/index.tsx:14,322-327` (see above), `contentFit="cover"`, `transition={150}`.**

**Theme-store wiring option — `packages/ui/src/components.tsx` shows the project convention for shared-UI components that DO need live theme** (`Card`, `Badge` both call `useThemeStore((s) => s.theme)` internally rather than accepting a theme prop):
```typescript
import { useThemeStore, ThemePalette } from '@ziko/plugin-sdk';
const theme = useThemeStore((s) => s.theme);
```
Note: `EmptyState.tsx` does NOT use `useThemeStore` (hardcodes hex) — UI-SPEC's `AttributedMedia` badge colors are also given as literal hex/rgba (not `theme.X` references), so either approach is defensible; prefer hardcoded hex per UI-SPEC's literal values to avoid drift if `theme.cardDark`/`theme.muted` values ever change independently of this locked legal-attribution styling.

---

### `packages/plugin-sdk/src/i18n.ts` (utility, transform)

**Analog:** self — extend the existing `fr`/`en` `TranslationDict` objects with new keys following the `exercise.*` / `general.*` namespacing convention already in use.

**Existing key-namespacing precedent** (lines 278-283 `fr`, mirrored 1102-1107 `en`):
```typescript
// fr:
'exercise.category.strength': 'Force',
'exercise.category.cardio': 'Cardio',
...
// en:
'exercise.category.strength': 'Strength',
'exercise.category.cardio': 'Cardio',
```

**New keys to add (per UI-SPEC Copywriting Contract), same `exercise.*` namespace, added to both `fr` (~line 283) and `en` (~line 1107) dicts:**
```typescript
// fr additions:
'exercise.mediaUnavailable': 'Aperçu indisponible',
'exercise.instructionsEmptyTitle': 'Consignes à venir',
'exercise.instructionsEmptyBody': "Les instructions détaillées n'ont pas encore été ajoutées pour cet exercice.",

// en additions:
'exercise.mediaUnavailable': 'Preview unavailable',
'exercise.instructionsEmptyTitle': 'Instructions coming soon',
'exercise.instructionsEmptyBody': "Detailed instructions haven't been added for this exercise yet.",
```
Attribution credit text itself (`© Gym visual — https://gymvisual.com/`) is locked, non-localized, non-paraphrasable per Copywriting Contract — it is the `AttributedMedia` component's own `credit` default prop, NOT a `t()` dictionary key (do not add it to i18n.ts).

**`t()` lookup mechanism (unchanged, lines 1716-1724) — new keys work automatically once added to both dicts, no code change needed beyond the dict entries:**
```typescript
const t = (key: string, params?: Record<string, string | number>): string => {
  let text = dict[key] ?? translations.en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
};
```

**`tExercise` pattern reference (unchanged — already exists, used by `[exerciseId].tsx` for the bilingual name; NOT modified for instructions since `instruction_steps[locale]` is a direct JSONB lookup, not a dictionary lookup)** (lines 1726-1734):
```typescript
const tExercise = (name: string, nameFr?: string | null): string => {
  if (locale === 'fr') {
    if (nameFr) return nameFr;
    if (exerciseNames[name]) return exerciseNames[name];
  }
  return name;
};
```

---

## Shared Patterns

### Card/surface styling convention
**Source:** `apps/mobile/app/(app)/workout/exercise/[exerciseId].tsx` lines 302-316 (stat tiles), 464-476 (tab content)
**Apply to:** Hero media card in `[exerciseId].tsx`, missing-media fallback container in `AttributedMedia`
```typescript
{
  borderRadius: 14,
  backgroundColor: theme.surface,
  borderWidth: 1,
  borderColor: theme.border,
  shadowColor: theme.text,
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 2 },
  elevation: 3,
}
```

### Supabase Storage public URL construction (no cache-busting for immutable assets)
**Source:** `apps/mobile/app/(app)/profile/avatar.tsx:109` (pattern), diverging on cache-bust per RESEARCH.md Pattern 1
**Apply to:** `[exerciseId].tsx` hero, `ExercisePicker.tsx` thumbnails, internally inside `AttributedMedia` if the component is given raw paths (spec says it receives a pre-built `uri`, so callers do this, not the component itself)
```typescript
const { data } = supabase.storage.from('exercise-media').getPublicUrl(path);
const publicUrl = data.publicUrl;
// NO `?t=${Date.now()}` — exercise-media assets are immutable, unlike user avatars
```

### `expo-image` for remote/animated media
**Source:** `apps/mobile/app/(app)/ai/index.tsx:14,322-327`
**Apply to:** `AttributedMedia`'s internal `<Image>`, `ExercisePicker` thumbnail `<Image>`
```tsx
import { Image } from 'expo-image';
<Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} />
```

### Bilingual content selection (name via dict/DB, instructions via direct JSONB)
**Source:** `packages/plugin-sdk/src/i18n.ts:1712-1734` (`useTranslation`, `tExercise`)
**Apply to:** `[exerciseId].tsx` (name + instructions), not `ExercisePicker.tsx` (row names render `ex.name` untranslated today — out of scope, MOBILE-05 only targets the detail screen per CONTEXT.md's stated scope)
```typescript
const { tExercise, locale, t } = useTranslation();
const displayName = tExercise(exercise.name, exercise.name_fr);
const steps = exercise?.instruction_steps?.[locale] ?? exercise?.instruction_steps?.en ?? [];
```

### TanStack Query key versioning (MOBILE-06)
**Source:** `apps/mobile/app/(app)/workout/exercise/[exerciseId].tsx:34`, `apps/mobile/src/components/ExercisePicker.tsx:46`
**Apply to:** both files' `exercises`-reading `useQuery` calls. Explicitly documented exclusion: `apps/mobile/src/components/SearchOverlay.tsx:44` (`queryKey: ['search_exercises', debouncedQuery]`, `select('id, name, category')`) renders no media — do not version-bump it, but note in the plan that it was checked and excluded (Pitfall 1 in RESEARCH.md).
```typescript
// Before:
queryKey: ['exercise', exerciseId]
queryKey: ['exercises-picker']
// After (example shape per MOBILE-06's literal wording):
queryKey: ['exercises', 'v2', exerciseId]
queryKey: ['exercises', 'v2', 'picker']
```

### Error/retry block
**Source:** `apps/mobile/app/(app)/workout/exercise/[exerciseId].tsx:155-177`, `apps/mobile/src/components/ExercisePicker.tsx:212-229`
**Apply to:** unchanged by this phase — no new error states introduced beyond the existing pattern; image-load failures fall through silently to the missing-media placeholder per UI-SPEC's Copywriting Contract ("Error state" row).

## No Analog Found

None — every file in scope either has a direct in-repo structural analog (`EmptyState.tsx` for `AttributedMedia.tsx`) or is being edited in place (both screens, i18n.ts), so the "self" is its own strongest analog for surrounding untouched code.

## Metadata

**Analog search scope:** `apps/mobile/app/(app)/`, `apps/mobile/src/components/`, `packages/ui/src/`, `packages/plugin-sdk/src/i18n.ts`
**Files scanned:** 9 (`[exerciseId].tsx`, `ExercisePicker.tsx`, `SearchOverlay.tsx`, `avatar.tsx`, `ai/index.tsx`, `_layout.tsx`, `i18n.ts`, `packages/ui/src/index.ts`, `components.tsx`, `EmptyState.tsx`)
**Pattern extraction date:** 2026-08-17
