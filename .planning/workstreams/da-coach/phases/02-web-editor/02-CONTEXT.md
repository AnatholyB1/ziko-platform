# Phase 2: Web Editor - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

New `/coach/branding` page (standalone route, not inside settings) where a Pro coach configures their Direction Artistique: primary color hex, logo (PNG/SVG), and tone. A live 2-column preview card (mimicking the athlete's Mon Coach view) updates in real-time. Non-Pro coaches see the full editor + preview but Save is replaced by a Pro upgrade CTA. No mobile changes — web CRM only.

</domain>

<decisions>
## Implementation Decisions

### Page location & navigation
- **D-01:** New standalone route `/coach/branding` — NOT a section inside `/coach/settings`.
- **D-02:** Add "Direction artistique" nav item to `CoachSidebar.tsx` — between IA and Paramètres (or at the equivalent position). Uses an appropriate Ionicons-compatible icon (e.g. `IoColorPaletteOutline`).

### Color picker
- **D-03:** Hex text input + live color swatch. No new library dependency.
- **D-04:** Real-time validation — the swatch only activates (shows the color) when the input matches `^#[0-9A-Fa-f]{6}$`. Invalid/partial input = swatch remains neutral/grey.
- **D-05:** No alpha channel, no secondary colors — `primary_color` is a single 6-digit hex.

### Live preview card
- **D-06:** 2-column layout: form on the left, preview card on the right. Stacks to single column on mobile (responsive with Tailwind `lg:grid-cols-2`).
- **D-07:** Preview simulates the athlete's "Mon Coach" card: coach logo (or placeholder avatar), coach display name, primary color applied as border accent/header color. This is a web-native replica — not a pixel-perfect native component.
- **D-08:** Preview updates live as the coach edits color, uploads logo, or changes tone — no Save required to see the effect.

### Logo upload
- **D-09:** Direct `supabase.storage.from('coach-logos').upload(path, file, { upsert: true })` from the browser client — no signed URL. `coach-logos` is a PUBLIC bucket.
- **D-10:** Accepted formats: PNG + SVG. Max size: 2 MB. Validate client-side before upload.
- **D-11:** Path pattern: `${userId}/logo.{ext}` (upsert overwrites previous logo for the same coach).
- **D-12:** Store bucket path only (e.g. `550e8400.../logo.png`) in `coach_branding.logo_url` — NOT the full public URL. Consistent with `photo_url` pattern in `coach_profiles`. The preview constructs the public URL via `supabase.storage.from('coach-logos').getPublicUrl(path)`.

### Save & Pro gate
- **D-13:** Save calls `PATCH /coach/branding` directly (fetch with JWT Bearer token) — matches the existing API route from Phase 1. Not a Server Action.
- **D-14:** Non-Pro coaches (`tier !== 'premium'`): all controls are visible and interactive for preview, but the Save button is replaced by a Pro upgrade CTA. No hard lock or overlay — just button swap. (Per ROADMAP WEB-05.)
- **D-15:** Pro status is read from the server at page load (`user_profiles.tier`). Page component passes `isPro: boolean` to the client component.

### Claude's Discretion
- Exact icon used for the "Direction artistique" nav item — Claude's call.
- Whether the component is `BrandingClient.tsx` (like `SettingsClient.tsx`) or split into sub-components — Claude's call.
- Toast/success message wording after Save — Claude's call, following existing settings patterns.
- Whether the upgrade CTA opens a modal or links to a pricing/upgrade page — Claude's call (no upgrade flow is in scope for this phase; a link or placeholder is fine).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 foundation (built endpoints & types)
- `.planning/workstreams/da-coach/phases/01-foundation/01-CONTEXT.md` — all Phase 1 decisions (endpoint contract, DB schema, Pro gate logic, bucket name)
- `.planning/workstreams/da-coach/ROADMAP.md` — Phase 2 success criteria (WEB-01 through WEB-05)
- `.planning/workstreams/da-coach/REQUIREMENTS.md` — WEB-01 through WEB-05 requirements

### Existing web CRM patterns
- `apps/web/src/app/[locale]/(coach)/coach/settings/page.tsx` — Server Component pattern (fetch at page level, pass to Client Component)
- `apps/web/src/app/[locale]/(coach)/coach/settings/SettingsClient.tsx` — Client Component with `useActionState`, section layout (`bg-white rounded-2xl p-8 border border-border shadow-sm`)
- `apps/web/src/components/coach/PhotoUpload.tsx` — file upload pattern (client-side, validation, preview state) — note: adapt for public bucket (no signed URL)
- `apps/web/src/components/coach/CoachSidebar.tsx` — add nav item here
- `apps/web/src/app/[locale]/(coach)/coach/layout.tsx` — coach layout wrapper to check for route registration

### Backend endpoint (Phase 1 output)
- `backend/api/src/coach/branding/` — `PATCH /coach/branding` endpoint (built in Phase 1)
- `backend/api/src/middleware/creditGate.ts` — Pro gate fetch pattern (reference for reading `user_profiles.tier` server-side)

### DB schema
- `supabase/migrations/054_coach_branding.sql` — `coach_branding` table + `coach-logos` bucket (built in Phase 1)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SettingsClient.tsx` — Client Component shell with `useEffect` for JWT fetch, section card pattern (`bg-white rounded-2xl p-8 border border-border shadow-sm`). BrandingClient should follow this structure.
- `PhotoUpload.tsx` — file upload with local preview, error state, uploading spinner. Adapt: remove signed-URL logic, add SVG type, change bucket to `coach-logos`, direct upload.
- `CoachPreviewCard.tsx` — existing card component used in athlete-facing flows. Can inform the preview card design (but this is a branding preview, not the same component).
- `createClientSupabase()` — used for client-side Supabase operations including storage.

### Established Patterns
- Page = Server Component (fetches data, checks auth, passes `isPro`) → Client Component (all interaction).
- Form data flows via `useState` in client component; Save triggers a `fetch()` with JWT, not a Server Action.
- Sections are cards: `bg-white rounded-2xl p-8 border border-border shadow-sm`.
- Buttons: `h-11 px-6 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90`.
- Nav items follow `CoachSidebar.tsx` shape: `{ label, href, icon, disabled }`.

### Integration Points
- `CoachSidebar.tsx` → add "Direction artistique" nav item.
- Server Component reads `coach_branding` row (if exists) + `user_profiles.tier` to hydrate initial state.
- `PATCH /coach/branding` accepts `{ primary_color, logo_url, tone }` — exactly what the form saves.
- Preview constructs logo public URL: `supabase.storage.from('coach-logos').getPublicUrl(logo_url)`.

</code_context>

<specifics>
## Specific Ideas

- The 2-col layout mirrors how coach profile settings and preview work in onboarding wizard — consistent design language.
- Logo is displayed in a rounded container (matching the mobile app's coach avatar style) in the preview card.
- The preview card should show: logo (with fallback avatar placeholder), coach display_name (read from `coach_profiles`), primary color applied as card left-border or header accent, and tone label.
- Path for new route: `apps/web/src/app/[locale]/(coach)/coach/branding/page.tsx` + `BrandingClient.tsx`.

</specifics>

<deferred>
## Deferred Ideas

- Tone injection into Claude system prompt — post-v1.12 (needs backend hook, already in REQUIREMENTS.md deferred list)
- Secondary color or gradient support — out of scope for v1.12
- Logo cropping / resize tool in-browser — future UX improvement
- Preview in dark mode — out of scope (light sport theme only)

</deferred>

---

*Phase: 2-Web-Editor*
*Context gathered: 2026-05-27*
