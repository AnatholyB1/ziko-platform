# Phase 3: Mobile Injection - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Athlete mobile app reads `branding` from `GET /links/me`, applies `setCustomTheme()` globally at app startup via a root-layout bootstrap hook, persists full branding object to MMKV so cold restarts apply the coach theme with zero orange flash, and clears it automatically when the link is revoked. The coach logo replaces the KYC avatar in the Mon Coach card (State C) when set. No backend changes — pure mobile-side wiring of the Phase 1 data layer.

</domain>

<decisions>
## Implementation Decisions

### Cold-start persistence (MMKV)
- **D-01:** Install `react-native-mmkv` v3 (listed in tech stack, not yet wired). Requires a new EAS build. Synchronous reads at Zustand store init = guaranteed zero flash.
- **D-02:** Cache the full branding object `{ primary_color, logo_url, tone }` under MMKV key `coach:branding`. Same shape as the API response — no mapping needed.
- **D-03:** MMKV read happens synchronously inside `useThemeStore`'s `create()` initializer. Read `coach:branding` key; if found, call the `setCustomTheme()` logic immediately before returning the initial state. Zero-latency, no React lifecycle needed, tab bar renders with the correct color on frame 1.

### Logo in the Mon Coach card
- **D-04:** **State C** — show branding logo in the existing 72×72 circle avatar slot if `data.branding.logo_url` is set; fall back to `data.preview.photo_signed_url` (KYC photo) if not. No new layout element — same `CoachAvatar` component, new conditional source.
- **D-05:** Construct the logo public URL before passing to `Image`: `supabase.storage.from('coach-logos').getPublicUrl(branding.logo_url).data.publicUrl`. Pass result as `uri`.
- **D-06:** **State B** (preview before linking) — no branding data in `/links/preview` response. Keep existing behavior: show `preview.photo_signed_url` as avatar. No change to State B.

### Bootstrap location (startup fetch)
- **D-07:** Add `useBrandingBootstrap()` hook inside `apps/mobile/app/(app)/_layout.tsx`. Called once on authenticated mount. Responsible for fetching branding and wiring MMKV + theme.
- **D-08:** Hook uses `useQuery({ queryKey: ['coach-link', userId], queryFn: fetchLinksMe })` — **same query key** as `CoachScreen`'s existing query. TanStack Query deduplicates: CoachScreen gets the cached result for free on first visit. No double requests.
- **D-09:** `useEffect` watching `data?.branding`:
  - `branding` set → `setCustomTheme({ primary: branding.primary_color })` + write full object to MMKV `coach:branding`
  - `branding` null (no link, or coach has no branding row) → `clearCoachTheme()` + delete MMKV `coach:branding`
  - This covers cross-device revocation automatically: if athlete revoked on another device, next app open clears the local cache.

### Theme token wiring in CoachScreen
- **D-10:** `CoachScreen.tsx` currently hardcodes `#FF5C1A` in refresh indicator, button backgrounds, and card styles. These must be replaced with `theme.primary` (from `useThemeStore`) for the injected color to actually render. This is in scope for Phase 3.

