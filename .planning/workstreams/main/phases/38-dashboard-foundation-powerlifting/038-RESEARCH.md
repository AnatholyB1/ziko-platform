# Phase 38: Dashboard Foundation + Powerlifting — Research

**Researched:** 2026-05-26
**Domain:** Next.js 15 client component, Recharts v3, TanStack Query v5, Supabase browser client
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Dashboard page is a full client component (`'use client'`). `useState` manages `sport` (SportType | null) and `dateRange` ('week' | 'month' | '3m'). No SSR for chart data — all fetched client-side via browser Supabase (`createClientSupabase()`).
- **D-02:** TanStack Query v5 (`useQuery`) is the fetching mechanism. `queryKey: ['powerlifting', clientId, sport, dateRange]`. `enabled: sport === 'powerlifting'`. Auto-handles loading/error states with caching.
- **D-03:** Query logic lives in `apps/web/src/lib/dashboard/powerlifting.ts` — pure async functions returning typed data. Pattern: `fetchPowerliftingData(supabase, clientId, dateRange): Promise<PowerliftingData>`. Holds `estimate1RM` utility and data transforms.
- **D-04:** One `useQuery` call returns all 4 chart datasets: `{ sbd: SBDDataPoint[], rpe: RPEDataPoint[], tonnage: TonnageDataPoint[], intensity: IntensityDataPoint[] }`. Single loading state, single error boundary.
- **D-05:** Dashboard tab opens with no sport selected (`sport === null`). Control bar shows placeholder "Sélectionner un sport". Chart area shows prompt: "Sélectionnez un sport pour afficher le dashboard."
- **D-06:** Epley formula always: `estimate1RM(weight, reps) = weight * (1 + reps / 30)`. RPE field in `session_sets` is ignored for this calculation.
- **D-07:** `estimate1RM(weight, reps)` is a shared utility in `lib/dashboard/powerlifting.ts`. Both SBD chart and Intensity % chart call the same function.
- **D-08:** SBD chart shows max estimated 1RM per session per lift — for each session date, take the set with the highest estimated 1RM for each of Squat, Bench, Deadlift.
- **D-09:** CSS-only animation — no Framer Motion install for Phase 38. Add `@keyframes fadeInUp` to `globals.css`. Staggered fade+slide-up with `animationDelay: index * 50ms`.
- **D-10:** Animation fires on first sport selection only (when PowerliftingDashboard mounts). Date filter changes re-render charts in place — no re-animation.

### Claude's Discretion

- Exact query structure for fetching session_sets joined with workout_sessions (single join query vs separate fetches) — Claude picks based on simplicity and Supabase client-side query patterns.
- Whether to use `useMemo` for data transforms or compute inline in queryFn — Claude picks based on code clarity.
- TypeScript type definitions for dashboard data shapes — Claude follows the data shapes in UI-SPEC §Data Shape Reference.

### Deferred Ideas (OUT OF SCOPE)

- Framer Motion install — Phase 38 uses CSS-only; revisit if Phase 39 needs richer animations
- RPE-adjusted 1RM (Tuchscherer table) — Epley chosen for Phase 38
- Other 4 sport dashboards (Hyrox, Running, Bodybuilding, Weight Loss) — Phase 39 scope
- Comparison mode (two clients / two periods side-by-side) — Phase 40 scope
- PDF export button — Phase 40 scope
- AI insight chips with real content — Phase 41 scope (placeholder row built in Phase 38)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | Coach can open a "Dashboard" tab in the client detail view | `ClientTabStrip.tsx` TABS array modification identified; route shell at `[id]/dashboard/page.tsx` |
| DASH-02 | Coach can select a sport type from a dropdown to load the matching dashboard instantly | `DashboardControlBar` with `<select>` + useState; sport===null shows prompt empty state |
| DASH-03 | Coach can filter chart data by date range (week / month / 3 months) | Segmented control with `dateRange` state; TanStack Query `queryKey` includes dateRange for automatic refetch |
| PL-01 | Coach sees 1RM SBD progression chart — estimated 1RM for Squat, Bench, Deadlift over time | Epley formula confirmed; `session_sets` join `workout_sessions` + `exercises` for name filter; Recharts LineChart 3-line pattern in ComparisonChart.tsx |
| PL-02 | Coach sees Fatigue via RPE trend — session average RPE over time | `session_sets.rpe` (INTEGER 1–10); AVG per session date; `ReferenceLine` at RPE 8 for burnout warning |
| PL-03 | Coach sees Weekly Tonnage chart — total kg lifted per week | SUM(weight_kg × reps) GROUP BY ISO week from `session_sets`; Recharts BarChart |
| PL-04 | Coach sees Intensity % chart — percentage of 1RM per session | (avg_weight / estimate1RM) × 100 per session; Recharts AreaChart |
</phase_requirements>

