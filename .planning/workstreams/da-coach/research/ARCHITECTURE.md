# Architecture: DA Coach (Coach Branding Injection)

**Workstream:** v1.12 DA Coach
**Researched:** 2026-05-25
**Confidence:** HIGH — all findings drawn directly from existing codebase

---

## 5 Architectural Questions — Answered

---

### Q1: Where to store branding data — extend `coach_profiles` or new `coach_branding` table?

**Decision: New `coach_branding` table.**

Rationale:

- `coach_profiles` (migration 034) is the KYC/identity record. Its columns (`bio`, `specialties`, `kyc_docs`, `kyc_status`) serve the coach onboarding and public discovery flow. Adding 10+ branding columns to it mixes two bounded contexts with different change rates and different RLS needs.
- Branding has a distinct lifecycle: a coach may update their DA frequently (iteration) while their identity (KYC, bio) is stable and may be under moderation.
- A separate table enables a focused RLS policy and a clean upsert path. The `coach_profiles_own` policy on `coach_profiles` already allows ALL (SELECT/INSERT/UPDATE) for the owning coach — a new table follows the same pattern without touching the existing policy.
- The `coach_profiles` public read policy (migration 042: `coach_profiles_authenticated_read`) exposes all columns to any authenticated user. Branding data must also be readable by linked athletes — a new table can express this more explicitly.

**New table schema (migration 054):**

```sql
CREATE TABLE IF NOT EXISTS public.coach_branding (
  coach_id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  primary_color    TEXT NOT NULL DEFAULT '#FF5C1A',   -- hex, validated by CHECK
  secondary_color  TEXT NOT NULL DEFAULT '#F7F6F3',   -- hex
  logo_path        TEXT,                              -- storage path in coach-logos bucket
  coach_name_override TEXT,                          -- optional display name override
  tagline          TEXT,                             -- short tagline shown in athlete app
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_primary  CHECK (primary_color  ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT valid_secondary CHECK (secondary_color ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE TRIGGER trg_coach_branding_updated
  BEFORE UPDATE ON public.coach_branding
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.coach_branding ENABLE ROW LEVEL SECURITY;

-- Coach can write own row
CREATE POLICY "coach_branding_own" ON public.coach_branding
  FOR ALL
  USING  (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

-- Any authenticated user can read (athletes fetching their coach's DA)
CREATE POLICY "coach_branding_authenticated_read" ON public.coach_branding
  FOR SELECT TO authenticated
  USING (true);
```

---

### Q2: How should the mobile athlete fetch coach DA — via existing `GET /coach/clients/links/me` or a new endpoint?

**Decision: Extend the existing `GET /coach/clients/links/me` response — no new endpoint.**

Rationale:

- `GET /coach/clients/links/me` is the single authoritative call the mobile coach plugin already makes on every screen load (it drives the three-state UX: no link / preview / linked). Adding branding to its response eliminates a second round-trip.
- The `CoachPreviewPayload` type and `getActiveLink` db function already join `coach_profiles` to produce a composite response. Adding a JOIN to `coach_branding` in the same query follows the established pattern with zero new infrastructure.
- The mobile `CoachScreen.tsx` uses a single `useQuery` for this endpoint. Branding data arrives in the same payload that drives State C (linked) — exactly when injection is needed.

**Modified `CoachPreviewPayload`:**

```ts
export type CoachPreviewPayload = {
  coach_id: string;
  display_name: string;
  bio: string | null;
  specialties: string[] | null;
  photo_signed_url: string | null;
  kyc_status: 'pending' | 'submitted' | 'verified' | 'rejected' | null;
  // NEW — DA branding (null when coach has not configured branding yet)
  branding: {
    primary_color: string;
    secondary_color: string;
    logo_signed_url: string | null;
    coach_name_override: string | null;
    tagline: string | null;
  } | null;
};
```

**Modified `getActiveLink` db function** — add LEFT JOIN to `coach_branding` and, if `logo_path` is set, call the same `signCoachLogo` helper (mirroring the existing `signCoachPhoto` 300-second TTL pattern).

