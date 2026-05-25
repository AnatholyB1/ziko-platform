---
phase: 29
slug: plugin-mon-coach-full-impl
workstream: milestone-mobile
status: ready-for-planning
created: 2026-05-19
context_updated: 2026-05-19
depends_on:
  - Phase 27 (Spike — Mandatory Plugin Pattern)
  - Phase 28 (UI Design — Mon coach Plugin)
opens_gate_for:
  - Phase 31 (AI Tools — coach_get_link + coach_revoke_link)
requirements:
  - COACH-01, COACH-02, COACH-03, COACH-04, COACH-06, COACH-07, COACH-08, COACH-09
  - COACH-11, COACH-12, COACH-13, COACH-14
---

# Phase 29: Plugin "Mon coach" — Full Implementation — Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Build and ship the complete "Mon coach" mobile plugin: scaffold (`plugins/coach/` package), register in PluginLoader, auto-install for athletes, implement the 3-state screen (A = code entry, B = coach preview, C = linked coach card), inject into settings.tsx, wire revocation flow, and add fr+en i18n strings. All screens follow the 028-UI-SPEC.md pixel-for-pixel. No new backend endpoints — Phase 25 routes are reused.

**Not in scope (Phase 29):** AI tools `coach_get_link` / `coach_revoke_link` (Phase 31). Phase 30 (web surface design catch-up) is independent and runs in parallel.

</domain>

<decisions>
## Implementation Decisions

### Auto-Install for Athletes (COACH-03)

- **D-01:** Auto-install write (INSERT into `user_plugins` with `is_enabled: true`) happens inside **PluginLoader.tsx**, immediately after the mandatory pre-load loop. After pre-loading mandatory plugins, check if `user_plugins` has a `coach` row for the current user; if not, upsert one (`plugin_id: 'coach', is_enabled: true`). This is idempotent — safe to run on every sign-in.
- **D-02:** Scope of auto-install: only for users where `role = 'client' || role === 'both'`. Coaches with `role = 'coach'` only do NOT get the coach plugin auto-installed.
- **D-03:** Role is read from the user profile. PluginLoader already has access to `user` from `useAuthStore`; a single Supabase query for `user_profiles.role` is needed before the upsert.

### State Fetch Strategy (COACH-06/07/08)