---

## Summary

Phase 38 builds the Dashboard tab infrastructure for the coach client detail view and implements the complete Powerlifting dashboard (4 charts) on top of it. The surface is defined pixel-perfectly in `037-UI-SPEC.md` — all visual decisions are locked. The research focus is on the data layer (Supabase query patterns for `session_sets`, `workout_sessions`, `exercises`) and the missing dependency (`@tanstack/react-query` is not installed in `apps/web`).

The codebase is well-structured for this addition. `ComparisonChart.tsx` provides the exact Recharts card pattern to copy. `ClientTabStrip.tsx` requires a one-line array prepend. The browser Supabase client (`createClientSupabase()`) is already tested in production at `lib/supabase/client.ts`. The `is_coach_of()` RLS function + `session_sets_coach_read` policy (migration 035) means queries scoped to `.eq('user_id', clientId)` on the parent `workout_sessions` table automatically enforce coach access for `session_sets` via the parent-chain policy.

The key schema insight: `session_sets` does NOT store `exercise_name`. It stores `exercise_id` (FK to `exercises.id`). To filter for Squat/Bench/Deadlift by name, the query must join `exercises` on `exercise_id` and apply the ILIKE filter on `exercises.name`. This is a single Supabase `.select()` with embedded join — critical for the SBD and Intensity % charts.

**Primary recommendation:** Install `@tanstack/react-query` as Wave 0, configure `QueryClientProvider` in the coach layout (or a dedicated wrapper), then implement the route and components in a single wave with clear component-to-file mapping.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Dashboard route shell | Frontend Server (Next.js) | — | New file-based route under `[id]/dashboard/` inherits coach layout; `params` destructuring is SSR |
| Sport/date state management | Browser / Client | — | `useState` in client component — no server involvement |
| Chart data fetching | Browser / Client | Database | TanStack Query + Supabase browser client — all client-side per D-01 |
| Data transforms (Epley, grouping) | Browser / Client | — | Pure functions in `lib/dashboard/powerlifting.ts`, computed in queryFn |
| RLS enforcement | Database | — | `is_coach_of()` + `session_sets_coach_read` policy on Supabase; coach JWT auto-applies |
| Tab strip modification | Frontend Server (SSR) | Browser | `ClientTabStrip.tsx` is already `'use client'`; only the TABS array changes |
| Skeleton loading | Browser / Client | — | Inline component render during `isLoading` state |
| CSS animation (fadeInUp) | Browser / Client | — | `@keyframes` in `globals.css`, applied via className |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | ^3.8.1 | LineChart, BarChart, AreaChart with ResponsiveContainer | [VERIFIED: npm registry] — already in `apps/web/package.json`; `ComparisonChart.tsx` uses it |
| @tanstack/react-query | 5.100.14 | `useQuery` for dashboard data fetching with caching | [VERIFIED: npm registry] — v5 is current; NOT yet in `apps/web` — must install |
| @supabase/ssr | ^0.10.3 | `createBrowserClient` → `createClientSupabase()` | [VERIFIED: npm registry] — already in `apps/web/package.json`; `lib/supabase/client.ts` |
| framer-motion | ^12.38.0 | Motion library — already installed, NOT used in Phase 38 (CSS-only per D-09) | [VERIFIED: npm registry] — already in `apps/web/package.json` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | (web app dep) | `BarChart2` icon for empty state | Used in empty state component |
| next-intl | ^4.8.3 | `useLocale()` if needed for locale-aware hrefs | Already in stack; used by layout |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Query | `useState` + `useEffect` + fetch | No caching, no deduplication, more boilerplate; TanStack was chosen (D-02) |
| CSS keyframes | Framer Motion | Framer is already installed but deferred to Phase 39+ per D-09 |
| `@supabase/ssr` browser client | direct `fetch` to Hono API | Hono bypass not needed — data is already RLS-protected; direct Supabase is simpler |

**Installation (Wave 0 action):**
```bash
npm install @tanstack/react-query --workspace=apps/web
```