**No new Hono route needed.** The branding bounded context lives in `backend/api/src/coach/branding/` but exposes no athlete-facing route — it only backs the web editor (see Q5).

---

### Q3: How to inject dynamic colors into NativeWind/Zustand theme at runtime without restart?

**Decision: Add `setCustomTheme(palette: Partial<ThemePalette>)` action to `useThemeStore` — no restart, no NativeWind config change.**

Analysis of existing theme system:

- `useThemeStore` (plugin-sdk/src/theme.ts) holds a `ThemePalette` object in Zustand memory. All 18 plugins and 50+ mobile components subscribe to `useThemeStore((s) => s.theme)`.
- `setTheme(themeId: string)` today does a lookup in static `THEME_REGISTRY` and calls `set({ theme: palette })`. The store update propagates reactively to every subscriber immediately — no restart, no navigation needed.
- **NativeWind is not the constraint**: the existing plugins do NOT use NativeWind `className` for color tokens — they use inline style objects with `theme.primary`, `theme.background`, etc. (confirmed by searching `CoachScreen.tsx` and `_layout.tsx` — zero NativeWind color classes, only `theme.*` references in style objects). NativeWind is used for spacing/layout utilities only.
- Therefore, injecting a custom `ThemePalette` object into the store is sufficient and already propagates to every component reactively.

**New store action:**

```ts
// In plugin-sdk/src/theme.ts — ThemeState interface
setCustomTheme: (overrides: Partial<ThemePalette>) => void;
clearCoachTheme: () => void;  // revert to user's equipped theme

// Implementation
setCustomTheme: (overrides) =>
  set((s) => ({ theme: { ...s.theme, ...overrides } })),

clearCoachTheme: () =>
  set({ theme: THEME_REGISTRY[/* user's equipped theme id */] ?? DEFAULT_THEME }),
```

**Persistence strategy — MMKV via a thin hook:**

The `_layout.tsx` already restores the user's gamification theme from DB on mount (line 96). Coach DA branding follows the same on-mount pattern: after `getActiveLink` resolves with `branding != null`, call `setCustomTheme({ primary: branding.primary_color, ... })`. No MMKV persistence is needed for coach branding — it is fetched on every app foreground/refresh, same as the link status.

**Logo injection:** The `logo_signed_url` (5-min TTL signed URL) is surfaced in the Mon Coach plugin card. It does NOT need to enter `ThemePalette` — it is displayed as an `<Image>` within the plugin screen only. This keeps `ThemePalette` a pure color/font/style contract.

**Fields to inject from branding into ThemePalette:**

| Branding field | ThemePalette field |
|----------------|--------------------|
| `primary_color` | `primary`, `tabBarActive` |
| `secondary_color` | `background`, `statusBarBg` |

All other palette fields (border, text, muted, semantic colors) keep the user's current equipped theme values. Partial injection means the coach brand is a color accent layer, not a full theme replacement.

---

### Q4: Logo URL — signed URL (private bucket) or public bucket?

**Decision: Public bucket `coach-logos`, public read, authenticated write.**

Rationale:

- Coach logos are brand assets, not personal or sensitive data. There is no privacy interest in keeping them private (unlike KYC documents in `coach-kyc`).
- Signed URLs (300-second TTL, current pattern for `coach-kyc`) expire. A mobile athlete opening the coach plugin screen 10 minutes after the last `links/me` fetch would see a broken logo image. Refreshing to get a new signed URL requires an extra backend call.
- The existing `profile-photos` bucket (migration 025) already uses the pattern of private bucket + public read policy (`avatar_public_read` on `avatars`, `profile_photos_public_read` on `profile-photos`). Follow the same pattern.
- A public URL (`https://<project>.supabase.co/storage/v1/object/public/coach-logos/<coach_id>/logo.png`) is stable, CDN-cacheable, and works offline if the image was cached by the RN image component.

