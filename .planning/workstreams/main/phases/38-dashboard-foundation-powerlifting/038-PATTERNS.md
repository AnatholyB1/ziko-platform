# Phase 38: Dashboard Foundation + Powerlifting — Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 10
**Analogs found:** 9 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx` | component (page) | request-response | `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/sessions/page.tsx` | role-match (diverges: client vs server component) |
| `apps/web/src/components/coach/ClientTabStrip.tsx` | component | event-driven | self (modify TABS array) | exact |
| `apps/web/src/lib/dashboard/powerlifting.ts` | utility | transform | `apps/web/src/lib/supabase/client.ts` (Supabase client pattern) | partial |
| `apps/web/src/components/coach/dashboard/ChartCard.tsx` | component | request-response | `apps/web/src/components/coach/ComparisonChart.tsx` | role-match |
| `apps/web/src/components/coach/dashboard/DashboardControlBar.tsx` | component | event-driven | `apps/web/src/components/coach/ClientTabStrip.tsx` | role-match |
| `apps/web/src/components/coach/dashboard/PowerliftingDashboard.tsx` | component | CRUD | `apps/web/src/components/coach/ComparisonChart.tsx` | role-match |
| `apps/web/src/components/coach/dashboard/DashboardEmptyState.tsx` | component | — | `apps/web/src/components/coach/ComparisonChart.tsx` (empty branch) | partial |
| `apps/web/src/components/coach/dashboard/DashboardLoadingState.tsx` | component | — | `apps/web/src/components/coach/skeletons.tsx` + `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/loading.tsx` | role-match |
| `apps/web/src/components/coach/QueryProvider.tsx` | provider | — | no existing QueryClientProvider in web app | no analog |
| `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/layout.tsx` | layout | — | self (modify: wrap children in QueryProvider) | exact |

---

## Pattern Assignments

### `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx` (client component, request-response)

**Analog:** `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/sessions/page.tsx`

**Key divergence from analog:** Dashboard is `'use client'` — the analog is a server component. Do NOT use `createServerSupabase()` or `await params`. Use `createClientSupabase()` and access `params.id` as a plain string.

**Imports pattern** — model after sessions page but swap server imports for client:
```typescript
'use client';
import { useState } from 'react';
import { DashboardControlBar } from '@/components/coach/dashboard/DashboardControlBar';
import { PowerliftingDashboard } from '@/components/coach/dashboard/PowerliftingDashboard';
import { DashboardEmptyState } from '@/components/coach/dashboard/DashboardEmptyState';
```

**Params pattern** — client components receive plain object (NOT Promise), confirmed by layout.tsx which uses `await params` only in server component:
```typescript
export default function DashboardPage({ params }: { params: { id: string } }) {
  // params.id is a plain string in client components — no await needed
  const clientId = params.id;
```

**State pattern** — two pieces of state, no server fetch:
```typescript
  const [sport, setSport] = useState<SportType | null>(null);
  const [dateRange, setDateRange] = useState<'week' | 'month' | '3m'>('month');
```

**Page padding pattern** — copy from layout.tsx line 64: `<div className="flex gap-6 p-8 pt-6">` for content area; tab page adds its own inner padding:
```typescript
  return (
    <div className="px-8 py-6">
      <DashboardControlBar ... />
      {sport === null && <DashboardEmptyState prompt />}
      {sport === 'powerlifting' && (
        <PowerliftingDashboard clientId={clientId} dateRange={dateRange} />
      )}
    </div>
  );
```

**No-data empty state pattern** — copy from sessions page lines 56-58:
```typescript
<p className="text-sm text-muted py-8 text-center">
  Aucune donnée disponible pour cette période.
</p>
```

---

### `apps/web/src/components/coach/ClientTabStrip.tsx` (modify — add Dashboard tab)

**Analog:** self

**Exact modification** — prepend one entry to the TABS array (lines 5-14 of `ClientTabStrip.tsx`):

**Current TABS array** (lines 5-14):
```typescript
const TABS = [
  { key: 'sessions', label: 'Séances' },
  { key: 'measurements', label: 'Mesures' },
  { key: 'habits', label: 'Habitudes' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'sleep', label: 'Sommeil' },
  { key: 'cardio', label: 'Cardio' },
  { key: 'journal', label: 'Journal' },
  { key: 'programs', label: 'Programmes' },
];
```

**After modification:**
```typescript
const TABS = [
  { key: 'dashboard', label: 'Dashboard' },  // NEW — prepend as position 0
  { key: 'sessions', label: 'Séances' },
  // ... rest unchanged
];
```

**Active state pattern** (lines 27-38 — no change needed, works for dashboard automatically):
```typescript
const isActive = pathname.endsWith(`/${tab.key}`);
// Active: 'border-primary text-primary font-bold'
// Inactive: 'border-transparent text-muted hover:text-text hover:border-border'
```

---

### `apps/web/src/lib/dashboard/powerlifting.ts` (utility, transform)

**Analog:** `apps/web/src/lib/supabase/client.ts` (Supabase client pattern) + RESEARCH.md §Pattern 2-4

**Imports pattern:**
```typescript
import type { SupabaseClient } from '@supabase/ssr';
```

**Supabase client usage pattern** — from `client.ts` line 2-8 (createBrowserClient pattern):
```typescript
// Note: supabase instance is passed in as a parameter — NOT created inside this file.
// Caller creates it with: import { createClientSupabase } from '@/lib/supabase/client';
```

**Core query pattern** — single join query fetching all 4 chart datasets:
```typescript
export async function fetchPowerliftingData(
  supabase: SupabaseClient,
  clientId: string,
  dateRange: 'week' | 'month' | '3m'
): Promise<PowerliftingData> {
  const DATE_RANGE_DAYS = { week: 7, month: 30, '3m': 90 };
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
    .eq('workout_sessions.user_id', clientId)   // clientId from URL — NOT coach id
    .gte('workout_sessions.started_at', cutoffDate.toISOString())
    .not('weight_kg', 'is', null)
    .not('reps', 'is', null);

  if (error) throw new Error(error.message);
  // ...transforms below
}
```

**Supabase `.eq()` on client page pattern** — from sessions page lines 44-49:
```typescript
// CRITICAL pattern from sessions/page.tsx:
.eq('user_id', clientId)   // clientId from URL params — NOT user.id (coach)
```

**estimate1RM utility** — pure function, no imports:
```typescript
export function estimate1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return weight * (1 + reps / 30); // Epley formula — D-06
}
```

**Exercise name matching** — JS-layer filter (no SQL ILIKE on joined column):
```typescript
const SBD_KEYWORDS = {
  squat: ['squat', 'back squat', 'front squat', 'low bar squat'],
  bench: ['bench', 'bench press', 'développé couché'],
  deadlift: ['deadlift', 'soulevé de terre', 'romanian deadlift', 'rdl'],
};