**Version verification:**
```bash
npm view @tanstack/react-query version   # → 5.100.14 (confirmed 2026-05-26)
npm view recharts version                # → 3.8.1 (confirmed 2026-05-26)
npm view framer-motion version           # → 12.40.0 (in package.json: ^12.38.0)
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| @tanstack/react-query | npm | ~4 yrs (2022-07-19) | very high | github.com/TanStack/query | [OK] | Approved |
| recharts | npm | ~8 yrs | very high | github.com/recharts/recharts | [OK] | Approved (pre-installed) |
| framer-motion | npm | ~7 yrs | very high | github.com/framer/motion | [OK] | Approved (pre-installed, not used Phase 38) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Coach Browser
     │
     │  navigate to /[locale]/coach/clients/[id]/dashboard
     ▼
[ClientTabStrip] ← prepend { key: 'dashboard', label: 'Dashboard' }
     │
     ▼
[DashboardPage] ('use client')
     │  useState: sport (null | SportType)
     │  useState: dateRange ('week' | 'month' | '3m')
     │
     ├─── sport === null ──────────────────► [DashboardEmptyPrompt]
     │                                       "Sélectionnez un sport..."
     │
     └─── sport === 'powerlifting' ────────► [PowerliftingDashboard]
               │  props: clientId, dateRange
               │
               │  useQuery(['powerlifting', clientId, 'powerlifting', dateRange])
               │  enabled: true, queryFn: fetchPowerliftingData(supabase, clientId, dateRange)
               │
               ├─ isLoading ──────────────► [DashboardLoadingState] (4 skeleton cards)
               │
               ├─ error ──────────────────► error card with "Erreur de chargement..."
               │
               └─ data ───────────────────► [2×2 Grid]
                                             ├─ [ChartCard] 1RM SBD (LineChart × 3 lines)
                                             ├─ [ChartCard] RPE Trend (LineChart + ReferenceLine)
                                             ├─ [ChartCard] Tonnage (BarChart)
                                             └─ [ChartCard] Intensity % (AreaChart)

fetchPowerliftingData(supabase, clientId, dateRange)
     │
     └─► Supabase query: session_sets
           .select('weight_kg, reps, rpe, exercise_order,
                    workout_sessions!inner(started_at, user_id),
                    exercises!inner(name)')
           .eq('workout_sessions.user_id', clientId)
           .gte('workout_sessions.started_at', cutoffDate)
           [RLS: session_sets_coach_read via is_coach_of()]
           │
           └─► transform: group by date → SBDDataPoint[], RPEDataPoint[],
                                           TonnageDataPoint[], IntensityDataPoint[]
```

### Recommended Project Structure

```
apps/web/src/
├── app/[locale]/(coach)/coach/clients/[id]/
│   └── dashboard/
│       ├── page.tsx          # Client component — root: state + layout
│       └── loading.tsx       # Next.js loading.tsx — DashboardLoadingState
├── components/coach/dashboard/
│   ├── DashboardControlBar.tsx    # Sport selector + date segmented control
│   ├── ChartCard.tsx              # Reusable wrapper: title + ResponsiveContainer + AI row
│   ├── PowerliftingDashboard.tsx  # 2×2 grid + useQuery + 4 chart cards
│   ├── DashboardEmptyState.tsx    # Full-area empty state (BarChart2 icon)
│   └── DashboardLoadingState.tsx  # 4 skeleton cards in 2×2 grid
└── lib/dashboard/
    └── powerlifting.ts            # fetchPowerliftingData + estimate1RM + data transforms
```

### Pattern 1: TanStack Query Setup — QueryClientProvider

**What:** `@tanstack/react-query` requires a `QueryClient` instance and `QueryClientProvider` wrapper. The web app has NO existing `QueryClientProvider` (only `@tanstack/react-table` is used, which does not need one).

**When to use:** Must be added once, at the coach layout level (or a dedicated wrapper), before any `useQuery` call works.

**Example:**
```typescript
// Source: https://tanstack.com/query/v5/docs/framework/react/quick-start
// apps/web/src/app/[locale]/(coach)/coach/layout.tsx pattern:
// Option A: create a thin 'use client' wrapper
// apps/web/src/components/coach/QueryProvider.tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute — dashboard data does not change mid-session
      },
    },
  }));
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

### Pattern 2: Supabase Join Query (session_sets → workout_sessions → exercises)

**What:** `session_sets` has no `user_id` — ownership is through `workout_sessions.user_id`. Exercise names are in `exercises.name`. A single embedded-relation query fetches everything needed for all 4 charts in one round trip.

**When to use:** All 4 powerlifting chart queries — single fetch, single transform.

**Example:**
```typescript
// Source: verified against supabase/migrations/001_initial_schema.sql + 035_coach_rls.sql
// lib/dashboard/powerlifting.ts

