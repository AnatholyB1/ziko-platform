# Technology Stack — DA Coach (v1.12)

**Project:** Ziko Platform — Coach Direction Artistique (white-label branding)
**Researched:** 2026-05-25
**Confidence:** HIGH — all key claims verified against official docs and existing codebase

---

## Context: What Already Exists (Do Not Re-add)

| Capability | Location | Version |
|------------|----------|---------|
| Theme store | `packages/plugin-sdk/src/theme.ts` | Zustand v5, `useThemeStore` |
| `ThemePalette` interface | same | 20+ typed tokens |
| `THEME_REGISTRY` (7 presets) | same | static object |
| `setTheme(themeId)` | same | takes string key, sets store |
| `expo-image-picker` | `apps/mobile/package.json` | `~17.0.10` — already installed |
| `expo-image-manipulator` | `apps/mobile/package.json` | `^55.0.13` — already installed |
| `react-native-reanimated` | `apps/mobile/package.json` | `~4.1.1` — already installed |
| `react-native-gesture-handler` | `apps/mobile/package.json` | `~2.28.0` — already installed |
| `avatars` public bucket | migration 017 | public, `getPublicUrl()` pattern |
| Signed upload URL endpoint | `backend/api/src/routes/storage.ts` | `GET /storage/upload-url` |
| Upload pattern (FormData) | `apps/mobile/app/(app)/profile/avatar.tsx` | validated on physical Android |
| `coach_profiles` table | migration 034 | has `photo_url TEXT`, needs DA columns |
| `coach_profiles` public read | migration 042 | authenticated users can SELECT |
| Next migration number | supabase/migrations/ | `054_*` is next |

---

## New Stack Additions Required

### 1. Color Picker — `reanimated-color-picker@^4.2.0`

**Install:**
```bash
npm i reanimated-color-picker
```

**Why this one:** Pure JS (no native module rebuild required with Expo managed workflow), already has all peer deps in the project (`react-native-reanimated ~4.1.1`, `react-native-gesture-handler ~2.28.0`). Version 4.2.0 is current (published Jan 2026). Supports `Panel1` (square gradient), `HueSlider`, `Swatches`, `Preview`, `OpacitySlider` as composable sub-components.

**Key API:**
```tsx
import ColorPicker, { Panel1, HueSlider, Preview } from 'reanimated-color-picker';

<ColorPicker value={currentHex} onCompleteJS={({ hex }) => setColor(hex)}>
  <Preview />
  <Panel1 />
  <HueSlider />
</ColorPicker>
```

Use `onCompleteJS` (not `onComplete`) when the callback is not a Reanimated worklet — i.e., when it calls `setState` or Zustand `set`.

**Alternatives rejected:**
- `react-native-color-picker` — abandoned (last publish 2018, no Reanimated support)
- `@react-native-community/slider` + manual HSL — too much custom logic, fragile
- Web `<input type="color">` — web only, irrelevant

**Confidence:** HIGH (npm, official docs verified)

---

### 2. Image Upload for Coach Logo — No New Library

`expo-image-picker ~17.0.10` is already installed and already used in `avatar.tsx` (profile photo flow). Reuse the same pattern verbatim:

1. `ImagePicker.requestMediaLibraryPermissionsAsync()` — request permission
2. `ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 })` — pick
3. `ImageManipulator.manipulateAsync(uri, [{ resize: { width: 400 } }], { compress: 0.85, format: SaveFormat.JPEG })` — resize (logos are small; 400px max is sufficient)
4. `supabase.storage.from('coach-logos').upload(path, formData, { upsert: true })` — upload via FormData (required for Android physical devices)
5. `supabase.storage.from('coach-logos').getPublicUrl(path)` + `?t=${Date.now()}` cache-bust — return permanent public URL

**SDK 54 note:** When `allowsEditing: false`, iOS returns HEIC/AVIF. Always set `allowsEditing: true` for logos, or use `expo-image-manipulator` to force JPEG. The existing avatar flow already handles this correctly.

---

### 3. Supabase Storage — New `coach-logos` Public Bucket

**Decision: Public bucket (not signed URLs)**

