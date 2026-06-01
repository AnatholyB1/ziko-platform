# Phase 38: Dashboard Foundation + Powerlifting - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the interactive dashboard tab for the coach client detail view: route shell, Dashboard tab entry in ClientTabStrip, global control bar (sport selector + date filter), and the complete Powerlifting dashboard (4 Recharts charts with live Supabase data and empty/loading states).

**In scope:** Dashboard route page, ClientTabStrip TABS update, DashboardControlBar component, ChartCard wrapper, PowerliftingDashboard component, 4 Supabase queries (1RM SBD, RPE trend, weekly tonnage, intensity %), empty state, skeleton loading state, CSS mount animation.

**Out of scope:** Other sport dashboards (Phase 39), comparison mode (Phase 40), PDF export (Phase 40), AI insight chips with real content (Phase 41), Framer Motion install.

</domain>

<decisions>
## Implementation Decisions

### Data Fetching Architecture
- **D-01:** Dashboard page is a **full client component** (`'use client'`). `useState` manages `sport` (SportType | null) and `dateRange` ('week' | 'month' | '3m'). No SSR for chart data — all fetched client-side via browser Supabase (`@supabase/ssr` `createBrowserClient`).
- **D-02:** **TanStack Query v5** (`useQuery`) is the fetching mechanism. `queryKey: ['powerlifting', clientId, sport, dateRange]`. `enabled: sport === 'powerlifting'`. Auto-handles loading/error states with caching — switching back to a sport after visiting another shows cached data instantly.
- **D-03:** Query logic lives in **`apps/web/src/lib/dashboard/powerlifting.ts`** — pure async functions returning typed data (not inline in component). Pattern: `fetchPowerliftingData(supabase, clientId, dateRange): Promise<PowerliftingData>`. This file also holds the `estimate1RM` utility and data transforms. Consistent path for Phase 39 to add `lib/dashboard/hyrox.ts`, etc.
- **D-04:** **One useQuery call returns all 4 chart datasets**: `{ sbd: SBDDataPoint[], rpe: RPEDataPoint[], tonnage: TonnageDataPoint[], intensity: IntensityDataPoint[] }`. Single loading state, single error boundary, consistent data timestamp across all 4 charts.

### Default Sport State
- **D-05:** Dashboard tab opens with **no sport selected** (`sport === null`). The control bar shows the placeholder "Sélectionner un sport". The chart area shows a prompt empty state: "Sélectionnez un sport pour afficher le dashboard." Coach must explicitly pick. Mirrors UI-SPEC `DashboardPage` outline.

### 1RM Estimation
- **D-06:** **Epley formula always**: `estimate1RM(weight, reps) = weight * (1 + reps / 30)`. RPE field in `session_sets` is ignored for this calculation. Simple, deterministic, consistent across all clients regardless of whether they log RPE.
- **D-07:** `estimate1RM(weight, reps)` is a **shared utility function** in `lib/dashboard/powerlifting.ts`. Both the SBD chart (max estimated 1RM per session per lift) and the Intensity % chart (avg weight / estimated 1RM × 100) call the same function. Avoids formula divergence.
- **D-08:** SBD chart shows **max estimated 1RM per session per lift** — for each session date, take the set with the highest estimated 1RM for each of Squat, Bench, Deadlift (not average; best-effort set wins).

### Animation
- **D-09:** **CSS-only animation** — no Framer Motion install for Phase 38. Add `@keyframes fadeInUp` to `globals.css`. Chart cards mount with staggered fade+slide-up: `animate-[fadeInUp_200ms_ease-out_forwards]` className + `style={{ animationDelay: \`${index * 50}ms\` }}`.
- **D-10:** Animation fires **on first sport selection only** (when PowerliftingDashboard mounts). Date filter changes (Week/Month/3M) re-render charts in place — no re-animation. Instant data update, no visual noise on rapid filter clicks.

### Claude's Discretion
- Exact query structure for fetching session_sets joined with workout_sessions (single join query vs separate fetches) — Claude picks based on simplicity and Supabase client-side query patterns.
- Whether to use `useMemo` for data transforms or compute inline in queryFn — Claude picks based on code clarity.
- TypeScript type definitions for dashboard data shapes — Claude follows the data shapes in UI-SPEC §Data Shape Reference.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design Contract (MANDATORY first read)
- `.planning/workstreams/main/phases/37-ui-design-contract/037-UI-SPEC.md` — Complete pixel-perfect spec for all surfaces: card anatomy, control bar, 2×2 grid, Recharts configs, data shapes, copy strings, empty state, loading skeleton, motion design. **Every visual decision is locked here.**
- `.planning/workstreams/main/phases/37-ui-design-contract/37-CONTEXT.md` — Phase 37 locked decisions (D-01–D-06: date filter global, 2×2 grid, SBD colors, AI chip slot, card anatomy)