const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - DATE_RANGE_DAYS[dateRange]);

const { data, error } = await supabase
  .from('session_sets')
  .select(`
    weight_kg,
    reps,
    rpe,
    workout_sessions!inner (
      id,
      started_at,
      user_id
    ),
    exercises!inner (
      name
    )
  `)
  .eq('workout_sessions.user_id', clientId)          // CRITICAL: clientId from URL, NOT coach
  .gte('workout_sessions.started_at', cutoffDate.toISOString())
  .not('weight_kg', 'is', null)
  .not('reps', 'is', null);
```

**Critical note:** `session_sets` has no `user_id` column. The RLS policy (`session_sets_coach_read`, migration 035) enforces access via the parent `workout_sessions.user_id` check. The query filter `.eq('workout_sessions.user_id', clientId)` must use the embedded relation syntax.

### Pattern 3: Data Transform — SBD Grouping

**What:** After the single query, transform raw rows into chart-ready arrays using pure TS functions.

**Example:**
```typescript
// Source: derived from 037-UI-SPEC.md §Data Shape Reference + migration schema
export function estimate1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

const SBD_NAMES = {
  squat: ['squat', 'squat', 'back squat', 'front squat', 'low bar squat'],
  bench: ['bench', 'bench press', 'bench presse', 'développé couché'],
  deadlift: ['deadlift', 'soulevé de terre', 'romanian deadlift', 'rdl'],
};

function matchesLift(name: string, lift: 'squat' | 'bench' | 'deadlift'): boolean {
  const lower = name.toLowerCase();
  return SBD_NAMES[lift].some(kw => lower.includes(kw));
}

// Group by session date (workout_sessions.started_at → YYYY-MM-DD)
// For each date+lift: take MAX(estimate1RM(weight_kg, reps))
```

**Key insight:** The CONTEXT.md mentions ILIKE 'squat%' — but the Supabase JS client does not support ILIKE on a joined table's column in embedded selects. The ILIKE/matching must be done in the JavaScript transform layer after fetching all rows. Fetch all `session_sets` for the date range, then filter by exercise name in TypeScript.

### Pattern 4: Weekly Tonnage ISO Week Grouping

**What:** Group `session_sets` rows by ISO week number for the tonnage BarChart.

**Example:**
```typescript
// Source: standard ISO week calculation, no library needed
function getISOWeekLabel(dateStr: string, index: number): string {
  return `Sem. ${index + 1}`;  // UI-SPEC: 'Sem. 1', 'Sem. 2', etc.
}

function groupByWeek(rows: RawRow[]): TonnageDataPoint[] {
  const weekMap = new Map<string, number>();
  for (const row of rows) {
    const date = new Date(row.workout_sessions.started_at);
    // ISO week key: year-weeknumber
    const monday = new Date(date);
    monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    const volume = (row.weight_kg ?? 0) * (row.reps ?? 0);
    weekMap.set(key, (weekMap.get(key) ?? 0) + volume);
  }
  // Sort by date, convert to array
  return Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, tonnage], i) => ({ week: `Sem. ${i + 1}`, tonnage }));
}
```

### Anti-Patterns to Avoid

- **Filtering by exercise name in SQL via `session_sets`:** `session_sets` has no `exercise_name` column — only `exercise_id`. The ILIKE filter must be applied in the JS transform layer after fetching with the exercises join.
- **Using `createServerSupabase()` in the dashboard page:** The dashboard is a client component (`'use client'` — D-01). Using the server client crashes at runtime. Use `createClientSupabase()` from `@/lib/supabase/client`.
- **Separate queries per chart:** D-04 mandates one `useQuery` call that fetches all 4 chart datasets. Four separate `useQuery` calls create 4 independent loading states and 4 round trips.
- **Placing `QueryClientProvider` inside the dashboard page:** It must be at a layout level so it persists across tab navigation. If placed inside the dashboard page, the cache is destroyed on every navigation away.
- **Using `NEXT_PUBLIC_SUPABASE_KEY` in web app:** The web app uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` (confirmed in `lib/supabase/client.ts`, `server.ts`, `middleware.ts`). The rename to `NEXT_PUBLIC_SUPABASE_KEY` only happened in `apps/mobile`. Do not change the web app env var names.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Client-side data fetching with cache | Custom fetch hooks + localStorage | `@tanstack/react-query` `useQuery` | Handles stale-while-revalidate, deduplication, background refetch, error retry |
| Responsive chart containers | Custom resize observer | `<ResponsiveContainer width="100%" height={240}>` from recharts | Already handles all ResizeObserver edge cases; used in ComparisonChart.tsx |
| Loading skeleton animation | Custom CSS animation | Tailwind `animate-pulse` | `skeletons.tsx` already uses it; consistent with existing patterns |
| Mount animation | Framer Motion (deferred) | CSS `@keyframes fadeInUp` in `globals.css` | Per D-09; Framer is already installed but not used Phase 38 |
| ISO week grouping library | `date-fns` install | Pure `Date` arithmetic | Simple enough; no library needed for week labels |