### Claude's Discretion
- MMKV instance: whether to create a dedicated `coachStorage` MMKV instance or reuse a shared app-level instance — Claude's call.
- Where `fetchLinksMe` queryFn is defined: inline in both hook and CoachScreen vs. extracted to a shared file — Claude's call, but consistent with the codebase's current pattern.
- Wording of any loading/error states in the root bootstrap hook (if the fetch fails, fail silently — don't block app render).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 & 2 foundation
- `.planning/workstreams/da-coach/phases/01-foundation/01-CONTEXT.md` — all Phase 1 decisions (endpoint contract D-07–D-09, `setCustomTheme`/`clearCoachTheme` signatures D-10–D-13, MMKV persistence deferred note D-13)
- `.planning/workstreams/da-coach/phases/02-web-editor/02-CONTEXT.md` — Phase 2 decisions (logo URL construction pattern D-12)
- `.planning/workstreams/da-coach/ROADMAP.md` — Phase 3 success criteria (MOB-01 through MOB-04)
- `.planning/workstreams/da-coach/REQUIREMENTS.md` — MOB-01 through MOB-04

### Existing mobile code
- `plugins/coach/src/screens/CoachScreen.tsx` — the file being modified. States A/B/C rendering, existing `useQuery` for `/links/me`, `CoachAvatar` component, `handleRevoke` handler. Read before planning to avoid conflicts.
- `packages/plugin-sdk/src/theme.ts` — `useThemeStore` with `setCustomTheme`, `clearCoachTheme`, `DEFAULT_THEME`. New MMKV init goes in this file's `create()` call.
- `apps/mobile/app/(app)/_layout.tsx` — root authenticated layout where `useBrandingBootstrap()` is called.

### Storage patterns
- `apps/mobile/src/lib/storage.ts` — current AsyncStorage abstraction (reference for namespace pattern; MMKV setup follows a similar structure)
- `apps/mobile/src/stores/workoutStore.ts` — example of AsyncStorage usage in Zustand (reference only; MMKV replaces AsyncStorage for this specific store init)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useThemeStore` (`packages/plugin-sdk/src/theme.ts:166`) — extend the `create()` initializer to read MMKV synchronously. `setCustomTheme` and `clearCoachTheme` are already implemented.
- `CoachAvatar` component (`plugins/coach/src/screens/CoachScreen.tsx:308`) — add a `logoUrl` prop (or modify the `photoUrl` prop logic) to support the branding logo source with KYC fallback.
- `useQuery` in `CoachScreen` (`queryKey: ['coach-link', user?.id]`) — reuse this exact key in `useBrandingBootstrap` for TanStack deduplication.

### Established Patterns
- Zustand store init pattern: `create<ThemeState>()((set, get) => ({ theme: DEFAULT_THEME, ... }))` — the MMKV sync read goes at the top of this initializer, overriding the `DEFAULT_THEME` default.
- Inline style objects only — no NativeWind class interpolation for dynamic colors (from STATE.md accumulated decisions).
- `supabase.storage.from('coach-logos').getPublicUrl(path)` — public URL construction for the logo (same pattern used in Phase 2 web preview).

### Integration Points
- `useThemeStore` initializer → MMKV synchronous read of `coach:branding`
- `apps/mobile/app/(app)/_layout.tsx` → add `useBrandingBootstrap()` call
- `CoachScreen.tsx` → (1) update `CoachAvatar` to prefer branding logo in State C, (2) swap hardcoded `#FF5C1A` to `theme.primary`
- `handleRevoke` in `CoachScreen` → `clearCoachTheme()` + MMKV delete (can stay explicit for clarity even though bootstrap covers it)

</code_context>

<specifics>
## Specific Ideas

- The cold-start guarantee works as follows: MMKV read in store init applies the theme synchronously → Zustand store is ready with the coach color before React renders → tab bar renders with coach color on frame 1. The server fetch in `useBrandingBootstrap` runs async afterward and updates the store if the coach has changed their color since last open.
- For the logo in State C: construct the public URL only when `branding.logo_url` is truthy; pass it to the existing `CoachAvatar` component. Don't change the 72×72 circle layout — just the image source.
- Cross-device revocation is handled by the bootstrap `useEffect`: on next app open after revocation, the `/links/me` query returns `branding: null` → `clearCoachTheme()` fires → MMKV key deleted → next cold start restores DEFAULT_THEME.

</specifics>

<deferred>
## Deferred Ideas

- State B branding preview: augmenting `/links/preview` to return branding data — Phase 1 backend is already complete and out of scope for Phase 3.
- Tone injection into Claude system prompt — post-v1.12 (already in REQUIREMENTS.md deferred list).
- Animated theme transition when branding loads (fade from orange to coach color) — future UX enhancement.

</deferred>

---

*Phase: 3-Mobile-Injection*
*Context gathered: 2026-05-27*
