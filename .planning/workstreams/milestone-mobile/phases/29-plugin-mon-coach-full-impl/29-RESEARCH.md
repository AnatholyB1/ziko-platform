# Phase 29: Plugin "Mon coach" — Full Implementation — Research

**Researched:** 2026-05-19
**Domain:** React Native plugin scaffold, Expo Router, Supabase coach backend, TanStack Query, NativeWind
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Auto-install write (INSERT into `user_plugins` with `is_enabled: true`) happens inside **PluginLoader.tsx**, immediately after the mandatory pre-load loop. After pre-loading mandatory plugins, check if `user_plugins` has a `coach` row for the current user; if not, upsert one (`plugin_id: 'coach', is_enabled: true`).
- **D-02:** Scope of auto-install: only for users where `role = 'client' || role === 'both'`. Coaches with `role = 'coach'` only do NOT get the coach plugin auto-installed.
- **D-03:** Role is read from the user profile. PluginLoader already has access to `user` from `useAuthStore`; a single Supabase query for `user_profiles.role` is needed before the upsert.
- **D-04:** The coach screen uses **TanStack Query `useQuery`** to fetch the current link status on mount.
- **D-05:** Endpoint: `GET /coach/clients/links/me` (existing Phase 25 route — returns the athlete's current coach link or null). Fallback is a direct Supabase query to `coach_client_links` table filtered by `client_id = user.id`.
- **D-06:** Loading state: full-screen `ActivityIndicator` (color `#FF5C1A`) while the query resolves.
- **D-07:** Pull-to-refresh wired to `refetch()` from `useQuery`, using `RefreshControl tintColor: '#FF5C1A'`.
- **D-08:** The "Mon coach" settings row navigates to `/(plugins)/coach/dashboard`. No duplicate revocation modal in settings.
- **D-09:** The settings section is visible only when `role === 'client' || role === 'both'` AND a coach is linked (State C). If no coach is linked, the settings section is hidden.
- **D-10:** State C linked card shows real stats: `workout_sessions` count since `linked_at`, habits completion rate from `habit_logs` for today.
- **D-11:** Both stats fetched alongside link status query. If either fails, show `--`.
- **D-12:** In `store/[id].tsx`, Phase 27 trash button gate adds tooltip: `t('store.mandatory_tooltip')` on long-press of grayed icon.
- **D-13:** All `coach.*` translation keys added to `packages/plugin-sdk/src/i18n.ts` flat dictionaries (both `fr` and `en`).

### Claude's Discretion

- Plugin package scaffold: name `@ziko/plugin-coach`, follows the exact same structure as `plugins/habits/`.
- Whether the Phase 25 backend has a `GET /coach/clients/links` (list) endpoint vs other shapes. Researcher to verify.
- `date-fns` availability: researcher to check if it's in the monorepo already before adding a dependency.

### Deferred Ideas (OUT OF SCOPE)

- AI tools `coach_get_link` / `coach_revoke_link` (Phase 31).
- Coach-initiated messaging (future milestone MOBILE-06).
- Real-time coach link updates via WebSocket/Realtime.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COACH-01 | Plugin package `@ziko/plugin-coach` created with manifest | Scaffold pattern confirmed from `plugins/habits/` |
| COACH-02 | Plugin registered in `PluginLoader.tsx` PLUGIN_LOADERS map | Exact insertion point confirmed (line 9–28) |
| COACH-03 | Auto-install for athletes on sign-in | D-01/02/03 wiring; `user_profiles.role` DB column confirmed in migration 034 |
| COACH-04 | Disabled trash button tooltip in `store/[id].tsx` | Phase 27 gate already at lines 257–260; tooltip trigger is long-press |
| COACH-06 | State A: code entry view (UI-SPEC §2) | Interaction contract fully specified in 028-UI-SPEC.md |
| COACH-07 | State B: coach preview card (UI-SPEC §3) | Backend `POST /coach/clients/links/preview` → now `POST /coach/clients/links/preview` (confirmed) |
| COACH-08 | State C: linked coach card (UI-SPEC §4) | Backend `GET /coach/clients/links/me` (confirmed) + `DELETE /coach/clients/links/:id` (confirmed) |
| COACH-09 | Constant-time error copy for State A errors | UI-SPEC §Copywriting: single key `coach.state_a.error` for ALL error codes |
| COACH-11 | Settings.tsx injection: "MON COACH" section | Injection point confirmed: after `<STGroup title="Préférences">`, role+link-status gated |
| COACH-12 | ConfirmRevocationModal with typed "COACH" confirmation | Custom `Modal` (not `showAlert`) — confirmed in UI-SPEC §5 |
| COACH-13 | fr+en i18n keys in plugin-sdk/src/i18n.ts | Flat-dict pattern confirmed; no `store.mandatory_tooltip` key exists yet |
| COACH-14 | Stats row in State C: sessions count + habits % | DB queries confirmed; `linked_at` = `created_at` on `coach_client_links` row |
</phase_requirements>

---

## Summary

Phase 29 builds the complete "Mon coach" mobile plugin from scratch. All backend routes already exist from Phase 25 — no new backend work is needed. The phase is purely a mobile-side effort: scaffold a new plugin package, register it in PluginLoader, implement three screen states driven by TanStack Query, wire the revocation flow, and inject the settings row.

The key architectural insight is that the backend uses a different endpoint shape than what the CONTEXT.md D-05 anticipated. The actual route is `GET /coach/clients/links/me` (not `/links`), it always returns HTTP 200 with `{ link: LinkRow | null, preview: CoachPreviewPayload | null }`. Similarly, the preview endpoint is `POST /coach/clients/links/preview` (POST, not GET) accepting `{ code }` in the body, and the link creation endpoint is `POST /coach/clients/links/redeem` (not `POST /links`). These differences cascade into the interaction contract and must be reflected in the plan.

A critical gap was discovered: `UserProfile` in `packages/plugin-sdk/src/types.ts` does NOT include a `role` field — even though `role` exists in the DB since migration 034. Phase 29 must add `role?: 'client' | 'coach' | 'both'` to `UserProfile` so that PluginLoader and settings.tsx can read it from `profile` without a raw cast.

**Primary recommendation:** Use the `POST /coach/clients/links/preview` + `POST /coach/clients/links/redeem` + `GET /coach/clients/links/me` + `DELETE /coach/clients/links/:id` endpoints. Add `role` to `UserProfile` type early in Wave 0. Scaffold `plugins/coach/` as an exact copy of `plugins/habits/` structure.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Plugin scaffold & manifest | Frontend (mobile plugin) | — | Follows PluginManifest contract from plugin-sdk |
| Plugin registration | Frontend (PluginLoader) | — | PLUGIN_LOADERS map; Metro bundler static import requirement |
| Auto-install logic | Frontend (PluginLoader) | Supabase DB | Upsert to `user_plugins` table after mandatory loop |
| Role-gate (client vs coach) | Frontend (PluginLoader, settings) | Supabase DB | Read from `user_profiles.role`; type fix needed in plugin-sdk |
| Link status fetch | Frontend (TanStack Query) | Backend API | `GET /coach/clients/links/me` → always 200 |
| Code validation UI | Frontend (State A screen) | Backend API | Preview via `POST /coach/clients/links/preview` |
| Link creation | Frontend (State B CTA) | Backend API | `POST /coach/clients/links/redeem` with `{ code }` |
| Link revocation | Frontend (State C modal) | Backend API | `DELETE /coach/clients/links/:id` where `id` = `link.id` |
| Stats row data | Frontend (parallel useQuery) | Supabase DB | Direct queries to `workout_sessions` + `habit_logs` |
| i18n strings | Shared (plugin-sdk/i18n.ts) | — | Flat fr/en dictionaries; both objects updated |
| Settings injection | Frontend (settings.tsx) | — | `STGroup` + `STRow` pattern, role+link gated |
| Trash button tooltip | Frontend (store/[id].tsx) | — | Long-press on grayed `View` wrapper |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react` | ^19.0.0 | React runtime | Monorepo standard |
| `react-native` | ^0.81.0 | RN primitives | Monorepo standard |
| `@ziko/plugin-sdk` | * | Types, i18n, alerts, theme | Internal SDK for all plugins |
| `@tanstack/react-query` | v5 | Link status fetching with stale-while-revalidate | App-wide pattern for server state |
| `date-fns` | ^4.0.0 | Date formatting for "Lié depuis" | **Already installed** in `plugins/habits/` — add to coach package.json same version |
| `zustand` | ^5.0.0 | Optional local state (e.g., pending code input) | App-wide state standard |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@expo/vector-icons` (Ionicons) | bundled with Expo 54 | All icons | Always — CLAUDE.md locked |
| `react-native-safe-area-context` | bundled | SafeAreaView | Screen root wrapper |
| `expo-router` | v4 | Route wrapper file | `app/(app)/(plugins)/coach/dashboard.tsx` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `date-fns/format` | `Intl.DateTimeFormat` | date-fns already installed; `Intl` has Android API level concerns with locale |
| Custom fetch | TanStack Query | TanStack already in use; gives free loading/error/refetch states |

**No new dependencies needed.** `date-fns` is already in `plugins/habits/package.json` at `^4.0.0`. The coach plugin package.json should declare the same version. No npm install at monorepo root is required — it will be resolved from the existing hoisted install.

---

## Package Legitimacy Audit

No new external packages are being installed. All dependencies (`date-fns`, `zustand`, `@tanstack/react-query`) are already present in the monorepo. This section is not applicable.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
User signs in
    │
    ▼
PluginLoader.tsx
    │── mandatory pre-load loop (existing)
    │── [NEW] query user_profiles.role for user.id
    │── [NEW] if role in ('client','both'): upsert user_plugins {plugin_id:'coach', is_enabled:true}
    │── [EXISTING] load user_plugins from DB (now includes 'coach' row)
    │── register @ziko/plugin-coach manifest → aiBridge
    │
    ▼
app/(app)/(plugins)/coach/dashboard.tsx  ← thin route wrapper
    │
    ▼
CoachScreen (plugins/coach/src/screens/CoachScreen.tsx)
    │── useQuery(['coach-link', userId]) → GET /coach/clients/links/me
    │   └── returns { link: LinkRow|null, preview: CoachPreviewPayload|null }
    │
    ├── link === null  ──► StateA (CodeEntryView)
    │       │── onSubmit(code) → POST /coach/clients/links/preview {code}
    │       │   ├── ok:true  ──► setState('preview', data.preview) → StateB
    │       │   └── ok:false ──► show constant-time error (coach.state_a.error)
    │
    ├── preview loaded ──► StateB (CoachPreviewCard)
    │       │── "Lier mon compte" → POST /coach/clients/links/redeem {code}
    │       │   ├── ok:true  ──► invalidate query → StateC
    │       │   └── ok:false ──► showAlert(coach.error.link_failed)
    │       └── "Retour à la saisie" → clear preview → StateA
    │
    └── link !== null ──► StateC (LinkedCoachCard)
            │── parallel useQuery: workout_sessions count since link.created_at
            │── parallel useQuery: habits completion % from habit_logs (today)
            │── "Retirer ce coach" → ConfirmRevocationModal
            │       └── typed "COACH" → DELETE /coach/clients/links/:link.id
            │           ├── ok → invalidate query → StateA
            │           └── error → showAlert(coach.error.revoke_failed)
            └── pull-to-refresh → refetch()

settings.tsx (profile/settings.tsx)
    │── if role in ('client','both') AND link !== null
    └── render <STGroup title="MON COACH"> → STRow → navigate /(plugins)/coach/dashboard

store/[id].tsx
    └── if manifest.mandatory → View wrapper (not TouchableOpacity)
            └── onLongPress → showAlert(store.mandatory_tooltip)  ← [NEW tooltip]
```

### Recommended Project Structure

```
plugins/coach/
├── package.json              # name: @ziko/plugin-coach, exports manifest + screens
├── tsconfig.json             # copy from plugins/habits/tsconfig.json
├── src/
│   ├── manifest.ts           # default export CoachManifest: PluginManifest
│   ├── index.ts              # re-exports for SDK consumers
│   └── screens/
│       └── CoachScreen.tsx   # root screen with 3-state logic + modal

apps/mobile/app/(app)/(plugins)/coach/
└── dashboard.tsx             # thin wrapper: import CoachScreen + supabase, render
```

### Pattern 1: Thin Route Wrapper

Every plugin dashboard route is a thin wrapper. Follow `habits/dashboard.tsx` exactly:

```typescript
// apps/mobile/app/(app)/(plugins)/coach/dashboard.tsx
import React from 'react';
import CoachScreen from '@ziko/plugin-coach/screens/CoachScreen';
import { supabase } from '../../../../src/lib/supabase';

export default function CoachDashboardRoute() {
  return <CoachScreen supabase={supabase} />;
}
```

### Pattern 2: Plugin Manifest (mandatory plugin)

```typescript
// plugins/coach/src/manifest.ts
import type { PluginManifest } from '@ziko/plugin-sdk';

const coachManifest: PluginManifest = {
  id: 'coach',
  name: 'Mon coach',
  version: '1.0.0',
  description: 'Lien avec ton coach personnel...',
  icon: 'person-outline',
  category: 'coaching',
  price: 'free',
  requiredPermissions: ['read_profile'],
  userDataKeys: ['coach_link'],
  aiSkills: [],
  aiTools: [],
  mandatory: true,          // ← prevents uninstall; grays trash button in store
  routes: [
    {
      path: '/(plugins)/coach/dashboard',
      title: 'Mon coach',
      icon: 'person-outline',
      showInTabBar: false,   // not a tab — accessed from settings only
    },
  ],
};

export default coachManifest;
```

### Pattern 3: PluginLoader Registration

```typescript
// apps/mobile/src/lib/PluginLoader.tsx — PLUGIN_LOADERS map addition
const PLUGIN_LOADERS = {
  // ...existing entries...
  coach: () => import('@ziko/plugin-coach/manifest') as any,
};

// After mandatory pre-load loop, add (D-01/02/03):
async function autoInstallCoachPlugin(userId: string) {
  // Read role
  const { data: profileRow } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single();

  const role = profileRow?.role ?? 'client';
  if (role === 'client' || role === 'both') {
    await supabase.from('user_plugins').upsert(
      { user_id: userId, plugin_id: 'coach', is_enabled: true },
      { onConflict: 'user_id,plugin_id' }
    );
  }
}
// Call after mandatory loop, before the user_plugins SELECT
```

### Pattern 4: TanStack Query for Link Status

```typescript
// Inside CoachScreen.tsx
import { useQuery, useQueryClient } from '@tanstack/react-query';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const { data, isLoading, refetch } = useQuery({
  queryKey: ['coach-link', user?.id],
  queryFn: async () => {
    const token = session?.access_token;
    const res = await fetch(`${API_URL}/coach/clients/links/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('fetch failed');
    return res.json() as Promise<{ link: LinkRow | null; preview: CoachPreviewPayload | null }>;
  },
  enabled: !!user?.id,
  staleTime: 30_000,
});
```

### Pattern 5: Backend Endpoint Contract (VERIFIED)

The actual backend routes differ from original CONTEXT.md assumptions:

| Action | Method | Path | Body | Response |
|--------|--------|------|------|----------|
| Get link status | GET | `/coach/clients/links/me` | — | `{ link: LinkRow\|null, preview: CoachPreviewPayload\|null }` |
| Preview code | POST | `/coach/clients/links/preview` | `{ code: string }` | `{ ok: bool, error_code, preview }` |
| Redeem (link account) | POST | `/coach/clients/links/redeem` | `{ code: string }` | `{ ok: bool, error_code, link, preview }` |
| Revoke | DELETE | `/coach/clients/links/:id` | — | `{ ok: true }` |

All routes are under `/coach/clients/` prefix (registered in `backend/api/src/coach/clients/service.ts`).

The preview endpoint always returns HTTP 200 with `ok: false` on error (constant-time guarantee). The `id` for the DELETE call is `link.id` from the `LinkRow` object returned by the GET.

### Pattern 6: i18n Key Addition

```typescript
// packages/plugin-sdk/src/i18n.ts
// In `const fr: TranslationDict`:
'coach.screen_title': 'Mon coach',
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
'coach.state_c.revoke': 'Retirer ce coach',
'coach.revoke_modal.title': 'Retirer ce coach ?',
'coach.revoke_modal.body': 'Cette action supprime le lien avec votre coach. Tapez COACH pour confirmer.',
'coach.revoke_modal.placeholder': 'COACH',
'coach.revoke_modal.cancel': 'Garder mon coach',
'coach.revoke_modal.confirm': 'Confirmer',
'coach.error.link_failed': 'Impossible de lier le compte.',
'coach.error.revoke_failed': 'Impossible de retirer le coach.',
'coach.error.try_again': 'Veuillez réessayer.',
'store.mandatory_tooltip': 'Ce plugin est requis par l\'application',
// In `const en: TranslationDict`:
// (mirror with EN values from UI-SPEC copywriting contract)
```

### Pattern 7: Settings Injection

The settings file is at `apps/mobile/app/(app)/profile/settings.tsx` (not `app/(app)/settings.tsx` as initially assumed — it is inside the `profile/` subdirectory).

The injection uses the existing `STGroup` + `STRow` components defined in the same file. The coach section must be:
- Conditionally rendered based on `role` AND `hasLinkedCoach`
- Placed after the `<STGroup title="Préférences">` block and before `<STGroup title="Aide & infos">`
- The settings screen does NOT currently fetch role or link status — Phase 29 must add these queries

```typescript
// Conditional block in SettingsScreen:
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
```

Note: The settings screen uses `profile` from `useAuthStore`. Because `UserProfile.role` is NOT in the type, Phase 29 must add it to the type AND cast or extend as needed. The `profile` object from `refreshProfile()` uses `select('*')` which DOES return the `role` column from the DB — so runtime data is correct, only TypeScript typing is missing.

### Anti-Patterns to Avoid

- **Using `Alert.alert` from `react-native`:** Use `showAlert` from `@ziko/plugin-sdk` for all alerts EXCEPT the revocation modal (which requires a custom `Modal` with `TextInput` — `showAlert` does not support controlled input).
- **Using `StyleSheet.create`:** CLAUDE.md forbids this. All styles must be inline style objects.
- **Forgetting `paddingBottom: 100`:** All `ScrollView contentContainerStyle` must include this per CLAUDE.md.
- **Non-Ionicons icons:** All icons must be Ionicons names. The `manifest.icon` field is passed directly to `<Ionicons name={...} />`.
- **Branching error messages by error code (State A):** Security requirement — constant-time error copy regardless of error code.
- **Using `expo-router`'s `Link` instead of `router.push`:** The rest of the app uses `router.push`. Keep consistent.
- **Assuming `profile.role` is typed:** It is NOT in `UserProfile` type — must be added in Wave 0 task before consuming it.
- **Treating `/coach/clients/links/me` as a list endpoint:** It returns a SINGLE active link (or null). Not an array.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Loading/error/refetch states | Custom fetch with useState | `useQuery` from TanStack v5 | Already in app; provides stale-while-revalidate, focus refetch, error handling |
| Date formatting "DD/MM/YYYY" | Manual string split | `date-fns/format` with `'dd/MM/yyyy'` (fr) / `'MM/dd/yyyy'` (en) | Already installed at ^4.0.0 in habits plugin |
| Modal backdrop | Custom absolute View | `Modal transparent animationType='fade'` (RN built-in) | Already pattern in community + timer plugins |
| Auth token injection | Manual header construction | `session?.access_token` from `useAuthStore` | Already established pattern |
| Plugin registry | Custom state | `usePluginRegistry` from `@ziko/plugin-sdk` | `registerPlugin` / `unregisterPlugin` already wired |

**Key insight:** Every infrastructure concern has an established solution in this codebase. Phase 29 is a feature build, not a platform build.

---

## Common Pitfalls

### Pitfall 1: Wrong settings.tsx path

**What goes wrong:** Developer edits `apps/mobile/app/(app)/settings.tsx` (which does NOT exist) instead of `apps/mobile/app/(app)/profile/settings.tsx`.
**Why it happens:** CONTEXT.md and the CLAUDE.md summary reference "settings.tsx" without the profile/ subdirectory.
**How to avoid:** Always use the verified path: `apps/mobile/app/(app)/profile/settings.tsx`.
**Warning signs:** File not found error, or edits disappearing.

### Pitfall 2: Wrong endpoint paths

**What goes wrong:** Using `GET /coach/clients/links` (list), `GET /coach/clients/links/preview?code=X` (query param), or `POST /coach/clients/links` (for link creation) — none of which exist.
**Why it happens:** CONTEXT.md D-05 described approximate endpoint names from Phase 25's planning docs, not the actual service.ts implementation.
**How to avoid:** Use the verified routes:
- `GET /coach/clients/links/me` (link status)
- `POST /coach/clients/links/preview` (code preview, body: `{ code }`)
- `POST /coach/clients/links/redeem` (create link, body: `{ code }`)
- `DELETE /coach/clients/links/:id` (revoke, `:id` is `link.id` UUID)
**Warning signs:** 404 errors during preview or link creation.

### Pitfall 3: `UserProfile.role` TypeScript error

**What goes wrong:** `profile?.role` produces a TypeScript error because `role` is not in the `UserProfile` interface in `packages/plugin-sdk/src/types.ts`.
**Why it happens:** Migration 034 added the DB column but the TypeScript type was never updated.
**How to avoid:** Wave 0 must add `role?: 'client' | 'coach' | 'both'` to `UserProfile` in `packages/plugin-sdk/src/types.ts` BEFORE the tasks that consume it.
**Warning signs:** TypeScript compile errors on `profile.role` references.

### Pitfall 4: PLUGIN_LOADERS Metro static import constraint

**What goes wrong:** Dynamic import string like `` import(`@ziko/plugin-${id}/manifest`) `` fails at Metro bundler time.
**Why it happens:** Metro requires statically-analyzable imports for code splitting.
**How to avoid:** Add the `coach` entry as a literal string to the `PLUGIN_LOADERS` object, not as a computed string.
**Warning signs:** Metro bundler warning "Unable to resolve module" or silent failure at runtime.

### Pitfall 5: Forgetting `onConflict` in upsert

**What goes wrong:** The `user_plugins` upsert throws an error on second sign-in because the row already exists (UNIQUE constraint on `user_id, plugin_id`).
**Why it happens:** Supabase `upsert` without `onConflict` may not merge correctly.
**How to avoid:** Use `supabase.from('user_plugins').upsert({...}, { onConflict: 'user_id,plugin_id' })`.
**Warning signs:** DB constraint violation errors in PluginLoader on second sign-in.

### Pitfall 6: `photo_signed_url` expiry (5-min TTL)

**What goes wrong:** Coach avatar image appears broken after 5 minutes because the signed URL from `GET /coach/clients/links/me` expires.
**Why it happens:** `SIGNED_URL_TTL_SECONDS = 300` in `backend/api/src/coach/clients/db.ts`.
**How to avoid:** TanStack Query `staleTime: 30_000` (30s) ensures the query refetches well within the 5-minute window on focus. Do NOT cache for longer than 4 minutes.
**Warning signs:** Image renders on load but shows broken image icon after navigation away and back.

### Pitfall 7: `showAlert` vs custom Modal confusion

**What goes wrong:** Using `showAlert` for the revocation modal — it does not support controlled `TextInput`.
**Why it happens:** CONTEXT.md mentions `showAlert` as the standard; revocation is the one exception.
**How to avoid:** `showAlert` is for simple OK/cancel alerts. Revocation uses `<Modal transparent animationType='fade'>` with a controlled `TextInput` for the "COACH" confirmation.
**Warning signs:** No input box in the revocation confirmation flow.

---

## Code Examples

### Verified: `getActiveLink` response shape

```typescript
// Source: backend/api/src/coach/clients/db.ts (lines 53-105)
// Return type of GET /coach/clients/links/me
type ActiveLinkResponse = {
  link: {
    id: string;          // UUID — use for DELETE /links/:id
    coach_id: string;
    client_id: string;
    created_at: string;  // ISO timestamp — use as linked_at for date display + session filter
  } | null;
  preview: {
    coach_id: string;
    display_name: string;
    bio: string | null;
    specialties: string[] | null;
    photo_signed_url: string | null;  // signed URL, 5-min TTL
    kyc_status: 'pending' | 'submitted' | 'verified' | 'rejected' | null;
  } | null;
};
// KYC badge shows when kyc_status === 'verified'
```

### Verified: `peekInvitation` (POST /links/preview) response shape

```typescript
// Source: backend/api/src/coach/clients/types.ts
type PreviewResponse =
  | { ok: true; error_code: null; preview: CoachPreviewPayload }
  | { ok: false; error_code: 'INVALID_OR_EXPIRED'; preview: null };
// Always HTTP 200 — check ok field
```

### Verified: Charset filter for code input

```typescript
// Source: 028-UI-SPEC.md §Interaction Contract
// In onChangeText handler:
const filtered = v
  .toUpperCase()
  .replace(/[^A-Z2-9]/g, '')
  .slice(0, 6);
setCode(filtered);
// Enables CTA when filtered.length === 6
```

### Verified: date-fns usage for "Lié depuis" date

```typescript
// Source: plugins/habits/package.json "date-fns": "^4.0.0"
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';

// In component:
const locale = currentLocale === 'fr' ? 'fr' : 'en';
const dateStr = format(
  new Date(link.created_at),
  locale === 'fr' ? 'dd/MM/yyyy' : 'MM/dd/yyyy',
  { locale: locale === 'fr' ? fr : enUS }
);
// Render: t('coach.state_c.linked_since').replace('{{date}}', dateStr)
```

### Verified: Stats row — sessions count query

```typescript
// Direct Supabase query (if parallel fetch alongside link status):
const { count } = await supabase
  .from('workout_sessions')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', userId)
  .gte('started_at', link.created_at);  // filter since link date
// If count is null/error: show '--'
```

### Verified: Habits % for today

```typescript
// Habits: get active habits + today logs
const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
const { data: habits } = await supabase
  .from('habits')
  .select('id')
  .eq('user_id', userId)
  .eq('is_active', true);
const { data: logs } = await supabase
  .from('habit_logs')
  .select('habit_id')
  .eq('user_id', userId)
  .eq('date', today);
const pct = habits && habits.length > 0
  ? Math.round((logs?.length ?? 0) / habits.length * 100)
  : null;
// If pct is null: show '--'
```

### Verified: Existing trash button gate in store/[id].tsx

```typescript
// Source: apps/mobile/app/(app)/store/[id].tsx lines 257-260
// Current (Phase 27):
{manifest.mandatory ? (
  <View style={{ backgroundColor: '#F4F3F0', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', opacity: 0.5 }}>
    <Ionicons name="trash-outline" size={18} color="#F44336" />
  </View>
) : (
  // TouchableOpacity uninstall button
)}

// Phase 29 adds long-press tooltip:
{manifest.mandatory ? (
  <TouchableOpacity
    onLongPress={() => showAlert(t('store.mandatory_tooltip'), '')}
    style={{ backgroundColor: '#F4F3F0', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', opacity: 0.5 }}
  >
    <Ionicons name="trash-outline" size={18} color="#F44336" />
  </TouchableOpacity>
) : ...}
// Change from View to TouchableOpacity to support onLongPress
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Alert.alert` (React Native) | `showAlert` from plugin-sdk | Phase 22+ | All plugin alerts must use showAlert; revocation modal uses custom Modal instead |
| `StyleSheet.create` | Inline style objects | Project start | No StyleSheet allowed per CLAUDE.md |
| Static mandatory field missing | `mandatory?: boolean` in PluginManifest | Phase 27 | Coach plugin sets `mandatory: true` — trash gate and bypass already implemented |
| No `role` column in user_profiles | `role TEXT CHECK ('client','coach','both') DEFAULT 'client'` | Migration 034 (Phase 22) | Type not yet in UserProfile interface — Phase 29 must add it |

**Deprecated/outdated:**
- `GET /coach/clients/links` (list endpoint): Does NOT exist. Replaced by `GET /coach/clients/links/me` (single active link, always 200).
- `GET /coach/clients/links/preview?code=X` (query param): Does NOT exist. Replaced by `POST /coach/clients/links/preview` with body `{ code }`.
- `POST /coach/clients/links` (create link): Does NOT exist. Replaced by `POST /coach/clients/links/redeem` with body `{ code }`.

---

## Answers to Claude's Discretion Questions

### 1. Plugin scaffold shape (confirmed)

`plugins/coach/` must mirror `plugins/habits/` exactly:

```
plugins/coach/
├── package.json     # name: "@ziko/plugin-coach", same exports pattern as habits
├── tsconfig.json    # copy from habits
└── src/
    ├── manifest.ts  # default export
    ├── index.ts     # re-exports
    └── screens/
        └── CoachScreen.tsx
```

**`package.json` exports pattern** (from `plugins/habits/package.json`):
```json
{
  "name": "@ziko/plugin-coach",
  "version": "1.0.0",
  "private": true,
  "main": "src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./manifest": "./src/manifest.ts",
    "./screens/CoachScreen": "./src/screens/CoachScreen.tsx"
  },
  "scripts": { "type-check": "tsc --noEmit" },
  "dependencies": {
    "@ziko/plugin-sdk": "*",
    "date-fns": "^4.0.0",
    "zustand": "^5.0.0"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-native": "^0.81.0"
  }
}
```

No changes to `turbo.json` needed — the monorepo config uses `"plugins/*"` glob in `package.json` workspaces, and `turbo.json` tasks are applied universally. Adding a new plugin package under `plugins/` is automatically picked up.

### 2. Phase 25 backend routes (verified from source code)

All four endpoints are confirmed in `backend/api/src/coach/clients/service.ts`:

| Route | Method | Path | Notes |
|-------|--------|------|-------|
| Link status | GET | `/coach/clients/links/me` | Always 200; `{ link, preview }` |
| Preview code | POST | `/coach/clients/links/preview` | Body: `{ code }`; constant-time |
| Create link | POST | `/coach/clients/links/redeem` | Body: `{ code }`; constant-time |
| Athlete revoke | DELETE | `/coach/clients/links/:id` | `:id` = `link.id` UUID |

The API base is mounted under `/coach/clients/` prefix in `app.ts`. Full URLs:
- `${API_URL}/coach/clients/links/me`
- `${API_URL}/coach/clients/links/preview`
- `${API_URL}/coach/clients/links/redeem`
- `${API_URL}/coach/clients/links/${link.id}`

### 3. date-fns availability (verified)

`date-fns` at `^4.0.0` is already a direct dependency of `plugins/habits/package.json`. It is hoisted in the npm workspace. The coach plugin package.json should declare the same version — no separate install needed at the monorepo root.

### 4. i18n structure (verified)

`packages/plugin-sdk/src/i18n.ts` uses flat `Record<string, string>` dictionaries. Two top-level objects (`fr` and `en`) share the same key namespace. Keys follow the pattern `'namespace.subkey'` (e.g., `'habits.title'`, `'store.open'`). No `store.mandatory_tooltip` key exists yet.

Addition pattern: Insert `coach.*` keys as a new block in each dictionary, grouped with a comment `// ── Coach plugin ──`. Insert `store.mandatory_tooltip` adjacent to other `store.*` keys.

### 5. settings.tsx injection point (verified)

File is at `apps/mobile/app/(app)/profile/settings.tsx`.

The injection point for the "MON COACH" section is between:
- `<STGroup title="Préférences">` (ends at line ~394)
- `<STGroup title="Aide & infos">` (starts at line ~396)

The settings screen currently has no role or link-status fetch. Phase 29 must add:
- A `role` read from `profile?.role` (once `UserProfile` is typed correctly)
- A separate `useQuery` for the coach link status (or a lightweight Supabase direct query)
- Conditional render of `<STGroup title={t('coach.settings_section') || 'MON COACH'}>` only when `(role === 'client' || role === 'both') && linkedCoach !== null`

Note: `STGroup`, `STRow` are defined inline in the same file — they are NOT exported components. The injection uses them directly.

### 6. Supabase `user_coach_links` table (verified)

The actual table name is `coach_client_links` (not `user_coach_links`). Confirmed from `backend/api/src/coach/clients/db.ts` line 64:
```typescript
.from('coach_client_links')
.select('id, coach_id, client_id, created_at')
```
Relevant columns for direct fallback queries:
- `id` (UUID) — used for DELETE revoke call
- `coach_id` (UUID)
- `client_id` (UUID) — filter by this for athlete's link
- `created_at` (TIMESTAMPTZ) — serves as `linked_at`
- `revoked_at` (TIMESTAMPTZ, nullable) — null = active link
- `expires_at` (TIMESTAMPTZ, nullable) — null = no expiry

RLS enforces that `client_id = auth.uid()` for athlete reads.

---

## Open Questions (RESOLVED)

1. **`coach.settings_section` i18n key needed**
   - What we know: The STGroup component expects a `title` string prop (not a translation key).
   - What's unclear: Should it be "MON COACH" (hardcoded FR) or use a translation key `coach.settings_section`?
   - RESOLVED: Add `coach.settings_section` key (`fr: 'MON COACH'`, `en: 'MY COACH'`) and use `t('coach.settings_section')`. Consistent with i18n-first approach. Plans implement this decision.

2. **`showInTabBar: false` route visibility**
   - What we know: All routes registered in the manifest are tab-visible based on `showInTabBar`.
   - What's unclear: If the coach plugin screen has `showInTabBar: false`, it won't appear in the tab bar — which is correct. But is it still navigable via `router.push`?
   - RESOLVED: Yes — Expo Router v4 routes are navigable regardless of tab bar visibility. `showInTabBar` only controls tab bar rendering, not route accessibility. Plans use `showInTabBar: false`.

3. **Pantry plugin in PLUGIN_LOADERS**
   - What we know: `pantry` is already in the `PLUGIN_LOADERS` map (line 27 of PluginLoader.tsx) but is NOT in the CLAUDE.md plugin catalog and not a Phase 29 concern.
   - What's unclear: Whether `coach` should be added before or after `pantry`.
   - RESOLVED: Add `coach` after `pantry` alphabetically — order does not affect behavior. Plans implement this.

---

## Environment Availability

Step 2.6: SKIPPED (no external CLI tools or services beyond the existing monorepo; no new runtime dependencies).

---

## Validation Architecture

From `.planning/config.json` — nyquist_validation not explicitly false; treat as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected in mobile or plugins (no jest.config, vitest.config, or test/ dirs found) |
| Config file | Not found |
| Quick run command | `npm run type-check` (TypeScript check as proxy) |
| Full suite command | `npm run type-check` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COACH-01 | manifest.ts exports default PluginManifest | type-check | `npm run type-check` | ❌ Wave 0 |
| COACH-02 | PluginLoader imports coach manifest | type-check | `npm run type-check` | ❌ Wave 0 |
| COACH-03 | Auto-install upsert logic | manual-only | Manual: sign in with client role account | — |
| COACH-04 | Trash button tooltip on long-press | manual-only | Manual: navigate to coach plugin in store | — |
| COACH-06 | State A renders; CTA enables at 6 chars | manual-only | Manual: open coach screen unlinked | — |
| COACH-07 | State B renders on valid code | manual-only | Manual: enter valid coach code | — |
| COACH-08 | State C renders when linked | manual-only | Manual: complete link flow | — |
| COACH-09 | Same error message for all error codes | type-check + manual | `npm run type-check` (single key usage) | — |
| COACH-11 | Settings row visible for linked client | manual-only | Manual: settings screen as linked client | — |
| COACH-12 | Revocation modal types "COACH" to enable | manual-only | Manual: tap "Retirer ce coach" | — |
| COACH-13 | All i18n keys present in fr+en | type-check | `npm run type-check` | — |
| COACH-14 | Stats row shows real data | manual-only | Manual: verify State C displays counts | — |

### Sampling Rate

- **Per task commit:** `npm run type-check`
- **Per wave merge:** `npm run type-check`
- **Phase gate:** TypeScript clean + manual smoke of full link → revoke flow before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `packages/plugin-sdk/src/types.ts` — Add `role?: 'client' | 'coach' | 'both'` to `UserProfile`
- [ ] `plugins/coach/package.json` — Bootstrap plugin package
- [ ] `plugins/coach/tsconfig.json` — Copy from `plugins/habits/tsconfig.json`
- [ ] `plugins/coach/src/manifest.ts` — Default export manifest
- [ ] `plugins/coach/src/index.ts` — Re-exports
- [ ] `plugins/coach/src/screens/CoachScreen.tsx` — Screen stub (compiles clean)
- [ ] `apps/mobile/app/(app)/(plugins)/coach/dashboard.tsx` — Thin route wrapper

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase JWT Bearer token on all `/coach/clients/*` calls |
| V3 Session Management | no | Session managed by Supabase auth; not touched in this phase |
| V4 Access Control | yes | RLS on `coach_client_links` enforces `client_id = auth.uid()` |
| V5 Input Validation | yes | Charset filter `[A-Z2-9]` on code input; `maxLength: 6`; trim on modal input |
| V6 Cryptography | no | Signed URLs generated server-side; not hand-rolled |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Code enumeration (guessing valid codes) | Information Disclosure | Constant-time error copy (single `coach.state_a.error` key); backend rate-limits `POST /links/preview` via `redemptionRateLimit` middleware |
| IDOR on link revoke | Elevation of Privilege | DELETE `/links/:id` validates `client_id = userId` in RLS; backend also validates this in `revokeLink` |
| Expired signed URL for avatar | Denial of Service | TanStack `staleTime: 30_000` keeps URL fresh within 5-min TTL |
| Accidental uninstall of mandatory plugin | Tampering | `manifest.mandatory = true` gates trash button; Phase 29 adds tooltip, not removal of gate |

---

## Sources

### Primary (HIGH confidence — verified from source code)

- `backend/api/src/coach/clients/service.ts` — Confirmed all 4 route signatures, HTTP methods, paths, body shapes
- `backend/api/src/coach/clients/db.ts` — Confirmed `getActiveLink` response shape; `coach_client_links` table name; `created_at` as linked_at
- `backend/api/src/coach/clients/types.ts` — Confirmed `CoachPreviewPayload`, `LinkRow`, `PeekRpcReturn` shapes
- `apps/mobile/src/lib/PluginLoader.tsx` — Confirmed PLUGIN_LOADERS map structure; mandatory pre-load loop location
- `packages/plugin-sdk/src/types.ts` — Confirmed `PluginManifest.mandatory?: boolean` exists; `UserProfile` missing `role`
- `plugins/habits/package.json` — Confirmed `date-fns: ^4.0.0` already installed
- `plugins/habits/src/manifest.ts` — Confirmed gold standard manifest structure
- `apps/mobile/app/(app)/(plugins)/habits/dashboard.tsx` — Confirmed thin wrapper pattern
- `apps/mobile/app/(app)/profile/settings.tsx` — Confirmed settings file path, `STGroup`/`STRow` component pattern, injection location
- `apps/mobile/app/(app)/store/[id].tsx` — Confirmed Phase 27 mandatory gate at lines 257–260 (View, not TouchableOpacity)
- `supabase/migrations/034_coach_role_profiles.sql` — Confirmed `user_profiles.role` column: `TEXT CHECK ('client','coach','both') DEFAULT 'client'`
- `packages/plugin-sdk/src/i18n.ts` — Confirmed flat dict structure; no `coach.*` or `store.mandatory_tooltip` keys yet

### Secondary (MEDIUM confidence)

- `turbo.json` — Confirmed `"plugins/*"` not explicitly listed but covered by npm workspaces in `package.json`; new plugin auto-discovered

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `useQuery` from `@tanstack/react-query` is available in plugin screens (already in app dependencies) | Standard Stack | Low — TanStack Query v5 is used throughout the app; coach plugin peerDep on react-native suffices |
| A2 | `date-fns/locale` subpath exports (`fr`, `enUS`) work with date-fns ^4.0.0 | Code Examples | Low — date-fns 4.x maintains locale subpath exports |
| A3 | `EXPO_PUBLIC_API_URL` env var is accessible in plugin screens (not only in app/ files) | Code Examples | Low — it's a public env var, accessible anywhere in Expo app |
| A4 | Settings screen `useQuery` for coach link is fast enough to not cause visible flash before the MON COACH section conditionally renders | Architecture | Medium — if slow, add a `isFetching` guard or initialize to `null` state |

**All critical claims (endpoint shapes, file paths, types) were verified from source code in this session.**

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from package.json files in repo
- Backend endpoint contract: HIGH — verified from service.ts source
- Architecture patterns: HIGH — verified from existing plugin implementations
- UserProfile.role gap: HIGH — verified absence in types.ts, presence in migration 034
- Settings injection point: HIGH — verified file path and component structure
- Pitfalls: HIGH — based on verified code inspection

**Research date:** 2026-05-19
**Valid until:** 2026-06-19 (30 days — backend is stable Phase 25 work; only mobile-side churn risk)