**Key insight:** The Recharts + TanStack Query combination handles the two hardest problems (responsive charts, async data lifecycle) completely. The Supabase join query handles RLS transparently. The remaining work is pure TypeScript data transforms.

---

## Common Pitfalls

### Pitfall 1: `session_sets` exercise name filtering in SQL
**What goes wrong:** Developer writes `.ilike('exercise_name', '%squat%')` — column does not exist on `session_sets`. Query returns zero rows or errors silently.
**Why it happens:** `session_sets` only has `exercise_id` (FK). Exercise names live in the `exercises` table.
**How to avoid:** Fetch with embedded join `exercises!inner(name)`, then filter by name in TypeScript transforms.
**Warning signs:** Empty chart data for all clients despite sessions existing.

### Pitfall 2: `workout_sessions` date column is `started_at`, not `session_date`
**What goes wrong:** Developer uses `.gte('session_date', ...)` — column does not exist. Query errors or returns nothing.
**Why it happens:** The UI-SPEC mentions `session_date` as a conceptual label. The actual DB column is `workout_sessions.started_at` (TIMESTAMPTZ).
**How to avoid:** Always use `started_at` for date range filtering on `workout_sessions`.
**Warning signs:** Supabase query error logged in console.

### Pitfall 3: QueryClientProvider missing
**What goes wrong:** `useQuery` throws "No QueryClient set, use QueryClientProvider to set one."
**Why it happens:** `@tanstack/react-query` is not yet set up in `apps/web`. There is no existing `QueryClientProvider` in the coach layout.
**How to avoid:** Wave 0 must install `@tanstack/react-query` AND add `QueryProvider` wrapper to the coach layout (or `[locale]/layout.tsx`).
**Warning signs:** Runtime error on first dashboard load.

### Pitfall 4: `createServerSupabase()` called in a client component
**What goes wrong:** `import 'server-only'` at the top of `server.ts` causes a build error: "You're importing a component that needs `server-only`."
**Why it happens:** `lib/supabase/server.ts` has `import 'server-only'` on line 1. If imported in a `'use client'` component (directly or transitively), Next.js refuses to compile.
**How to avoid:** Dashboard page and PowerliftingDashboard must import from `@/lib/supabase/client` (not server).
**Warning signs:** Build-time error, not runtime.

### Pitfall 5: `[id]/dashboard/` route not matching params shape
**What goes wrong:** `params.id` is undefined at runtime.
**Why it happens:** Next.js 15 — `params` is a `Promise<{ id: string }>` (async params). Must be `const { id } = await params` in Server Components, or destructured via `use(params)` in client components.
**How to avoid:** Client component pattern for the dashboard page: accept `params: { id: string }` directly (Next.js 15 still passes plain object to client components — the Promise wrapping only affects server components). Verify by checking `sessions/page.tsx` which uses `await params` (server component). For client components, `params.id` is a plain string.
**Warning signs:** `params.id` is `undefined`, clientId is `undefined`, all queries return zero rows (no error because RLS silently filters).

### Pitfall 6: RPE field is INTEGER (1–10), not DECIMAL
**What goes wrong:** Developer expects RPE values like 7.5 (half-point). The `session_sets.rpe` column is `INTEGER CHECK (rpe BETWEEN 1 AND 10)` — only whole numbers.
**Why it happens:** Migration 001 defines rpe as INTEGER. The RPE trend chart averages these, so decimals can appear in the average, but individual session_sets only store integers.
**How to avoid:** Treat RPE as integer input; the session AVG can be rounded to 1 decimal for display.
**Warning signs:** Not a bug, just a design constraint to be aware of.

---

## Code Examples

### Supabase Browser Client (already in codebase)
```typescript
// Source: apps/web/src/lib/supabase/client.ts (VERIFIED in codebase)
import { createBrowserClient } from '@supabase/ssr';

export function createClientSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!   // web app uses ANON_KEY (not KEY)
  );
}
```