function matchesLift(name: string, lift: 'squat' | 'bench' | 'deadlift'): boolean {
  const lower = name.toLowerCase();
  return SBD_KEYWORDS[lift].some((kw) => lower.includes(kw));
}
```

**Weekly tonnage ISO grouping** — pure TS, no library:
```typescript
// Monday-based ISO week key from a Date
const monday = new Date(date);
monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
const key = monday.toISOString().slice(0, 10);
```

---

### `apps/web/src/components/coach/dashboard/ChartCard.tsx` (component, request-response)

**Analog:** `apps/web/src/components/coach/ComparisonChart.tsx`

**Imports pattern** (ComparisonChart.tsx lines 1-14):
```typescript
'use client';
import { ResponsiveContainer } from 'recharts';
```

**Card wrapper pattern** (ComparisonChart.tsx lines 54-56, 81-82) — copy card CSS classes exactly:
```typescript
<div className="bg-white rounded-2xl border border-border p-6">
```

**Full card anatomy** — locked in UI-SPEC §3, confirmed by ComparisonChart card pattern:
```typescript
export function ChartCard({
  title,
  children,
  aiInsight,
  style,
  className,
}: {
  title: string;
  children: React.ReactNode;
  aiInsight?: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-border p-6 ${className ?? ''}`} style={style}>
      <h3 className="text-[15px] font-semibold text-text mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={240}>
        {children}
      </ResponsiveContainer>
      <div className="border-t border-border mt-3 pt-3 flex items-center gap-2">
        <span className="text-base leading-none">🧠</span>
        <span className="text-xs text-muted flex-1">
          {aiInsight ?? 'Analyse IA disponible en phase 41'}
        </span>
      </div>
    </div>
  );
}
```

**ResponsiveContainer pattern** (ComparisonChart.tsx lines 55-58):
```typescript
<ResponsiveContainer
  width="100%"
  height={384}        // dashboard uses 240 per UI-SPEC D-03
  aria-label={`...`}
>
```

**CartesianGrid/Tooltip shared props** (ComparisonChart.tsx lines 61-64) — used across all 4 charts:
```typescript
<CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
<XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B6963' }} axisLine={false} tickLine={false} />
<YAxis tick={{ fontSize: 11, fill: '#6B6963' }} axisLine={false} tickLine={false} />
<Tooltip
  contentStyle={{
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E0DA',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#1C1A17',
  }}
/>
```

**CLIENT_COLORS** (ComparisonChart.tsx line 17) — copy directly:
```typescript
export const CLIENT_COLORS = ['#FF5C1A', '#3B82F6', '#22C55E', '#A855F7', '#F59E0B'];
```

---

### `apps/web/src/components/coach/dashboard/DashboardControlBar.tsx` (component, event-driven)

**Analog:** `apps/web/src/components/coach/ClientTabStrip.tsx`

**Imports pattern** (ClientTabStrip.tsx lines 1-3):
```typescript
'use client';
// No router imports needed — DashboardControlBar uses callback props, not navigation
```

**Sport selector pattern** — native `<select>`, no library (from UI-SPEC §2):
```typescript
<select
  value={sport ?? ''}
  onChange={(e) => onSportChange((e.target.value as SportType) || null)}
  className="h-9 px-3 pr-8 text-sm font-medium bg-white border border-border rounded-lg
             appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20
             focus:border-primary transition-colors min-w-[200px]"
>
  <option value="">Sélectionner un sport</option>
  <option value="powerlifting">Powerlifting</option>
  <option value="hyrox">Hyrox</option>
  <option value="running">Running / Cardio</option>
  <option value="bodybuilding">Bodybuilding</option>
  <option value="weightloss">Perte de poids</option>
</select>
```

**Date segmented control pattern** (from UI-SPEC §2):
```typescript
const DATE_OPTIONS = [
  { key: 'week' as const, label: 'Semaine' },
  { key: 'month' as const, label: 'Mois' },
  { key: '3m' as const, label: '3 Mois' },
];

<div className="flex items-center gap-0 bg-surface-alt rounded-lg p-0.5 border border-border">
  {DATE_OPTIONS.map(({ key, label }) => (
    <button
      key={key}
      onClick={() => onDateRangeChange(key)}
      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
        dateRange === key
          ? 'bg-primary text-white shadow-sm'
          : 'text-muted hover:text-text'
      }`}
    >
      {label}
    </button>
  ))}