Coach logos are branding assets shown to all linked athletes. They are not sensitive. Public bucket gives:
- Permanent, cacheable URLs — no expiry, no regeneration needed
- CDN-cached globally — fast load on athlete app
- `getPublicUrl()` returns a stable string that can be stored in `coach_profiles.logo_url TEXT` and re-used indefinitely

Signed URLs (private bucket) would require: regenerating the URL before every display, adding TTL management in `useThemeStore`, and adding a backend endpoint to sign on-demand. All unnecessary for a non-sensitive branding asset.

**Bucket config (migration 054):**
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('coach-logos', 'coach-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Upload: only the coach owner (folder = coach user_id)
CREATE POLICY "coach_logo_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'coach-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read — any unauthenticated user can view (logo is branding)
CREATE POLICY "coach_logo_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'coach-logos');

-- Only owner can update/delete
CREATE POLICY "coach_logo_owner_modify" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'coach-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

Add `ALLOWED_BUCKETS` entry in `backend/api/src/routes/storage.ts` if the upload goes through that endpoint. Alternatively (simpler for coach-only flow), upload directly from the web CRM using the Supabase JS client with the coach's JWT — no Hono hop needed.

---

### 4. Dynamic Theme Token Injection at Runtime — Extend `useThemeStore`, No New Engine

**Decision: Do NOT add NativeWind `vars()` or a new theme engine. Extend `useThemeStore` instead.**

Rationale: NativeWind's `vars()` function injects CSS custom properties as inline styles on a parent `<View>`. It works for NativeWind class-based consumers (`className="text-primary"`), but the Ziko codebase does NOT use NativeWind classes for theming — it uses `theme.primary`, `theme.background`, etc. as direct style values. Every component calls `useThemeStore((s) => s.theme)` and reads `theme.primary` inline. This is already a dynamic, reactive pattern — changing the store immediately re-renders all subscribers.

**What needs to change:**

1. **Add DA fields to `ThemePalette`** in `packages/plugin-sdk/src/theme.ts`:
```ts
export interface ThemePalette {
  // ... existing fields ...
  // DA Coach overrides (optional — undefined means "use default")
  coachPrimary?: string;       // coach brand color (replaces primary in coach-branded surfaces)
  coachLogoUrl?: string;       // public URL to coach logo
  coachDisplayName?: string;   // coach name shown in branded header
}
```

2. **Add `setCoachDA` action to `useThemeStore`**:
```ts
setCoachDA: (da: { primary?: string; logoUrl?: string; displayName?: string }) =>
  set((s) => ({
    theme: {
      ...s.theme,
      coachPrimary: da.primary ?? s.theme.coachPrimary,
      coachLogoUrl: da.logoUrl ?? s.theme.coachLogoUrl,
      coachDisplayName: da.displayName ?? s.theme.coachDisplayName,
    }
  })),

clearCoachDA: () =>
  set((s) => ({
    theme: {
      ...s.theme,
      coachPrimary: undefined,
      coachLogoUrl: undefined,
      coachDisplayName: undefined,
    }
  })),
```

3. **Propagation point:** Call `setCoachDA` once on app startup (after linking check) in the "Mon coach" plugin screen / `useEffect` that fetches `coach_profiles`. No polling needed — coach DA changes rarely; a pull-to-refresh or app restart is acceptable.

4. **Consumer pattern in coach-branded surfaces:**
```ts
const theme = useThemeStore((s) => s.theme);
const brandPrimary = theme.coachPrimary ?? theme.primary; // graceful fallback
```

This is zero-cost — no new dependencies, no CSS variable layer, no context providers. Zustand is already the reactivity layer.

**Why not NativeWind `vars()`:** The Ziko theme system does not use NativeWind utility classes for color tokens. Introducing `vars()` would require migrating all 70+ components to use `className="bg-[var(--coach-primary)]"` instead of `style={{ backgroundColor: theme.primary }}`. That is a full design-system migration, not a feature addition. Out of scope.

---

### 5. `coach_profiles` Schema Extension — Migration 054

Add DA columns to the existing `coach_profiles` table:

```sql
-- migration 054_coach_da_schema.sql
ALTER TABLE public.coach_profiles
  ADD COLUMN IF NOT EXISTS da_primary_color TEXT,   -- hex e.g. '#FF5C1A'
  ADD COLUMN IF NOT EXISTS da_logo_url      TEXT,   -- public Supabase Storage URL
  ADD COLUMN IF NOT EXISTS da_tone          TEXT     -- 'motivant' | 'pro' | 'bienveillant' | 'expert'
    CHECK (da_tone IN ('motivant', 'pro', 'bienveillant', 'expert'));
```

**Why same table:** `coach_profiles` already has `photo_url`, `bio`, `display_name`. DA is coach identity data — same entity, same RLS, no join needed. Separating into `coach_da` would be premature normalization for 3 columns.

**Existing RLS covers this:** `coach_profiles_own` (FOR ALL, auth.uid() = user_id) and `coach_profiles_authenticated_read` (FOR SELECT, any authenticated user) already apply. No new policies needed.

---

## Backend Hono Route — `GET /coach/da/:coachId`

Athlete app needs to fetch the linked coach's DA on startup. Pattern:

```ts
// Returns { primary_color, logo_url, tone, display_name } or 404
GET /coach/da/:coachId
```

Uses existing `is_coach_of()` guard or linked-athlete check. Thin route — reads 4 columns from `coach_profiles`. No new service layer needed; add to existing `backend/api/src/coach/` bounded context.

---

## Web CRM — DA Settings Screen

Coach sets DA from `apps/web` (Next.js). No React Native dependencies on the web side. Use:
- `<input type="color">` (native HTML color picker) — sufficient for web coach dashboard. No library needed.
- Existing Supabase JS client in the web app for direct upload to `coach-logos` bucket.
- `PATCH /coach/profile` or direct Supabase client update to `coach_profiles` DA columns.

Do NOT add `reanimated-color-picker` to the web app — it is React Native only.

---

## What NOT to Add

| Library | Why Not |
|---------|---------|
| `react-native-color-picker` | Abandoned 2018 |
| NativeWind `vars()` | Incompatible with existing inline-style theming pattern; would require full migration |
| New theme engine (react-navigation theme, etc.) | Zustand store already provides reactive theme injection |
| Expo Font loading per coach | Fonts are fixed (Manrope + Geist) — coach DA is color + logo only |
| Separate `coach_da` table | 3 columns on existing entity; normalization adds join overhead for zero benefit |
| Private bucket for coach logos | Logos are branding assets, not sensitive; public bucket is correct |
| `react-native-image-crop-picker` | No native module flexibility in managed workflow; expo-image-picker already installed |

---

## Installation Summary

Only ONE new npm dependency is needed:

```bash
# From apps/mobile/
npm i reanimated-color-picker
```

Everything else reuses existing infrastructure:
- `expo-image-picker` — already installed
- `expo-image-manipulator` — already installed
- `react-native-reanimated` — already installed (peer dep satisfied)
- `react-native-gesture-handler` — already installed (peer dep satisfied)
- `useThemeStore` + `ThemePalette` — extend in place
- Supabase Storage — new public bucket via migration
- `coach_profiles` — ALTER TABLE via migration

---

## Sources

- [reanimated-color-picker npm](https://www.npmjs.com/package/reanimated-color-picker) — version 4.2.0 confirmed
- [reanimated-color-picker docs](https://alabsi91.github.io/reanimated-color-picker/docs/Usage/) — onCompleteJS API
- [expo-image-picker docs SDK 54](https://docs.expo.dev/versions/latest/sdk/imagepicker/) — mediaTypes array, allowsEditing HEIC note
- [Supabase Storage Buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals) — public vs private distinction
- [NativeWind v4 Dynamic Themes](https://www.nativewind.dev/docs/guides/themes) — vars() API, CSS custom properties
- Codebase: `packages/plugin-sdk/src/theme.ts` — existing `ThemePalette`, `useThemeStore`
- Codebase: `apps/mobile/app/(app)/profile/avatar.tsx` — validated upload pattern (FormData, getPublicUrl)
- Codebase: `supabase/migrations/017_avatars_storage.sql` — public bucket RLS pattern
- Codebase: `supabase/migrations/034_coach_role_profiles.sql` — `coach_profiles` schema