### ChartCard wrapper (from UI-SPEC, locked D-06)
```tsx
// Source: 037-UI-SPEC.md §Chart Card Anatomy
<div className="bg-white rounded-2xl border border-border p-6">
  <h3 className="text-[15px] font-semibold text-text mb-4">{title}</h3>
  <ResponsiveContainer width="100%" height={240}>
    {chart}
  </ResponsiveContainer>
  <div className="border-t border-border mt-3 pt-3 flex items-center gap-2">
    <span className="text-base leading-none">🧠</span>
    <span className="text-xs text-muted flex-1">
      {aiInsight ?? 'Analyse IA disponible en phase 41'}
    </span>
  </div>
</div>
```

### Recharts — SBD LineChart (from UI-SPEC, locked)
```tsx
// Source: 037-UI-SPEC.md §Card 1: 1RM SBD Progression
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

<LineChart data={sbdData} margin={{ top: 5, right: 8, left: -16, bottom: 5 }}>
  <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B6963' }} axisLine={false} tickLine={false} />
  <YAxis tick={{ fontSize: 11, fill: '#6B6963' }} axisLine={false} tickLine={false} />
  <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E0DA', borderRadius: '8px', fontSize: '12px' }} />
  <Legend />
  <Line type="monotone" dataKey="squat" name="Squat" stroke="#FF5C1A" strokeWidth={2} dot={false} connectNulls />
  <Line type="monotone" dataKey="bench" name="Bench" stroke="#3B82F6" strokeWidth={2} dot={false} connectNulls />
  <Line type="monotone" dataKey="deadlift" name="Deadlift" stroke="#22C55E" strokeWidth={2} dot={false} connectNulls />
</LineChart>
```

### CSS Animation (globals.css addition)
```css
/* Source: 038-CONTEXT.md D-09 + 037-UI-SPEC.md §Motion Design */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

### TanStack Query v5 hook pattern
```typescript
// Source: https://tanstack.com/query/v5/docs/framework/react/reference/useQuery
import { useQuery } from '@tanstack/react-query';
import { createClientSupabase } from '@/lib/supabase/client';
import { fetchPowerliftingData } from '@/lib/dashboard/powerlifting';

const supabase = createClientSupabase(); // stable reference — create once outside component

function PowerliftingDashboard({ clientId, dateRange }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['powerlifting', clientId, 'powerlifting', dateRange],
    queryFn: () => fetchPowerliftingData(supabase, clientId, dateRange),
    enabled: true,
    staleTime: 60_000,
  });
  // ...
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TanStack Query v4 (`useQuery` with `onSuccess`) | TanStack Query v5 (callbacks removed, `select` + `throwOnError`) | 2023 | `onSuccess`/`onError` callbacks are REMOVED in v5 — use `select`, `throwOnError`, or effect on `data`/`error` |
| Recharts v2 (100% `width`/`height` on `ResponsiveContainer`) | Recharts v3 (same API, improved performance) | 2024 | API is backward-compatible; `ResponsiveContainer` works the same |
| Next.js 14 — sync `params` | Next.js 15 — `params` is `Promise` in server components | 2024 | Client components still receive plain `params` object; only server components need `await params` |

**Deprecated/outdated:**
- TanStack Query v5: `onSuccess`, `onError`, `onSettled` callbacks on `useQuery` — removed. Use `useEffect` watching `data`/`error`, or `select` option.
- Recharts: `width` / `height` as percentages directly on chart components — use `<ResponsiveContainer>` wrapper instead.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Exercise name filtering for SBD (squat/bench/deadlift) must be done in JS layer, not SQL, because Supabase JS embedded join columns cannot be ILIKE-filtered at the Supabase-JS client level | Architecture Patterns / Pitfall 1 | If Supabase JS supports `.ilike('exercises.name', ...)` on embedded selects, a SQL-level filter would be more efficient — but JS-layer filtering is always safe as fallback |
| A2 | `params` in `dashboard/page.tsx` (client component) is a plain `{ id: string }` object, not a Promise | Pitfall 5 | If Next.js 15 wraps params in a Promise for client components too, must use `use(params)` |
| A3 | French exercise names for SBD lifts in `exercises.name` follow patterns like 'soulevé de terre', 'développé couché', 'squat' | Code Examples / Pattern 3 | If French names differ, the SBD chart shows empty/partial data — verify with `select distinct name from exercises where category='strength'` |