</div>
```

**Active state pattern** — mirrored from ClientTabStrip.tsx line 33-36:
```typescript
// ClientTabStrip uses: 'border-primary text-primary font-bold'
// DashboardControlBar date segment uses: 'bg-primary text-white' (pill style, not underline)
```

**Container layout** (UI-SPEC §2 locked):
```typescript
<div className="flex items-center justify-between mb-4">
  {/* left: sport selector */}
  {/* right: date segmented control */}
</div>
```

---

### `apps/web/src/components/coach/dashboard/PowerliftingDashboard.tsx` (component, CRUD)

**Analog:** `apps/web/src/components/coach/ComparisonChart.tsx`

**Imports pattern** — all Recharts + TanStack Query:
```typescript
'use client';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { createClientSupabase } from '@/lib/supabase/client';
import { fetchPowerliftingData } from '@/lib/dashboard/powerlifting';
import { ChartCard } from './ChartCard';
import { DashboardLoadingState } from './DashboardLoadingState';
import { DashboardEmptyState } from './DashboardEmptyState';
```

**TanStack Query v5 hook pattern** (from RESEARCH.md §Code Examples):
```typescript
// Stable Supabase reference — create outside component to avoid re-creation on every render
const supabase = createClientSupabase();

export function PowerliftingDashboard({
  clientId,
  dateRange,
}: {
  clientId: string;
  dateRange: 'week' | 'month' | '3m';
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['powerlifting', clientId, 'powerlifting', dateRange],
    queryFn: () => fetchPowerliftingData(supabase, clientId, dateRange),
    enabled: true,
    staleTime: 60_000,
  });
