---
phase: 35-profile-settings-redesign
plan: G05
type: gap-fix
depends_on: []
files_modified:
  - supabase/migrations/052_language_region.sql
  - apps/mobile/app/(app)/profile/settings.tsx
  - apps/mobile/src/hooks/useUnits.ts
  - apps/mobile/src/stores/userPrefsStore.ts
  - apps/mobile/app/(app)/_layout.tsx
autonomous: true
gap_refs: [smoke-G06-appearance]
---

# 35-G05 — Apparences: Remove Theme, Wire Langue/Région/Unités to DB

## DB State

- `user_profiles.units` EXISTS (`metric`|`imperial`, migration 001) ✅
- `user_profiles.language` — MISSING → add
- `user_profiles.region` — MISSING → add
- Units currently saved to `settings JSONB` under `appearance.units_preference` (wrong path)

## Tasks

### Task 1 — Migration 052

Create `supabase/migrations/052_language_region.sql`:

```sql
-- 052 — Add language and region to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'fr'
    CHECK (language IN ('fr', 'en')),
  ADD COLUMN IF NOT EXISTS region  TEXT DEFAULT 'FR';
```

Run it: `npx supabase db push` (or apply via Supabase dashboard).

### Task 2 — Zustand prefs store

Create `apps/mobile/src/stores/userPrefsStore.ts`:

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage } from '../lib/storage'; // MMKV

interface UserPrefsState {
  units: 'metric' | 'imperial';
  language: 'fr' | 'en';
  region: string;
  setPrefs: (p: Partial<Omit<UserPrefsState, 'setPrefs'>>) => void;
}

export const useUserPrefsStore = create<UserPrefsState>()(
  persist(
    (set) => ({
      units: 'metric',
      language: 'fr',
      region: 'FR',
      setPrefs: (p) => set(p),
    }),
    { name: 'user-prefs', storage: createJSONStorage(() => storage) }
  )
);
```

### Task 3 — useUnits hook

Create `apps/mobile/src/hooks/useUnits.ts`:

```ts
import { useUserPrefsStore } from '../stores/userPrefsStore';

export function useUnits() {
  const units = useUserPrefsStore((s) => s.units);
  return {
    units,
    weightLabel: units === 'metric' ? 'kg' : 'lb',
    distanceLabel: units === 'metric' ? 'km' : 'mi',
    heightLabel: units === 'metric' ? 'cm' : 'in',
    convertWeight: (kg: number) => units === 'metric' ? kg : +(kg * 2.205).toFixed(1),
    convertDistance: (km: number) => units === 'metric' ? km : +(km * 0.621).toFixed(2),
  };
}
```

### Task 4 — Load prefs from DB at app startup

In `apps/mobile/app/(app)/_layout.tsx`, after auth resolves, fetch and hydrate the store:

```ts
const { data } = await supabase
  .from('user_profiles')
  .select('units, language, region')
  .eq('id', userId)
  .single();
if (data) {
  useUserPrefsStore.getState().setPrefs({
    units: data.units ?? 'metric',
    language: data.language ?? 'fr',
    region: data.region ?? 'FR',
  });
}
```

### Task 5 — Rewrite AppearanceSubScreen in settings.tsx

Remove the Theme section entirely. New screen has only two sections:

**Section 1 — Langue & Région:**
- STRow "Langue" → opens an ActionSheet/picker: Français (fr) | English (en)
- STRow "Région" → opens a text input or short picker (France, Belgique, Suisse, Canada, USA)
- On change: `UPDATE user_profiles SET language = ?, region = ?` + `setPrefs({ language, region })`
- Language change → store in MMKV; app reads it on next cold start (no hot-swap needed in v1)

**Section 2 — Unités:**
- Two option rows (Métrique / Impérial) with orange check circle on active
- On change: `UPDATE user_profiles SET units = ?` + `setPrefs({ units })`
- Migrate away from `settings JSONB appearance.units_preference` → write to `user_profiles.units` column directly

Remove `handleThemeSelect`, `activeTheme` state, and all theme-picker UI.

### Task 6 — Apply useUnits in measurement-showing screens

Replace hardcoded "kg", "km", "cm" with `useUnits()` in:
- `plugins/measurements/src/screens/MeasurementsDashboard.tsx` (weight_kg, waist_cm, etc.)
- `plugins/cardio/src/screens/CardioDashboard.tsx` (distance_km, pace)
- `apps/mobile/app/(app)/profile/index.tsx` (weight in stats)

Pattern: `const { weightLabel, convertWeight } = useUnits();`

## Success Criteria

- [ ] Migration 052 applied with no errors
- [ ] AppearanceSubScreen shows only Langue & Région + Unités — no theme section
- [ ] Changing units → save to `user_profiles.units` → reopen screen → same value
- [ ] Changing language → saved to DB + MMKV
- [ ] Measurement screens show "kg" or "lb" based on user preference
- [ ] TypeScript: zero errors