---

## Open Questions

1. **QueryClientProvider placement in coach layout**
   - What we know: `apps/web/src/app/[locale]/(coach)/coach/layout.tsx` is a Server Component (async, imports server-only `getCachedCoachUser`). `QueryClientProvider` must be `'use client'`.
   - What's unclear: Whether to add a thin `QueryProvider` client wrapper inside the coach layout, or wrap the entire `[locale]/layout.tsx`.
   - Recommendation: Create `components/coach/QueryProvider.tsx` (`'use client'`) and wrap `{children}` inside `CoachLayout`. This is the standard Next.js App Router pattern for mixing server layouts with client providers.

2. **Supabase embedded join filter for `workout_sessions.user_id`**
   - What we know: `session_sets` has no `user_id`. The join filter must use `workout_sessions.user_id`.
   - What's unclear: The exact Supabase JS v2 syntax for filtering on embedded table columns (`.eq('workout_sessions.user_id', clientId)` vs `.eq('workout_sessions!inner.user_id', clientId)`).
   - Recommendation: Use `workout_sessions!inner` in the select and filter with `.filter('workout_sessions.user_id', 'eq', clientId)`. The RLS policy already enforces this as a safety net — the explicit filter ensures the query scope is correct even in the absence of RLS.

3. **`loading.tsx` vs inline skeleton for dashboard**
   - What we know: All other tab pages have a `loading.tsx` alongside `page.tsx` for Next.js streaming skeleton.
   - What's unclear: Since the dashboard is a full client component that manages its own loading state via TanStack Query, whether `loading.tsx` is still useful.
   - Recommendation: Create a minimal `loading.tsx` that renders `<DashboardLoadingState />` — it appears during the Next.js route transition (before the JS hydrates), matching behavior of all other tabs.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (npm) | Package install | ✓ | (current workspace) | — |
| recharts | Recharts charts | ✓ | ^3.8.1 (in package.json) | — |
| framer-motion | Not used Phase 38 | ✓ | ^12.38.0 | — |
| @tanstack/react-query | TanStack Query hooks | ✗ — NOT in apps/web | — | Must install; no fallback |
| @supabase/ssr | createClientSupabase | ✓ | ^0.10.3 | — |
| lucide-react | Empty state icon | ✓ (in web app) | (current) | Fall back to SVG inline |

**Missing dependencies with no fallback:**
- `@tanstack/react-query` — required by D-02. Must be installed in Wave 0 before any useQuery call can work.