```

**Grid layout** (UI-SPEC §4 locked):
```typescript
<div className="grid grid-cols-2 gap-4">
  {/* 4 ChartCard components with stagger animation */}
</div>
```

**CSS stagger animation** (D-09, D-10 — CONTEXT.md):
```typescript
// Add to each ChartCard's wrapper div:
className="opacity-0 animate-[fadeInUp_200ms_ease-out_forwards]"
style={{ animationDelay: `${index * 50}ms` }}
// NOTE: Animation only fires on mount — do NOT add key prop based on dateRange
```

**SBD LineChart** (UI-SPEC §4 Card 1 — locked colors):
```typescript
<LineChart data={data.sbd} margin={{ top: 5, right: 8, left: -16, bottom: 5 }}>
  {/* shared CartesianGrid/XAxis/YAxis/Tooltip props above */}
  <Legend />
  <Line type="monotone" dataKey="squat"     name="Squat"     stroke="#FF5C1A" strokeWidth={2} dot={false} connectNulls />
  <Line type="monotone" dataKey="bench"     name="Bench"     stroke="#3B82F6" strokeWidth={2} dot={false} connectNulls />
  <Line type="monotone" dataKey="deadlift"  name="Deadlift"  stroke="#22C55E" strokeWidth={2} dot={false} connectNulls />
</LineChart>
```

**RPE Trend LineChart with ReferenceLine** (UI-SPEC §4 Card 2):
```typescript
<LineChart data={data.rpe} margin={{ top: 5, right: 8, left: -16, bottom: 5 }}>
  {/* shared props */}
  <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: '#6B6963' }} axisLine={false} tickLine={false} />
  <ReferenceLine y={8} stroke="#EF4444" strokeDasharray="4 4"
    label={{ value: 'Seuil', fill: '#EF4444', fontSize: 10 }} />
  <Line type="monotone" dataKey="rpe" name="RPE moyen"
    stroke="#FF5C1A" strokeWidth={2} dot={{ r: 3, fill: '#FF5C1A' }} connectNulls />
</LineChart>
```

**Weekly Tonnage BarChart** (UI-SPEC §4 Card 3):
```typescript
<BarChart data={data.tonnage} margin={{ top: 5, right: 8, left: -16, bottom: 5 }}>
  {/* shared props, XAxis dataKey="week" */}
  <Bar dataKey="tonnage" name="Tonnage (kg)" fill="#FF5C1A" radius={[4, 4, 0, 0]} />
</BarChart>
```

**Intensity % AreaChart** (UI-SPEC §4 Card 4):
```typescript
<AreaChart data={data.intensity} margin={{ top: 5, right: 8, left: -16, bottom: 5 }}>
  {/* shared props */}
  <YAxis domain={[0, 100]} tickFormatter={(v) => v + '%'}
    tick={{ fontSize: 11, fill: '#6B6963' }} axisLine={false} tickLine={false} />
  <Area type="monotone" dataKey="intensity" name="Intensité %"
    stroke="#FF5C1A" fill="#FF5C1A" fillOpacity={0.08} strokeWidth={2} dot={false} connectNulls />
</AreaChart>
```

---

### `apps/web/src/components/coach/dashboard/DashboardEmptyState.tsx` (component, —)

**Analog:** `apps/web/src/components/coach/ComparisonChart.tsx` (empty branch, lines 44-49)

**ComparisonChart empty branch** (lines 44-49):
```typescript
if (data.length === 0) {
  return (
    <div className="flex items-center justify-center bg-white rounded-2xl border border-border" style={{ height: 384 }}>
      <p className="text-sm" style={{ color: '#6B6963' }}>Aucune donnée disponible pour cette période.</p>
    </div>
  );
}
```

**Full empty state for dashboard** (UI-SPEC §9 — locked layout, Lucide icon):
```typescript
import { BarChart2 } from 'lucide-react';

