# Phase 1: Foundation - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Phase Boundary

DB migration for `coach_branding` table + public bucket setup; Hono endpoints `PATCH /coach/branding` and augmented `GET /coach/clients/links/me`; plugin-sdk `useThemeStore` gains `setCustomTheme(overrides)` and `clearCoachTheme()` actions. No UI — pure data layer.

</domain>

<decisions>
## Implementation Decisions

### Pro Gate (backend 403 guard)
- **D-01:** Pro coach = `user_profiles.tier = 'premium'`. No schema change needed. `PATCH /coach/branding` checks this column and returns 403 if the caller is not `'premium'`.
- **D-02:** The check must use the caller's JWT (the coach's own userId), not the client's. Backend reads `user_profiles` via the auth middleware's userId.

### PATCH /coach/branding — endpoint contract
- **D-03:** Body accepts exactly `{ primary_color: string; logo_url: string | null; tone: string | null }`. Mirrors DB columns 1:1. No extra fields.
- **D-04:** `primary_color` is a hex string — validate with a `^#[0-9A-Fa-f]{6}$` CHECK in the migration (matching the ROADMAP success criterion).
- **D-05:** Tone values: `'Motivant' | 'Analytique' | 'Bienveillant' | 'Exigeant'` — stored as TEXT with a CHECK constraint (project pattern, not a PG ENUM).
- **D-06:** Upsert semantics — `coach_branding` row per coach_id; PATCH creates-or-updates (no separate POST/PUT).

### GET /coach/clients/links/me — response augmentation
- **D-07:** Branding goes at the top level: `{ link, preview, branding: { primary_color, logo_url, tone } | null }`. Not nested inside `preview`.
- **D-08:** `branding: null` when the coach has no `coach_branding` row.
- **D-09:** When a row exists but `logo_url` is NULL, return the object with `logo_url: null` — not omit the field. Phase 3 applies the primary color even without a logo.

### plugin-sdk useThemeStore — new actions
- **D-10:** Signature: `setCustomTheme(overrides: Partial<ThemePalette>)`. Merges over `DEFAULT_THEME`. Phase 3 passes `{ primary: '#hex' }`; future phases can pass additional tokens without an SDK change.
- **D-11:** Auto-derive on `primary` change: `primaryLight = primary + '15'` (alpha suffix, matching the existing theme pattern); `tabBarActive = primary`; `tabBarInactive` follows the muted pattern of existing themes. These are the only auto-derived tokens — everything else falls through from `DEFAULT_THEME`.
- **D-12:** `clearCoachTheme()` action — calls `resetTheme()` internally (sets `theme: DEFAULT_THEME, equippedBanner: null`). Alias for clarity; can be a thin wrapper.
- **D-13:** No MMKV persistence in this phase. `setCustomTheme` is Zustand in-memory only. Persistence is Phase 3's responsibility.

### DB migration
- **D-14:** Migration number: `054_coach_branding.sql` (last applied is 053).
- **D-15:** `coach_branding` table separate from `coach_profiles` (different lifecycle — branding changes often, profile rarely). Already decided in STATE.md.
- **D-16:** Logo bucket: `coach-logos` (public bucket — no signed URLs; RN image cache friendly). Already decided in STATE.md.
- **D-17:** RLS: coach owns their row (`auth.uid() = coach_id`); linked athletes can read via `is_coach_of(coach_id, auth.uid())`. Signature: coach_id first, athlete second (migration 035 pattern).

### Claude's Discretion
- Hex CHECK constraint format in the migration (standard PostgreSQL `~` regex operator or explicit `CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$')`) — Claude's call, consistent with codebase patterns.
- Whether `clearCoachTheme` is a standalone function or a thin `() => resetTheme()` wrapper in the store — Claude's call.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing schema & RLS patterns
- `supabase/migrations/034_coach_role_profiles.sql` — `coach_profiles` schema + `user_profiles.role` column; shows project migration conventions (lock_timeout, IF NOT EXISTS, updated_at trigger)
- `supabase/migrations/035_coach_invitations_links_rls.sql` — `is_coach_of(coach UUID, client UUID)` function signature + RLS policy patterns for coach-athlete cross-read
- `supabase/migrations/026_ai_credits.sql` — adds `user_profiles.tier TEXT CHECK ('free','premium')` — confirms tier is the Pro gate column