**New bucket (migration 054 or 055):**

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('coach-logos', 'coach-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Coach can upload/update own logo (path: <coach_id>/logo.<ext>)
CREATE POLICY "coach_logos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'coach-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "coach_logos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'coach-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "coach_logos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'coach-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- No SELECT policy needed — bucket is public=true, Supabase grants public read automatically.
```

**Consequence for `coach_branding.logo_path`:** store the raw storage path (`<coach_id>/logo.png`). The backend constructs the public URL at query time — no signing needed, no TTL expiry. The `getActiveLink` function skips the `signCoachLogo` signing step entirely and just returns `supabasePublicUrl + '/storage/v1/object/public/coach-logos/' + logo_path`.

---

### Q5: Build order — web editor first or mobile injection first?

**Decision: DB migration → backend branding module → web editor → mobile injection.**

Dependency chain:

1. **Migration 054** — `coach_branding` table + RLS + `coach-logos` bucket. Both web and mobile depend on this. Zero code required; run first.

2. **Backend: `coach/branding/` bounded module** — Hono routes for the web editor:
   - `GET /coach/branding` — fetch own branding (coach-authenticated)
   - `PUT /coach/branding` — upsert colors + name override + tagline (coach-authenticated)
   - `POST /coach/branding/logo` — signed upload URL for the logo (mirrors existing upload-url pattern from v1.3)
   - `DELETE /coach/branding/logo` — remove logo, clear `logo_path`
   - NO athlete-facing route — athlete reads branding through the modified `GET /coach/clients/links/me`.

3. **Extend `GET /coach/clients/links/me`** — add `coach_branding` LEFT JOIN in `getActiveLink`. Athlete gets branding data in the existing call. This is backend-only and independent of the web editor UI (the DB row may not exist yet — `branding: null` is a valid state, handled gracefully by the mobile injection logic).

4. **Web editor** — new page `apps/web/src/app/[locale]/(coach)/coach/branding/` with:
   - Color picker for primary/secondary
   - Logo upload (signed-URL pattern → direct-to-Supabase Storage)
   - Preview card showing how it looks in the athlete app
   - Save → `PUT /coach/branding`

5. **Mobile injection** — modify `CoachScreen.tsx` (Mon Coach plugin) to call `setCustomTheme` when `branding != null` in the `links/me` response. Add `clearCoachTheme` on unlink. No new API surface.

**Parallelization after step 2:** Steps 3, 4, and 5 can be developed in parallel once the DB migration and the branding backend module exist. The `links/me` extension (step 3) unblocks step 5. The web editor (step 4) has no mobile dependency.

---

## Component Map: New vs Modified

### New (create from scratch)

| Component | Layer | Purpose |
|-----------|-------|---------|
| `supabase/migrations/054_coach_branding.sql` | DB | `coach_branding` table + RLS + `coach-logos` bucket |
| `backend/api/src/coach/branding/` | Backend | CRUD bounded module for branding data |
| `backend/api/src/coach/branding/types.ts` | Backend | `CoachBranding`, `BrandingUpsertPayload` |
| `backend/api/src/coach/branding/db.ts` | Backend | `getBranding`, `upsertBranding`, `deleteLogo` |
| `backend/api/src/coach/branding/service.ts` | Backend | Hono routes: GET/PUT `/coach/branding`, POST/DELETE `/coach/branding/logo` |
| `apps/web/src/app/[locale]/(coach)/coach/branding/page.tsx` | Web | Coach branding editor page |
| `apps/web/src/app/[locale]/(coach)/coach/branding/BrandingClient.tsx` | Web | Client component: color pickers, logo upload, preview |

### Modified (extend existing)

| Component | Layer | Change |
|-----------|-------|--------|
| `packages/plugin-sdk/src/theme.ts` | SDK | Add `setCustomTheme(overrides)` + `clearCoachTheme()` actions to `ThemeState` and `useThemeStore` |
| `backend/api/src/coach/clients/types.ts` | Backend | Extend `CoachPreviewPayload` with `branding` field |
| `backend/api/src/coach/clients/db.ts` | Backend | `getActiveLink` LEFT JOINs `coach_branding`, constructs public logo URL |
| `plugins/coach/src/screens/CoachScreen.tsx` | Mobile | Call `setCustomTheme` on State C entry; `clearCoachTheme` on unlink |
| `backend/api/src/app.ts` (or coach router) | Backend | Mount `brandingRouter` under `/coach/branding` |
| `apps/web/src/app/[locale]/(coach)/coach/layout.tsx` (sidebar) | Web | Add "Identité visuelle" nav item linking to `/coach/branding` |

---

## Data Flow

```
Coach (web)
  └─ BrandingClient → PUT /coach/branding → coach_branding (upsert)
  └─ BrandingClient → POST /coach/branding/logo → signed URL → direct upload → coach-logos bucket

Athlete (mobile, on refresh / foreground)
  └─ CoachScreen useQuery → GET /coach/clients/links/me
       └─ getActiveLink (db.ts)
            ├─ coach_client_links (existing)
            ├─ coach_profiles (existing JOIN)
            └─ coach_branding (new LEFT JOIN)
                 └─ logo_path → public URL (no signing)
       └─ CoachPreviewPayload { ..., branding: { primary_color, secondary_color, logo_url, ... } }
  └─ CoachScreen (on data settle, State C)
       └─ setCustomTheme({ primary: branding.primary_color, tabBarActive: branding.primary_color, background: branding.secondary_color, statusBarBg: branding.secondary_color })
       └─ useThemeStore propagates reactively to all 50+ subscribers — no restart
  └─ On unlink → clearCoachTheme() → restore user's equipped gamification theme
```

---

## Key Constraints & Guard Rails

**No NativeWind color token change required.** All plugin screens use `theme.*` inline style references, not NativeWind color class names. `setCustomTheme` covers 100% of the surface.

**Theme ownership hierarchy:** user gamification theme < coach branding. Coach branding is applied on top (partial override). When the athlete unlinks, `clearCoachTheme` restores the gamification theme that `_layout.tsx` originally loaded from `user_gamification.equipped_theme`.

**Logo URL stability:** public bucket eliminates signed URL expiry. Store path only in DB; derive URL at query time. No cron needed to refresh signed URLs.

**`coach_branding` row is optional.** A coach who never configures branding returns `branding: null`. The mobile injection is a no-op. The athlete sees their default gamification theme. This is the correct default — no forced branding.

**Hex color validation:** DB CHECK constraint (`~ '^#[0-9A-Fa-f]{6}$'`) prevents invalid colors from reaching mobile. Backend Zod schema mirrors the same regex.

**Pro gate:** The DA Coach feature is described as a Pro 29€/mois differentiator. The backend `PUT /coach/branding` route should check `user_profiles.tier` (or a future `coach_profiles.subscription_tier`) and return 403 for non-Pro coaches. This check is the same middleware pattern used in the credit system (`creditCheck` middleware). For now, a simple `tier` check on the existing `user_profiles` table suffices.

---

## Sources

- `packages/plugin-sdk/src/theme.ts` — ThemePalette interface, useThemeStore, THEME_REGISTRY (7 static themes)
- `apps/mobile/app/_layout.tsx` — existing on-mount theme restore pattern (line 87–99)
- `backend/api/src/coach/clients/db.ts` — getActiveLink, CoachPreviewPayload, signCoachPhoto pattern
- `backend/api/src/coach/clients/types.ts` — CoachPreviewPayload type
- `backend/api/src/coach/identity/db.ts` — coach_profiles upsert pattern
- `supabase/migrations/034_coach_role_profiles.sql` — coach_profiles schema
- `supabase/migrations/025_storage_buckets.sql` — private bucket + public read pattern
- `supabase/migrations/037_coach_kyc_bucket.sql` — private coach bucket (contrast case)
- `plugins/coach/src/screens/CoachScreen.tsx` — existing athlete-facing coach screen