export function DashboardEmptyState({ prompt = false }: { prompt?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="w-12 h-12 rounded-full bg-[#F0EFE9] flex items-center justify-center mb-4">
        <BarChart2 className="w-6 h-6 text-muted" />
      </div>
      <p className="text-[15px] font-semibold text-text mb-2">
        {prompt ? 'Sélectionnez un sport' : 'Aucune donnée disponible'}
      </p>
      <p className="text-sm text-muted max-w-[320px] leading-relaxed">
        {prompt
          ? 'Sélectionnez un sport pour afficher le dashboard.'
          : 'Aucune séance trouvée pour cette période. Encouragez votre client à enregistrer ses entraînements.'}
      </p>
    </div>
  );
}
```

---

### `apps/web/src/components/coach/dashboard/DashboardLoadingState.tsx` (component, —)

**Analog:** `apps/web/src/components/coach/skeletons.tsx` + `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/loading.tsx`

**SkeletonBlock/SkeletonText imports** (skeletons.tsx lines 1-11):
```typescript
import { SkeletonBlock, SkeletonText } from '@/components/coach/skeletons';
// SkeletonBlock: animate-pulse bg-[#E2E0DA] rounded-xl
// SkeletonText:  animate-pulse bg-[#E2E0DA] rounded h-3
```

**Animate-pulse pattern** (loading.tsx lines 40-45, skeletons.tsx lines 6-11):
```typescript
// All skeleton elements use Tailwind `animate-pulse` — no custom keyframes
<div className="animate-pulse bg-[#E2E0DA] rounded-xl" aria-hidden="true" />
```

**Skeleton card structure** (UI-SPEC §10 locked — mirrors ChartCard anatomy):
```typescript
export function DashboardLoadingState() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-2xl border border-border p-6 animate-pulse">
          {/* Title skeleton */}
          <div className="h-4 bg-[#E2E0DA] rounded w-2/5 mb-4" />
          {/* Chart area skeleton */}
          <div className="h-[240px] bg-[#F0EFE9] rounded-lg" />
          {/* AI row skeleton */}
          <div className="border-t border-border mt-3 pt-3 flex items-center gap-2">
            <div className="w-4 h-4 bg-[#E2E0DA] rounded-full" />
            <div className="h-3 bg-[#E2E0DA] rounded w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Skeleton fill colors** (from skeletons.tsx + UI-SPEC §10):
- Primary skeleton fill: `bg-[#E2E0DA]` — matches existing SkeletonBlock/SkeletonText
- Subtle skeleton fill: `bg-[#F0EFE9]` — for large chart area (surface-alt)

---

### `apps/web/src/components/coach/QueryProvider.tsx` (provider, —)

**No analog** — `@tanstack/react-query` is not yet installed in `apps/web`. No existing QueryClientProvider exists anywhere in the web app.

**Pattern source:** RESEARCH.md §Pattern 1 (TanStack Query v5 docs — verified):
```typescript
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 min — dashboard data does not change mid-session
          },
        },
      })
  );
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

**Placement:** Must wrap `{children}` in the client detail layout — NOT inside the dashboard page (cache would be destroyed on tab navigation). See layout modification pattern below.

---

### `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/layout.tsx` (modify — add QueryProvider)

**Analog:** self

**Current children render pattern** (layout.tsx lines 65-67):
```typescript
<div className="flex-1 min-w-0" id="tab-panel">
  {children}
</div>
```

**After modification** — wrap children with QueryProvider:
```typescript
import { QueryProvider } from '@/components/coach/QueryProvider';
// ...
<div className="flex-1 min-w-0" id="tab-panel">
  <QueryProvider>
    {children}
  </QueryProvider>