### Plugin SDK theme system
- `packages/plugin-sdk/src/theme.ts` — `ThemePalette` interface, `DEFAULT_THEME`, `THEME_REGISTRY`, `useThemeStore` (setTheme, setBanner, resetTheme). New actions extend this file.

### Backend patterns
- `backend/api/src/coach/clients/db.ts` — `getActiveLink()` return shape `{ link, preview }` — this function gets augmented with `branding` in Phase 1
- `backend/api/src/coach/clients/service.ts` — clientsRouter structure + auth middleware usage
- `backend/api/src/middleware/creditGate.ts` — example of reading `user_profiles.tier` for Pro checks (reference for the 403 guard pattern)

### Roadmap & requirements
- `.planning/workstreams/da-coach/ROADMAP.md` — Phase 1 success criteria (the 4 MUST-be-TRUE items)
- `.planning/workstreams/da-coach/REQUIREMENTS.md` — FOUND-01 through FOUND-04

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useThemeStore` (`packages/plugin-sdk/src/theme.ts:164`) — Zustand store; extend with `setCustomTheme` + `clearCoachTheme` actions directly in this file
- `resetTheme()` action (line 178) — `clearCoachTheme` wraps or aliases this
- `createUserClient()` in `backend/api/src/coach/clients/db.ts:26` — reuse for the new branding DB queries
- `handle_updated_at()` trigger from migration 001 — reuse in `coach_branding` migration (same pattern as migration 034)

### Established Patterns
- Migration conventions: `SET LOCAL lock_timeout = '5s'`, `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- RLS athlete-read pattern: `USING (auth.uid() = coach_id OR public.is_coach_of(auth.uid(), coach_id))` — but for `coach_branding` the athlete reads their coach's row (flipped: `USING (auth.uid() = coach_id OR public.is_coach_of(coach_id, auth.uid()))`)
- Hono router pattern: module-level `const router = new Hono(); router.use('*', authMiddleware)` — match structure in `coach/clients/service.ts`
- Backend 403 guard: read `user_profiles.tier` for caller's userId, return `c.json({ error: 'Pro required' }, 403)` if not `'premium'`

### Integration Points
- `getActiveLink()` in `backend/api/src/coach/clients/db.ts` — augment to also fetch `coach_branding` row for the coach and return it as `branding`
- `app.ts` or coach router mounting — the new `PATCH /coach/branding` endpoint needs to be wired into the Hono app
- ThemePalette tokens derived from `primary`: `primaryLight = primary + '15'`, `tabBarActive = primary`

</code_context>

<specifics>
## Specific Ideas

- `logo_url` in `coach_branding` stores the Supabase bucket path (not a full URL) — consistent with `coach_profiles.photo_url` pattern. The mobile app constructs the public URL from the bucket path.
- Logo bucket name: `coach-logos` (distinct from `coach-kyc` which uses signed URLs). Must be created as a **public** bucket in the migration.
- The 403 response on `PATCH /coach/branding` mirrors `creditGate.ts` style — check caller's tier first, reject with 403 before touching any branding data.

</specifics>

<deferred>
## Deferred Ideas

- Tone injection into Claude system prompt (post-v1.12 — backend hook needed; in REQUIREMENTS.md future list)
- Secondary color configurable (v1.12 derives from primary automatically in Phase 3)
- Notifications push when coach updates DA (depends on v1.11 workstream)
- MMKV persistence of branding data — Phase 3 scope, not Phase 1

None emerged during discussion that weren't already in REQUIREMENTS.md deferred list.

</deferred>

---

*Phase: 1-Foundation*
*Context gathered: 2026-05-26*