### Requirements
- `.planning/workstreams/main/REQUIREMENTS.md` — v1.8 requirements (DASH-01, DASH-02, DASH-03, PL-01, PL-02, PL-03, PL-04 are Phase 38 scope)
- `.planning/workstreams/main/ROADMAP.md` §Phase 38 — success criteria (4 charts render, date filter works, empty state shows)

### Existing Components (copy patterns from these)
- `apps/web/src/components/coach/ComparisonChart.tsx` — Recharts card pattern: `CLIENT_COLORS`, `LineChart`/`BarChart` with `ResponsiveContainer`, card CSS classes (`bg-white rounded-2xl border border-border p-6`)
- `apps/web/src/components/coach/ClientTabStrip.tsx` — Add `{ key: 'dashboard', label: 'Dashboard' }` as first TABS entry; pathname-based active detection already handles it
- `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/layout.tsx` — Content area layout: `flex-1 min-w-0` (~840px at lg) + `px-8 py-6` page padding. New dashboard page slot inherits this.
- `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/sessions/page.tsx` — Server component pattern reference; dashboard diverges (client component) but Supabase `is_coach_of()` RLS usage is the same

### State Management / Data Fetching
- TanStack Query v5 already in stack — `useQuery` from `@tanstack/react-query`
- `@supabase/ssr` `createBrowserClient` — browser-side Supabase client for client components

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ComparisonChart.tsx` — copy `bg-white rounded-2xl border border-border p-6` card wrapper, `ResponsiveContainer`, `CartesianGrid`, `Tooltip` style props, `CLIENT_COLORS` array directly into new chart components
- `ClientTabStrip.tsx` TABS array — one-line addition to prepend Dashboard tab; active state via pathname already handled
- `apps/web/src/components/coach/skeletons.tsx` — existing skeleton components; check if a generic skeleton card can be extended for dashboard cards

### Established Patterns
- **Server components** (sessions, habits, nutrition pages): fetch data server-side with `createServerSupabase()`. Dashboard diverges to client component — must use `createBrowserClient` instead.
- **Supabase RLS via `is_coach_of()`**: coach's JWT cookie auto-scopes queries to clients they manage. Dashboard queries must include `.eq('user_id', clientId)` where `clientId` comes from URL params — same pattern as sessions page.
- **Page layout**: all client detail tab pages use `px-8 py-6` padding inherited from layout. Dashboard adds its own `px-8 py-6` wrapper + `mb-4` control bar + `grid grid-cols-2 gap-4` chart grid.
- **TanStack Query**: used in other parts of the web app — QueryClient/QueryClientProvider already configured.

### Integration Points
- New route: `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx` — matches `params: Promise<{ locale: string; id: string }>` pattern from other tab pages
- `ClientTabStrip.tsx` — prepend Dashboard to TABS array; `href` will be `/${locale}/coach/clients/${id}/dashboard`
- New utility: `apps/web/src/lib/dashboard/powerlifting.ts` — data fetching + transforms + `estimate1RM`
- Optional new component dir: `apps/web/src/components/coach/dashboard/` — ChartCard, DashboardControlBar, PowerliftingDashboard, DashboardEmptyState, DashboardLoadingState

</code_context>

<specifics>
## Specific Ideas

- **Sport selector placeholder:** `Sélectionner un sport` (from UI-SPEC copywriting)
- **Null sport empty state message:** `Sélectionnez un sport pour afficher le dashboard.` (prompt, not error)
- **No-data empty state heading:** `Aucune donnée disponible` + body copy per UI-SPEC §Empty State
- **SBD lift grouping:** per-session, per-exercise — filter `session_sets` to rows where `exercise_name` ILIKE 'squat%', 'bench%', 'deadlift%' (French and English exercise names exist in DB)
- **Date range SQL pattern:** `WHERE session_date >= NOW() - INTERVAL '{days} days'` where days = { week: 7, month: 30, '3m': 90 }
- **Recharts chart height locked at 240px** (D-03 from Phase 37) — do not change this

</specifics>

<deferred>
## Deferred Ideas

- Framer Motion install — Phase 38 uses CSS-only; revisit if Phase 39 needs richer sport-switch animations
- RPE-adjusted 1RM (Tuchscherer table) — Epley chosen for Phase 38; could be a future enhancement
- Other 4 sport dashboards (Hyrox, Running, Bodybuilding, Weight Loss) — Phase 39 scope
- Comparison mode (two clients / two periods side-by-side) — Phase 40 scope
- PDF export button — Phase 40 scope
- AI insight chips with real content — Phase 41 scope (placeholder row built in Phase 38)

</deferred>

---

*Phase: 38-dashboard-foundation-powerlifting*
*Context gathered: 2026-05-26*