</div>
```

**Note:** The layout itself stays a server component (`async function ClientDetailLayout`). Only `QueryProvider` needs `'use client'` — it is a separate component file. Pattern confirmed by Next.js App Router docs (server layout + client provider children).

---

## Shared Patterns

### Browser Supabase Client
**Source:** `apps/web/src/lib/supabase/client.ts` (entire file, 9 lines)
**Apply to:** `PowerliftingDashboard.tsx` (via import), `powerlifting.ts` (receives as parameter)

```typescript
// CRITICAL: Web app uses ANON_KEY — do NOT rename to KEY (mobile-only change)
import { createBrowserClient } from '@supabase/ssr';
export function createClientSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!   // note: ANON_KEY not KEY
  );
}
```

### Card Container CSS Classes
**Source:** `apps/web/src/components/coach/ComparisonChart.tsx` lines 54, 81
**Apply to:** `ChartCard.tsx`, `DashboardLoadingState.tsx`
```typescript
className="bg-white rounded-2xl border border-border p-6"
```

### `'use client'` Directive
**Source:** `apps/web/src/components/coach/ComparisonChart.tsx` line 1, `ClientTabStrip.tsx` line 1
**Apply to:** All new components in `components/coach/dashboard/`, `dashboard/page.tsx`, `QueryProvider.tsx`
```typescript
'use client';
// Must be first line — before any imports
```

### Supabase RLS + clientId Scoping
**Source:** `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/sessions/page.tsx` lines 44-49
**Apply to:** `powerlifting.ts` query function
```typescript
// CRITICAL comment pattern from sessions/page.tsx:
// is_coach_of() RLS auto-applied via coach's JWT cookie.
// CRITICAL: .eq('user_id', clientId) — clientId from URL params (NOT user.id = coach!)
.eq('workout_sessions.user_id', clientId)
```

### Skeleton Colors
**Source:** `apps/web/src/components/coach/skeletons.tsx` lines 6-11
**Apply to:** `DashboardLoadingState.tsx`
```typescript
// Primary skeleton: bg-[#E2E0DA]  (border color token)
// Subtle skeleton:  bg-[#F0EFE9]  (surface-alt, for large areas)
// Animation: animate-pulse (Tailwind built-in)
```

### CSS Animation (@keyframes)
**Source:** `apps/web/src/app/globals.css` (modification target — no `@keyframes` exists yet)
**Apply to:** `apps/web/src/app/globals.css` (add new keyframe), consumed by `PowerliftingDashboard.tsx`
```css
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```
```typescript
// In PowerliftingDashboard chart card wrappers (D-09/D-10):
className="opacity-0 animate-[fadeInUp_200ms_ease-out_forwards]"
style={{ animationDelay: `${index * 50}ms` }}
```

### Design Token Classes
**Source:** `apps/web/src/app/globals.css` lines 3-19 (verified tokens)
**Apply to:** All new components
```typescript
// Verified token → Tailwind class mappings:
// bg-background   → #F7F6F3
// bg-white        → #FFFFFF (surface)
// text-text       → #1C1A17
// text-muted      → #6B6963
// border-border   → #E2E0DA
// text-primary    → #FF5C1A
// bg-primary      → #FF5C1A
// bg-surface-alt  → #F0EFE9  (token: --color-surface-alt)
```

### Error Logging Pattern
**Source:** `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/sessions/page.tsx` lines 37-38
**Apply to:** `powerlifting.ts` error handling
```typescript
console.error('[powerlifting] fetch error:', err);
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/web/src/components/coach/QueryProvider.tsx` | provider | — | No `@tanstack/react-query` usage exists in `apps/web` yet — no QueryClientProvider to copy from |

---

## Critical Warnings for Planner

1. **TanStack Query must be installed (Wave 0):** `npm install @tanstack/react-query --workspace=apps/web`. No `useQuery` call works without it. This is a hard dependency — plan it as the first action.

2. **`createServerSupabase()` is forbidden in dashboard components:** It has `import 'server-only'` at the top of `lib/supabase/server.ts`. Any client component (`'use client'`) that imports it will cause a build-time crash. Always use `createClientSupabase()` from `@/lib/supabase/client`.

3. **`params.id` is a plain string in client components:** The `Promise<{ id }>` pattern from `sessions/page.tsx` (a server component) does NOT apply to `dashboard/page.tsx` (a client component). No `await params` — access `params.id` directly.

4. **`session_sets` has no `exercise_name` column:** The join query must use `exercises!inner(name)` and exercise name filtering must happen in TypeScript transforms, not SQL. See `powerlifting.ts` pattern above.

5. **`workout_sessions` date column is `started_at`, not `session_date`:** Date range filter must use `.gte('workout_sessions.started_at', ...)`.

6. **`QueryProvider` belongs in layout, not page:** If placed inside `dashboard/page.tsx`, the TanStack Query cache is destroyed on every tab navigation. It must wrap `{children}` in `layout.tsx`.

7. **`NEXT_PUBLIC_SUPABASE_ANON_KEY` is the web app env var name:** Do not rename to `NEXT_PUBLIC_SUPABASE_KEY` — that rename was mobile-only (apps/mobile).

---

## Metadata

**Analog search scope:** `apps/web/src/components/coach/`, `apps/web/src/app/[locale]/(coach)/`, `apps/web/src/lib/supabase/`
**Files scanned:** 8 source files read
**Analogs with codebase match:** 9 / 10 (QueryProvider has no codebase analog)
**Pattern extraction date:** 2026-05-26