- **D-04:** The coach screen uses **TanStack Query `useQuery`** to fetch the current link status on mount. This gives stale-while-revalidate, loading states, and automatic refetch on window focus — consistent with the rest of the app.
- **D-05:** Endpoint: `GET /coach/clients/links` (existing Phase 25 route — returns the athlete's current coach link or null). If this exact route doesn't exist, fallback is a direct Supabase query to `user_coach_links` table filtered by `athlete_id = user.id`.
- **D-06:** Loading state: full-screen `ActivityIndicator` (color `#FF5C1A`) while the query resolves. Do NOT optimistically assume a state before data arrives.
- **D-07:** Pull-to-refresh wired to `refetch()` from `useQuery`, using `RefreshControl tintColor: '#FF5C1A'` per UI-SPEC.

### Settings Row Action (COACH-11)

- **D-08:** The "Mon coach" settings row **navigates to `/(plugins)/coach/dashboard`** (the coach plugin screen). No duplicate revocation modal in settings — revocation happens from State C on the coach plugin screen. Settings row uses the UI-SPEC Component #6 layout: chevron-forward, coach display name as row label.
- **D-09:** The settings section is visible only when `role === 'client' || role === 'both'` AND a coach is linked (State C). If no coach is linked (State A), the settings section is hidden entirely.

### Stats Row in State C (coach.jsx mockup)

- **D-10:** The State C linked card shows a **real stats row** with two values:
  - **Séances:** count of rows in `workout_sessions` table for `user_id = athlete.id` (direct Supabase count query, filtered since link date if possible, otherwise all-time).
  - **Progression %:** habits completion rate — percentage of active habits completed today, from `habit_logs` for today's date. (Same data used by the habits plugin stats.)
- **D-11:** Both stats are fetched alongside the link status query (or as a parallel useQuery). If either query fails or returns null, show `--` for that value rather than an error.

### Disabled Trash Button (COACH-04)

- **D-12:** In `apps/mobile/app/(app)/store/[id].tsx`, the existing trash button JSX gate (Phase 27) shows a grayed-out icon when `manifest.mandatory === true`. Phase 29 adds a tooltip text: `t('store.mandatory_tooltip')` — "Ce plugin est requis par l'application" / "This plugin is required by the app". Tooltip trigger: long-press on the grayed icon.

### i18n

- **D-13:** All `coach.*` translation keys are added to **`packages/plugin-sdk/src/i18n.ts`** flat dictionaries (both `fr` and `en` objects). Keys defined in 028-UI-SPEC.md Copywriting Contract section are the source of truth. Two additional keys needed: `store.mandatory_tooltip` (fr+en) for the trash button tooltip.

### Claude's Discretion

- Plugin package scaffold: name `@ziko/plugin-coach`, follows the exact same structure as `plugins/habits/` (src/manifest.ts default export, src/screens/, package.json with workspace entry in turbo.json). Researcher to confirm exact scaffold shape.
- Whether the Phase 25 backend has a `GET /coach/clients/links` (list) endpoint vs `GET /coach/clients/links/:id` (single). Researcher to verify. If list endpoint exists, use the first element; if only preview route exists, direct Supabase fallback is acceptable.
- `date-fns` availability: researcher to check if it's in the monorepo already before adding a dependency.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design Contract (pixel-for-pixel source of truth)
- `.planning/workstreams/milestone-mobile/phases/28-ui-design-mon-coach/028-UI-SPEC.md` — Complete component inventory, spacing, typography, color, interaction contract, and copywriting for all 3 states + modal + settings row. **Locked — implementation must match exactly.**
- `C:\Users\Anatholy\Downloads\ziko\coach.jsx` — Claude Design mockup (primary visual reference). Contains StateA, StateB, StateC, RevocationModal, CoachCard, CoachPreviewAll components.

### Phase 28 Context (prior decisions)
- `.planning/workstreams/milestone-mobile/phases/28-ui-design-mon-coach/28-CONTEXT.md` — Design constraints, key decisions D-01 through D-05 (mandatory pattern, checker sign-off, settings as Phase 29 detail, stats row real data decision, registry-driven mandatory).

### Requirements
- `.planning/workstreams/milestone-mobile/REQUIREMENTS.md` — COACH-01 through COACH-14 (Phase 29 requirements), out-of-scope section. **Read before planning.**
- `.planning/workstreams/milestone-mobile/ROADMAP.md` — Phase 29 success criteria (5 items) and phase dependencies.

### Existing Code — Mandatory Plugin Pattern
- `apps/mobile/src/lib/PluginLoader.tsx` — Pre-load loop for mandatory plugins; auto-install upsert logic goes here (after mandatory loop, before user_plugins query). PLUGIN_LOADERS map needs `coach` entry.
- `packages/plugin-sdk/src/types.ts` — PluginManifest type (has `mandatory?: boolean` from Phase 27). Confirm current shape before writing manifest.
- `packages/plugin-sdk/src/i18n.ts` — Flat fr/en dictionaries; add `coach.*` keys here.

### Reference Plugin (structural pattern)
- `plugins/habits/src/manifest.ts` — Gold standard for manifest.ts structure (default export, id, mandatory, routes, aiTools, aiSkills, aiSystemPromptAddition).
- `apps/mobile/app/(app)/(plugins)/habits/dashboard.tsx` — Gold standard for plugin route wrapper (thin wrapper, imports screen + supabase, renders `<ScreenComponent supabase={supabase} />`).

### Project Conventions
- `CLAUDE.md` (root) — No StyleSheet (inline styles or NativeWind), Ionicons only, showAlert from @ziko/plugin-sdk (NOT Alert.react-native), paddingBottom: 100 on ScrollViews.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `usePluginRegistry` from `@ziko/plugin-sdk` — already used by PluginLoader; `registerPlugin` / `unregisterPlugin` pattern is established.
- `useAuthStore` — provides `user.id`, role available via Supabase query on `user_profiles`. Already imported in PluginLoader.
- `supabase` client from `apps/mobile/src/lib/supabase` — already imported in PluginLoader. Use for `user_plugins` upsert and stats queries.
- `showAlert` from `@ziko/plugin-sdk` — mandatory for all alerts in plugins (NOT React Native Alert).
- `useTranslation()` from `@ziko/plugin-sdk` — returns `t(key)` function. Coach screen uses `coach.*` namespace.

### Established Patterns
- Plugin route wrappers in `apps/mobile/app/(app)/(plugins)/<name>/dashboard.tsx` are thin: `import { supabase } from '@/lib/supabase'; import CoachScreen from '@ziko/plugin-coach/screens/CoachScreen'; export default function Page() { return <CoachScreen supabase={supabase} />; }`
- TanStack Query (`useQuery`) used throughout the app for server state. Consistent choice for coach link status.
- `RefreshControl tintColor: '#FF5C1A'` — established pattern (used in several plugin dashboards).
- `paddingBottom: 100` on all ScrollView `contentContainerStyle` — enforced by CLAUDE.md.
- Modal pattern: `Modal transparent animationType='fade'` with backdrop overlay — used in community and timer plugins.

### Integration Points
- **PluginLoader.tsx** (line ~73): mandatory pre-load loop → add `coach` upsert logic after this loop.
- **PluginLoader.tsx** (PLUGIN_LOADERS map, line ~9): add `coach: () => import('@ziko/plugin-coach/manifest') as any`.
- **apps/mobile/app/(app)/settings.tsx**: inject "MON COACH" section (role-gated, link-status-gated).
- **apps/mobile/app/(app)/store/[id].tsx**: trash button gate already exists (Phase 27); add tooltip text.
- **packages/plugin-sdk/src/i18n.ts**: add `coach.*` keys to both `fr` and `en` objects, plus `store.mandatory_tooltip`.

</code_context>

<specifics>
## Specific Ideas

- **Constant-time error copy (COACH-09):** The same error string (`coach.state_a.error`) is shown for ALL error codes from the preview endpoint (404, 410, 400, 5xx, network). No branching on error type. This is a security requirement — prevents enumeration attacks.
- **ConfirmRevocationModal:** Uses custom `Modal` (NOT `showAlert`) because it requires a controlled `TextInput` for typed confirmation. The confirm button enables only when `inputValue.trim() === 'COACH'` (exact uppercase match).
- **Stats row date filter:** If the Phase 25 link response includes `linked_at` timestamp, filter `workout_sessions` to count only sessions after `linked_at`. If not available, count all-time sessions.
- **Disabled CTA accessibility:** `accessibilityState={{ disabled: !isEnabled }}` on the submit CTA in State A — per UI-SPEC Accessibility Contract.

</specifics>

<deferred>
## Deferred Ideas

- **AI tools (coach_get_link, coach_revoke_link):** Declared in manifest with placeholder schema in Phase 29 if needed for typing, but full wiring (backend tool registry) is Phase 31.
- **Coach-initiated messaging:** Already deferred to a future milestone (MOBILE-06). Not in Phase 29 scope.
- **Real-time coach link updates (WebSocket/Realtime):** If coach revokes from web while athlete app is open, State C would not update until next pull-to-refresh. Acceptable for Phase 29 — TanStack Query refetch-on-focus handles normal cases.

</deferred>

---

*Phase: 29-plugin-mon-coach-full-impl*
*Context gathered: 2026-05-19*