**Missing dependencies with fallback:**
- None (all other dependencies are already installed).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `apps/web/vitest.config.ts` |
| Quick run command | `cd apps/web && npm test -- --reporter=verbose` |
| Full suite command | `cd apps/web && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PL-01 | `estimate1RM(100, 5)` returns correct Epley value | unit | `vitest run src/lib/dashboard/powerlifting.test.ts -x` | ❌ Wave 0 |
| PL-01 | `buildSBDData(rows)` groups by date, picks max 1RM per lift | unit | `vitest run src/lib/dashboard/powerlifting.test.ts -x` | ❌ Wave 0 |
| PL-03 | `buildTonnageData(rows)` groups by ISO week, sums volume | unit | `vitest run src/lib/dashboard/powerlifting.test.ts -x` | ❌ Wave 0 |
| PL-04 | `buildIntensityData(rows)` computes correct % | unit | `vitest run src/lib/dashboard/powerlifting.test.ts -x` | ❌ Wave 0 |
| DASH-01 | Dashboard tab appears in ClientTabStrip | manual smoke | — | — |
| DASH-02 | Sport selector renders and sport===null shows prompt | manual smoke | — | — |
| DASH-03 | Date filter changes trigger new query | manual smoke | — | — |

### Sampling Rate

- **Per task commit:** `cd apps/web && npm test -- --reporter=dot` (passWithNoTests: true — safe for incomplete work)
- **Per wave merge:** `cd apps/web && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/web/src/lib/dashboard/powerlifting.test.ts` — covers estimate1RM, buildSBDData, buildTonnageData, buildIntensityData pure function unit tests
- [ ] Framework already installed (Vitest 3.x in package.json) — no gap
- [ ] `@tanstack/react-query` install: `npm install @tanstack/react-query --workspace=apps/web`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Coach auth handled by existing `getCachedCoachUser()` in layout |
| V3 Session Management | no | Existing session management unchanged |
| V4 Access Control | yes | `is_coach_of()` RLS + `session_sets_coach_read` policy already in DB; `.eq('workout_sessions.user_id', clientId)` scoping in query |
| V5 Input Validation | yes | `clientId` from URL params — validated as UUID by Supabase query (invalid UUID → empty result, not SQL injection) |
| V6 Cryptography | no | No new crypto — existing Supabase JWT flow |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Coach reads another coach's client data via crafted clientId URL | Elevation of Privilege | `is_coach_of(auth.uid(), clientId)` in RLS — DB enforces; no app-layer check needed |
| XSS via chart tooltip (exercise names) | Tampering | Recharts renders data via React virtual DOM — no `dangerouslySetInnerHTML`; exercise names are DB-sourced text, auto-escaped |
| Data exposure via shared QueryClient cache | Information Disclosure | `QueryClient` created per user session via `useState` in `QueryProvider`; server-side rendering never pre-fills cache with user data |

---

## Project Constraints (from CLAUDE.md)

- **No `StyleSheet`:** Use inline style objects or NativeWind classes (web: Tailwind via `@theme` in `globals.css`)
- **Design tokens:** Use CSS variables: `bg-background`, `text-text`, `text-muted`, `border-border`, `text-primary`, `bg-primary` (defined in `globals.css @theme`)
- **Icons:** Lucide React for web app (confirmed: already used in web components)
- **`showAlert`:** Plugin convention — not applicable to web app
- **AI SDK:** Not touched in Phase 38
- **Tab bar clearance (`paddingBottom: 100`):** Mobile-only, not applicable to web
- **All screens use `'use client'` when using browser state** — confirmed by existing pattern (`ClientTabStrip.tsx`, `ClientsTable.tsx`)
- **`NEXT_PUBLIC_SUPABASE_ANON_KEY`:** Web app env var name — do NOT rename to `NEXT_PUBLIC_SUPABASE_KEY` (that rename was mobile-only)
- **`export const dynamic = 'force-dynamic'`:** Set in `(coach)/coach/layout.tsx` — all coach routes are dynamic. Dashboard page inherits this, no need to add it.

---

## Sources

### Primary (HIGH confidence)

- `apps/web/src/components/coach/ComparisonChart.tsx` — exact Recharts card pattern, CLIENT_COLORS, ResponsiveContainer, CartesianGrid, Tooltip styles
- `apps/web/src/components/coach/ClientTabStrip.tsx` — TABS array structure, active state detection, pathname-based routing
- `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/layout.tsx` — layout structure, flex layout, `flex-1 min-w-0` content area
- `apps/web/src/lib/supabase/client.ts` — `createClientSupabase()` browser client pattern
- `supabase/migrations/001_initial_schema.sql` — `session_sets`, `workout_sessions`, `exercises` schema (confirmed column names)
- `supabase/migrations/006_session_analytics.sql` — additional `session_sets` columns
- `supabase/migrations/035_coach_invitations_links_rls.sql` — `is_coach_of()` function, `session_sets_coach_read` policy
- `apps/web/src/app/globals.css` — CSS token variables (`--color-primary`, `--color-border`, etc.)
- `apps/web/package.json` — confirmed installed packages + versions
- `.planning/workstreams/main/phases/37-ui-design-contract/037-UI-SPEC.md` — pixel-perfect spec for all chart card surfaces, locked decisions D-01–D-06 (from Phase 37)
- `.planning/workstreams/main/phases/38-dashboard-foundation-powerlifting/038-CONTEXT.md` — locked decisions D-01–D-10

### Secondary (MEDIUM confidence)

- npm registry: `npm view @tanstack/react-query version` → 5.100.14 (verified 2026-05-26)
- npm registry: `npm view recharts version` → 3.8.1 (confirmed)
- slopcheck: `@tanstack/react-query` → [OK]
- TanStack Query v5 docs: QueryClientProvider + `useState` pattern for Next.js App Router [CITED: https://tanstack.com/query/v5/docs/framework/react/quick-start]

### Tertiary (LOW confidence)

- None — all critical claims verified via codebase inspection.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json or npm registry
- Architecture: HIGH — verified against all referenced source files
- Supabase query patterns: HIGH — verified against migration SQL files
- Pitfalls: HIGH — derived directly from schema inspection (no `exercise_name` column, `started_at` not `session_date`)
- TanStack Query v5 API: MEDIUM — cited from docs; no existing v5 usage in web app to cross-reference

**Research date:** 2026-05-26
**Valid until:** 2026-06-26 (stable stack; recharts/TanStack Query API unlikely to change)
