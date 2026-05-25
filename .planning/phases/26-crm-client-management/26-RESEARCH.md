# Phase 26: CRM Client Management — Research

**Researched:** 2026-05-18
**Domain:** Next.js 15 Server Components, TanStack Table v8, Recharts v3, Supabase RLS cross-user reads, Hono bounded module extension
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01** — Full TanStack Table (`@tanstack/react-table`). First use in web app; InvitationsTable (Phase 25) stays hand-rolled.
- **D-02** — Signal filter thresholds: missed 2 sessions = no `workout_sessions` in last 14 days; stale measurements = no `body_measurements` in last 28 days; mood declining = last-3 avg < prev-3 avg.
- **D-03** — Search is client-side via TanStack Table `globalFilter`; no debounce; all linked clients loaded in single server fetch.
- **D-04** — Empty state: full-page with "Invitez votre premier client" CTA → `/coach/invitations`.
- **D-05** — All 7 tabs in Phase 26 MVP: sessions, measurements, habits, nutrition, sleep, cardio, journal.
- **D-06** — URL: `/[locale]/(coach)/coach/clients/[id]/[tab]`. Default `/clients/[id]` → redirect to `sessions`. `force-dynamic` + `revalidate=0` + `cache:'no-store'` on all tab pages.
- **D-07** — Each tab independently fetches its own table; last 30 rows default with "Voir plus" button if >30. No edit controls.
- **D-08** — Read-only UI with prominent "Vue lecture seule" badge on detail header.
- **D-09** — Weekly compliance = sessions X/3 + habits Y% (7d avg); no habits → "–".
- **D-10** — 14-day mood trend = `Humeur: ↓ 3.2 → 2.8` badge. Red: delta < −0.3; Orange: −0.3 to 0; Green: > 0; Grey: insufficient data.
- **D-11** — Other summary fields: last workout date (relative "Il y a 3 jours") + latest `body_measurements.weight_kg`.
- **D-12** — New migration (likely 041) for `coach_client_tags` + `coach_client_notes` (exact SQL provided in CONTEXT.md).
- **D-13** — Notes = single row per coach↔client pair; `updated_at` versioning only.
- **D-14** — Tags UX: Enter/comma to add, × to remove; side panel or collapsible section (Claude's Discretion on layout).
- **D-15** — Tags + notes are coach-private; service layer also enforces `coach_id = auth.uid()`.
- **D-16** — Recharts (`recharts`). LineChart for time-series, BarChart for aggregate metrics.
- **D-17** — Comparison metrics: body weight, weekly session count, sleep hours, mood avg. 1RM deferred to Phase 27.
- **D-18** — Multi-select checkboxes on roster (max 5). "Comparer (N)" sticky button → `/coach/clients/compare?ids=id1,...`.
- **D-19** — Comparison page: metric `<select>` dropdown; date range "30j / 90j / 1an"; one line per client.
- **D-20** — New backend route: `DELETE /coach/clients/links/:clientId` — coach-side revoke.
- **D-21** — 2-step RevokeConfirmModal reuse; copy: "Retirer ce client ?", "Tapez COACH pour confirmer".
- **D-22** — 13 new backend routes in existing `coach/clients` bounded module.
- **D-23** — New web route group under `/[locale]/(coach)/coach/clients/` with roster page + 7 tab pages + compare page.
- **D-24** — Flip `disabled: false` on "Clients" nav item in `CoachSidebar.tsx`.

### Claude's Discretion

- Exact Tailwind class structure for TanStack Table wrapper (column widths, hover states, sticky header).
- Executive summary card layout (resolved: 4-column grid — see UI-SPEC.md).
- Tags + notes layout (resolved: right-side sticky panel on lg+, below on mobile — see UI-SPEC.md).
- Exact color coding for mood trend badge Tailwind values (resolved — see UI-SPEC.md).
- Comparison metric selector (resolved: native `<select>` — see UI-SPEC.md).
- Load more: button vs infinite scroll (resolved: "Voir plus" button — see UI-SPEC.md).
- Comparison line colors (resolved: fixed 5-slot palette starting with `#FF5C1A` — see UI-SPEC.md).

### Deferred Ideas (OUT OF SCOPE)

- Notes history / append-only log (v1.6)
- 1RM comparison metric (Phase 27)
- Habit compliance configuration — fixed denominator 3 (Phase 27)
- Programs tab on client detail (Phase 27)
- Multi-coach per athlete (v1.6)
- Real-time roster refresh (post-v1.5)
- Bulk tag operations (Phase 27+)
- GDPR hard-purge on revocation (deferred; Phase 22 uses SET NULL)
- Mobile "Mon coach" plugin (v1.6 seed)

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLIENT-01 | Coach can see paginated list of linked clients with name, photo, last-active, quick filters | TanStack Table v8 API — `useReactTable` with `getCoreRowModel` + `getFilteredRowModel`; backend `GET /coach/clients` aggregate query |
| CLIENT-02 | Coach can search by name and apply signal filters (missed sessions / stale measurements / mood declining) | TanStack Table `globalFilter` for name search; signal flags pre-computed as boolean fields in server fetch; `FilterChipGroup` reuse |
| CLIENT-03 | Coach can open client detail at `/coach/clients/[id]` with 7 read-only tabs | Next.js dynamic routes `[id]/[tab]`; `force-dynamic` + `cache:'no-store'`; 7 independent Server Component pages |
| CLIENT-04 | Coach sees executive summary card (weekly compliance, last workout, latest measurement, mood trend) | Per-client aggregate SQL in `GET /coach/clients/:id/summary`; `ExecutiveSummaryCard` component |
| CLIENT-05 | Coach can attach custom tags to a client via `coach_client_tags` table (coach-private) | New migration 041; `ClientTagInput` component cloned from `SpecialtyTagInput`; tag CRUD routes |
| CLIENT-06 | Coach can write private notes per client in `coach_client_notes` table (versioned by `updated_at`) | New migration 041 (same migration as tags); `ClientNotesPanel` component; PUT route |
| CLIENT-07 | Coach can select 3-5 clients and view multi-client comparison chart | TanStack Table row selection API; `RowSelectionState`; Recharts `LineChart`/`BarChart`; `ComparisonChart` component |
| CLIENT-08 | Coach can revoke a coach↔client link with 2-step confirmation | New `DELETE /coach/clients/links/:clientId` route (coach-side); `RevokeConfirmModal` reuse |

</phase_requirements>

---

## Summary

Phase 26 ships the core of the coach CRM. It is a pure extension phase — no new bounded modules, no new DB function, no new auth pattern. Everything builds on the existing `coach/clients` module (Phase 25), the `is_coach_of()` RLS function (Phase 22), the `createServerSupabase()` factory (Phase 23), and the established coach web component library (Phases 24–25).

The two technically novel elements are: (1) **TanStack Table v8** — the first use of a headless table library in the codebase, replacing the Phase 25 hand-rolled pattern; and (2) **Recharts v3** — a client-only charting library requiring `'use client'` and careful Next.js SSR handling. Both are well-understood libraries with stable APIs; the main research task is establishing the exact TypeScript patterns.

The migration for `coach_client_tags` + `coach_client_notes` is straightforward — both tables use the exact same RLS pattern as every other Phase 22+ table (auth.uid() = coach_id), and the SQL is fully specified in CONTEXT.md D-12.

**Primary recommendation:** Install `@tanstack/react-table@8.21.3` and `recharts@3.8.1`. Use `'use client'` for ClientsTable and ComparisonChart. All 13 new backend routes follow the existing `createUserClient(jwt)` + RLS pattern from Phase 25 `db.ts` — no service role, no new patterns. Migration 041 is the next available number.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Client roster list (CLIENT-01/02) | Frontend Server (RSC) | Browser/Client | Server fetches aggregate data once; TanStack Table runs client-side sort/filter on that payload |
| Client detail tabs (CLIENT-03) | Frontend Server (RSC) | — | Each tab is an independent Server Component; no client state needed for read-only data display |
| Executive summary card (CLIENT-04) | API / Backend | Frontend Server | Aggregate SQL computed in backend service; RSC renders the result |
| Tags CRUD (CLIENT-05) | API / Backend | Browser/Client | Tag input runs client-side; persistence via backend routes with RLS |
| Notes CRUD (CLIENT-06) | API / Backend | Browser/Client | Textarea dirty-state detection client-side; save via backend PUT route with RLS |
| Multi-client comparison chart (CLIENT-07) | Browser/Client | API / Backend | Recharts is client-only; backend provides aggregated time-series data |
| Coach-side link revocation (CLIENT-08) | API / Backend | Browser/Client | RLS effect is immediate on next DB read; modal state is client-side |
| Row selection state (roster) | Browser/Client | — | TanStack Table `RowSelectionState` is pure client state |
| Signal filter computation | API / Backend | — | Boolean flags pre-computed via SQL aggregates in `GET /coach/clients` |

---

## Standard Stack

### Core (Phase 26 additions to web app)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-table` | 8.21.3 | Headless table (sort, filter, select, paginate) | Explicitly chosen in D-01; 14kb gz; Apache-2.0; REQUIREMENTS.md explicitly excludes AG Grid |
| `recharts` | 3.8.1 | LineChart + BarChart for comparison chart | Explicitly chosen in D-16; React-first API; MIT license |

[VERIFIED: npm registry — npm view @tanstack/react-table version → 8.21.3; npm view recharts version → 3.8.1]

### Already installed (no new installs needed)

| Library | Version | Purpose |
|---------|---------|---------|
| `next` | 15.5.14 | Server Components, dynamic routes |
| `next-intl` | ^4.8.3 | i18n — new `coach.clients.*` namespace needed |
| `@supabase/ssr` | ^0.10.3 | `createServerSupabase()` for all RSC fetches |
| `react-icons` | ^5.6.0 | `IoPeopleOutline` etc. — already used in CoachSidebar |

[VERIFIED: `apps/web/package.json` read directly]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@tanstack/react-table` | AG Grid | AG Grid explicitly excluded in REQUIREMENTS.md Out of Scope |
| `recharts` | `chart.js` / `victory` | D-16 locked; Recharts is the approved choice |
| Client-side signal computation | Server-side SQL aggregates | D-02 + D-03 locked: signals are pre-computed booleans in server fetch |

**Installation:**
```bash
# From apps/web/ directory
npm install @tanstack/react-table@8.21.3 recharts@3.8.1
```

**Version verification:** [VERIFIED: npm registry 2026-05-18]
- `@tanstack/react-table` latest: 8.21.3
- `recharts` latest: 3.8.1

---

## Architecture Patterns

### System Architecture Diagram

```
Browser request → /coach/clients
    │
    ▼
[RSC: clients/page.tsx]
    │  force-dynamic, revalidate=0
    │  createServerSupabase() → GET /coach/clients (Hono)
    │     → createUserClient(jwt) → DB query with is_coach_of RLS
    │     → returns: [{ id, name, photo_url, last_active, signal_missed, signal_stale, signal_mood, sessions_compliance, habits_pct }]
    │
    ▼
[Client: ClientsTable.tsx]           [Client: CompareButton.tsx]
    │  useReactTable()                   │  sticky, z-40
    │  globalFilter (name search)        │  appears when >=2 rows selected
    │  RowSelectionState (max 5)         │  → navigate to /compare?ids=...
    │  FilterChipGroup (signal chips)    │
    │                                    │
    ▼                                    ▼
[RSC: clients/[id]/sessions/page.tsx]  [RSC: clients/compare/page.tsx]
    │  force-dynamic, revalidate=0         │  force-dynamic, revalidate=0
    │  GET /coach/clients/:id/summary      │  GET /coach/clients/compare?ids=...
    │  GET /coach/clients/:id/sessions     │
    │                                      ▼
    ▼                              [Client: ComparisonChart.tsx]
[ExecutiveSummaryCard]                     │  'use client' — recharts is browser-only
[ClientTabStrip] → tab links               │  LineChart / BarChart
[Tab content: read-only data table]        │  metric <select>, date range chips
[ClientNotesPanel]                         │
    │  ClientTagInput (client)             │
    │  notes textarea (client)             │
    │  → POST/DELETE /coach/clients/:id/tags
    │  → PUT /coach/clients/:id/notes
```

### Recommended Project Structure

```
backend/api/src/coach/clients/
  service.ts          ← extend: add 13 new route handlers
  db.ts               ← extend: add coach-read + tags/notes query functions
  types.ts            ← extend: add ClientRosterRow, ClientSummary, ClientTag, ClientNote types

apps/web/src/app/[locale]/(coach)/coach/clients/
  page.tsx                        ← roster list (RSC shell + ClientsTable client)
  compare/
    page.tsx                      ← comparison chart page (RSC + ComparisonChart client)
  [id]/
    page.tsx                      ← redirect to [id]/sessions
    layout.tsx                    ← ClientDetailHeader + ClientTabStrip + ClientNotesPanel wrapper
    sessions/page.tsx             ← sessions tab (RSC)
    measurements/page.tsx         ← measurements tab (RSC)
    habits/page.tsx               ← habits tab (RSC)
    nutrition/page.tsx            ← nutrition tab (RSC)
    sleep/page.tsx                ← sleep tab (RSC)
    cardio/page.tsx               ← cardio tab (RSC)
    journal/page.tsx              ← journal tab (RSC)

apps/web/src/components/coach/
  ClientsTable.tsx                ← 'use client' — TanStack Table wrapper
  ClientSignalChip.tsx            ← signal chip (thin KycStatusChip clone)
  CompareButton.tsx               ← sticky compare button ('use client')
  ClientDetailHeader.tsx          ← avatar + name + badge + revoke
  ClientTabStrip.tsx              ← 7 tab links ('use client' for pathname)
  ExecutiveSummaryCard.tsx        ← 4-column grid card (server-renderable)
  ClientNotesPanel.tsx            ← 'use client' — tags + notes
  ClientTagInput.tsx              ← clone of SpecialtyTagInput (max 20 tags)
  ComparisonChart.tsx             ← 'use client' — recharts LineChart/BarChart

packages/coach-sdk/src/schemas/
  client-summary.ts               ← ClientSummarySchema (new)
  client-tag.ts                   ← CoachClientTagSchema (new)
  client-note.ts                  ← CoachClientNoteSchema (new)
  index.ts                        ← export new schemas

supabase/migrations/
  041_coach_client_tags_notes.sql ← coach_client_tags + coach_client_notes (D-12)
```

### Pattern 1: TanStack Table v8 — Full Setup with Row Selection + Global Filter

[CITED: https://github.com/TanStack/table/blob/main/examples/react/row-selection/src/main.tsx + TanStack Table v8 official docs]

```typescript
// Source: TanStack Table v8 official docs + row-selection example
'use client';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  RowSelectionState,
  useReactTable,
} from '@tanstack/react-table';
import { useState, useRef, useEffect } from 'react';

// Define row shape
type ClientRow = {
  id: string;
  display_name: string;
  photo_url: string | null;
  last_active: string | null;
  signal_missed: boolean;
  signal_stale: boolean;
  signal_mood: boolean;
  sessions_this_week: number;
  habits_pct: number | null;
};

// Max-selection guard: pass to enableRowSelection
const MAX_SELECTED = 5;

const columns: ColumnDef<ClientRow>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <IndeterminateCheckbox
        checked={table.getIsAllRowsSelected()}
        indeterminate={table.getIsSomeRowsSelected()}
        onChange={table.getToggleAllRowsSelectedHandler()}
        aria-label="Tout sélectionner"
      />
    ),
    cell: ({ row, table }) => {
      const selectedCount = Object.keys(table.getState().rowSelection).length;
      const disabled = !row.getIsSelected() && selectedCount >= MAX_SELECTED;
      return (
        <IndeterminateCheckbox
          checked={row.getIsSelected()}
          disabled={disabled}
          indeterminate={false}
          onChange={row.getToggleSelectedHandler()}
          aria-label={`Sélectionner ${row.original.display_name}`}
        />
      );
    },
  },
  {
    accessorKey: 'display_name',
    header: 'Client',
    cell: ({ row }) => (/* avatar + name */),
  },
  // ... other columns
];

export function ClientsTable({ rows }: { rows: ClientRow[] }) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [signalFilter, setSignalFilter] = useState<'all'|'missed'|'stale'|'declining'>('all');

  // Signal filter: applied before TanStack receives data (pre-filter array)
  const filtered = rows.filter(row => {
    if (signalFilter === 'missed') return row.signal_missed;
    if (signalFilter === 'stale') return row.signal_stale;
    if (signalFilter === 'declining') return row.signal_mood;
    return true;
  });

  const table = useReactTable({
    data: filtered,
    columns,
    state: { rowSelection, globalFilter },
    enableRowSelection: (row) => {
      const selectedCount = Object.keys(rowSelection).length;
      return row.getIsSelected() || selectedCount < MAX_SELECTED;
    },
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id, // Use DB UUID as row key
  });

  const selectedIds = Object.keys(rowSelection);

  return (
    <>
      <input
        value={globalFilter}
        onChange={e => setGlobalFilter(e.target.value)}
        placeholder="Rechercher un client…"
      />
      <table>
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr key={row.id}>
              {row.getVisibleCells().map(cell => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {selectedIds.length >= 2 && (
        <CompareButton ids={selectedIds} />
      )}
    </>
  );
}

// IndeterminateCheckbox helper (required for select-all indeterminate state)
function IndeterminateCheckbox({
  indeterminate,
  ...rest
}: { indeterminate: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  const ref = useRef<HTMLInputElement>(null!);
  useEffect(() => {
    if (typeof indeterminate === 'boolean') {
      ref.current.indeterminate = !rest.checked && indeterminate;
    }
  }, [ref, indeterminate, rest.checked]);
  return <input type="checkbox" ref={ref} {...rest} />;
}
```

**Key insight for max-5 constraint:** Use `enableRowSelection: (row) => row.getIsSelected() || selectedCount < MAX_SELECTED`. When the 5th row is selected, all unselected checkboxes receive `disabled` via the cell renderer. This is NOT built-in to TanStack Table — it requires the `cell` renderer to check selection count.

### Pattern 2: Recharts v3 — Multi-Line Chart in Next.js 15

[CITED: https://recharts.github.io/en-US/api/LineChart + Recharts v3 migration guide]

```typescript
// Source: Recharts v3 official API + Next.js 'use client' requirement
'use client'; // MANDATORY — Recharts uses browser APIs (ResizeObserver, DOM refs)

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// Client colors (from UI-SPEC.md D-16)
const CLIENT_COLORS = ['#FF5C1A', '#3B82F6', '#22C55E', '#A855F7', '#F59E0B'];

// Data shape for multi-client time-series
type DataPoint = {
  date: string;       // x-axis key
  [clientId: string]: number | string; // one key per client
};

export function ComparisonChart({
  data,
  clientNames,
  metric,
}: {
  data: DataPoint[];
  clientNames: { id: string; name: string }[];
  metric: 'weight' | 'sessions' | 'sleep' | 'mood';
}) {
  const isAggregate = metric === 'sessions'; // BarChart for aggregate, LineChart for time-series

  if (isAggregate) {
    return (
      <ResponsiveContainer width="100%" height={384} aria-label={`Graphique de comparaison: ${metric}`}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          {clientNames.map((c, i) => (
            <Bar key={c.id} dataKey={c.id} name={c.name} fill={CLIENT_COLORS[i]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={384} aria-label={`Graphique de comparaison: ${metric}`}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        {clientNames.map((c, i) => (
          <Line
            key={c.id}
            type="monotone"
            dataKey={c.id}
            name={c.name}
            stroke={CLIENT_COLORS[i]}
            dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
```

**SSR pitfall:** Recharts v3 cannot run server-side (uses ResizeObserver and DOM APIs). Any page that imports Recharts must be `'use client'` or use `dynamic(() => import('./ComparisonChart'), { ssr: false })`. Since `ComparisonChart.tsx` will already be `'use client'`, the parent Server Component can import it directly — Next.js will automatically bundle it as client code.

### Pattern 3: Server Component Tab Page (established Phase 23 pattern)

[VERIFIED: `apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx` read directly]

```typescript
// Source: existing dashboard/page.tsx pattern
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { createServerSupabase } from '@/lib/supabase/server';

export default async function ClientSessionsPage({
  params,
}: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  // All tab fetches use createServerSupabase() — NOT the Hono API.
  // is_coach_of() RLS is enforced automatically via the user's JWT cookie.
  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('id, name, created_at, duration_minutes')
    .eq('user_id', id)          // coach can read because is_coach_of RLS policy
    .order('created_at', { ascending: false })
    .limit(30);

  return (/* read-only table */);
}
```

**Note:** Tab pages query Supabase directly (not via the Hono API) because `createServerSupabase()` already uses the coach's JWT cookie — `is_coach_of()` RLS is applied automatically. No extra API round-trip needed for tab data.

### Pattern 4: Bounded Module Extension (backend)

[VERIFIED: `backend/api/src/coach/clients/db.ts` and `service.ts` read directly]

```typescript
// db.ts — extend with new coach-read functions
export async function listCoachClients(
  jwt: string,
  coachId: string,
): Promise<ClientRosterRow[]> {
  const db = createUserClient(jwt);
  // Single query with multiple aggregate CTEs for signal flags
  const { data, error } = await db
    .from('coach_client_links')
    .select(`
      client_id,
      user_profiles!coach_client_links_client_id_fkey (
        display_name, avatar_url
      )
    `)
    .eq('coach_id', coachId)
    .is('revoked_at', null);
  // ... join with signal aggregate data
}

// service.ts — add new routes to clientsRouter
clientsRouter.get('/', async (c) => { /* list coach's clients */ });
clientsRouter.get('/:id/summary', async (c) => { /* exec summary */ });
clientsRouter.get('/:id/sessions', async (c) => { /* tab data */ });
// ... 13 routes total
```

### Pattern 5: Migration 041 — Tags + Notes

[VERIFIED: CONTEXT.md D-12 contains exact SQL; confirmed next migration number by reading `supabase/migrations/` directory]

Migration 040 is the last applied (`040_peek_invitation_function.sql`). Migration 041 is the next available number.

```sql
-- 041_coach_client_tags_notes.sql
-- Both tables in one migration (same transactional unit, same RLS pattern)
CREATE TABLE public.coach_client_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag         TEXT NOT NULL CHECK (char_length(tag) <= 50),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coach_id, client_id, tag)
);
ALTER TABLE public.coach_client_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach_client_tags_own" ON public.coach_client_tags
  USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id);

CREATE TABLE public.coach_client_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coach_id, client_id)
);
ALTER TABLE public.coach_client_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach_client_notes_own" ON public.coach_client_notes
  USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id);
```

**These tables use `auth.uid() = coach_id` in RLS — NOT `is_coach_of()`.** The tags/notes are owned BY the coach; RLS here is self-ownership, not cross-user. This is the correct pattern (identical to `coach_invitations_own` policy in migration 035).

### Anti-Patterns to Avoid

- **Recharts in a Server Component without `'use client'`:** Will crash with `ResizeObserver is not defined`. Always put Recharts components in `'use client'` files.
- **Using TanStack Table sorting model order wrong:** `getCoreRowModel → getFilteredRowModel → getSortedRowModel → getPaginationRowModel`. Order matters. Sorting AFTER filtering.
- **Using `table.index` as row ID:** Use `getRowId: (row) => row.id` to ensure selection state uses stable UUIDs, not array indices that shift on filter.
- **Importing Recharts at page level:** Even if the component is `'use client'`, importing Recharts at module level in a Server Component file will fail. Keep all Recharts imports inside `'use client'` files.
- **Signal filter as a TanStack filter function:** Don't set up `columnFilters` for the signal chips — pre-filter the data array before passing to `useReactTable`. Signal filtering (boolean flags) works simpler and more predictably as an array `.filter()` before the TanStack data prop.
- **Using `supabase.from()` query directly for tag/note data in RSC tab pages:** Tags and notes are coach-private. They are fetched by the backend routes (not direct Supabase client) OR by the client components directly. Do not include them in RSC data fetches for client data.
- **`is_coach_of()` called with wrong argument order:** Function signature is `is_coach_of(coach UUID, client UUID)`. First arg is COACH, second is CLIENT. Getting this backwards gives the client access to coach data.
- **Reading client data from RSC using service-role:** ARCH-03 bans service-role under coach/. All reads use per-request JWT. The `createServerSupabase()` factory injects the user's cookie JWT automatically — RLS handles the rest.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Table sorting + filtering + selection | Custom `Array.sort()` + filter state + checkbox logic | `@tanstack/react-table` v8 | D-01 locked; handles indeterminate select-all, filter pipeline, column sorting state correctly |
| Multi-client charts | Custom SVG path rendering | `recharts` v3 | D-16 locked; handles responsive resize, tooltips, legends, axis ticks, null-gap handling |
| Tag input (Enter/comma/backspace/remove) | Custom input event handler | Clone `SpecialtyTagInput.tsx` | Already handles all edge cases: trimming, deduplication, max-20, backspace-removes-last, comma separator |
| Modal focus trap + Escape close | Custom keyboard handler | Reuse `RevokeConfirmModal.tsx` | Phase 25 implementation already has focus trap, Escape key, aria-modal, backdrop click-away |
| Signal filter chip UI | Custom styled buttons | Reuse `FilterChipGroup.tsx` | Phase 25 already implements role="tablist" + aria-selected pattern exactly as needed |
| Typed-confirmation revoke | New modal component | Reuse `RevokeConfirmModal.tsx` | Copy `CONFIRM_TOKEN = 'COACH'` is already hardcoded; just pass new title/body/cta props |

**Key insight:** Phase 26 is the first phase where the component library built in Phases 24–25 pays off directly. Every new UI element has a template to clone or reuse.

---

## Common Pitfalls

### Pitfall 1: Recharts `ResponsiveContainer` Height Must Be Explicit

**What goes wrong:** `<ResponsiveContainer width="100%" height="100%">` renders at 0px height because parent has no height set.
**Why it happens:** Recharts calculates height from the DOM parent; if parent has no fixed height, percentage resolves to 0.
**How to avoid:** Always use a numeric pixel height (`height={384}`) or a Tailwind class on the wrapper (`<div className="h-96">`).
**Warning signs:** Chart renders but is invisible (height 0); check computed styles.

### Pitfall 2: TanStack Table Row IDs Unstable After Filter

**What goes wrong:** Selecting rows by index (`rowSelection = { 0: true }`), then filtering changes which row is at index 0 — selection appears to jump to a different row.
**Why it happens:** Default row ID is `row.index`, which changes when the data array is filtered.
**How to avoid:** Always pass `getRowId: (row) => row.id` using the stable DB UUID. Selection state keys will be UUIDs, not indices.
**Warning signs:** After applying a globalFilter, previously selected rows appear unselected or different rows appear selected.

### Pitfall 3: `createServerSupabase()` Uses Cookie JWT, Not Header JWT

**What goes wrong:** Tab pages try to fetch client data for `user_id = params.id` but get 0 rows back, because `createServerSupabase()` uses the COACH's cookie session — so `auth.uid()` in RLS is the coach, not the client.
**Why it happens:** This is the CORRECT behavior — `is_coach_of(auth.uid(), user_id)` resolves to `is_coach_of(coach_id, client_id)`, which returns true if the coach is linked. The query should be `.eq('user_id', id)` where `id` is the client's UUID from `params.id`.
**How to avoid:** Understand that the Server Component passes the CLIENT's id from URL params as the `user_id` filter; RLS uses the COACH's session to authorize the read.
**Warning signs:** Empty result sets or RLS errors on tab pages; check that you're filtering `.eq('user_id', clientId)` not `.eq('user_id', user.id)`.

### Pitfall 4: Recharts v3 Breaking Changes from v2

**What goes wrong:** Copying a Recharts v2 example that uses `CategoricalChartState` prop or the old `payload` prop on `<Legend>`.
**Why it happens:** Recharts v3 removed internal state passing to child components; also renamed `TooltipProps` to `TooltipContentProps`.
**How to avoid:** Use the Pattern 2 example above. For custom Tooltip/Legend, use the new hooks (`useActiveTooltipLabel`) instead of relying on props.
**Warning signs:** TypeScript type errors on custom tooltip/legend components; runtime errors about undefined props.

### Pitfall 5: Migration 041 Must Not Touch Existing RLS Policies

**What goes wrong:** Migration 041 accidentally drops or alters the `is_coach_of()` function or any existing `_coach_read` policy.
**Why it happens:** Migration contains a `DROP FUNCTION` or `ALTER POLICY` statement not intended for it.
**How to avoid:** Migration 041 only creates 2 new tables + 2 new RLS policies. It contains NO `DROP`, no `ALTER TABLE ... DROP POLICY`, no `CREATE OR REPLACE FUNCTION` for existing functions. The `is_coach_of()` function in migration 035 is untouched.
**Warning signs:** Phase 22 RLS tests fail after migration 041 is applied.

### Pitfall 6: Coach-Side Revoke Route vs Athlete-Side Revoke Route

**What goes wrong:** Re-using the Phase 25 athlete-revoke route `DELETE /links/:id` for the Phase 26 coach-side revoke.
**Why it happens:** Phase 25 route authorizes by `client_id = auth.uid()`. A coach calling it will get a 500 (or silent no-op via `maybeSingle`).
**How to avoid:** Phase 26 adds a NEW route `DELETE /coach/clients/links/:clientId` that authorizes by `coach_id = auth.uid()` and filters by `client_id = params.clientId`. The route URL shape is also different (by clientId, not by link UUID).
**Warning signs:** Revocation returns 200 but link is not actually revoked; or returns error; RLS test for coach-revoke fails.

### Pitfall 7: `force-dynamic` Required on ALL Tab Pages

**What goes wrong:** Forgetting `export const dynamic = 'force-dynamic'` on a tab page allows Next.js to cache the Server Component render. Coach B sees Coach A's client data.
**Why it happens:** Next.js RSC caching is per-route by default. Without `force-dynamic`, the first coach to visit a URL gets their data cached for all subsequent visitors.
**How to avoid:** Every file under `apps/web/src/app/[locale]/(coach)/` must have both `export const dynamic = 'force-dynamic'` AND `export const revalidate = 0`. ARCH-06 mandates this (already enforced by Phase 23 ESLint rule setup — verify the ESLint rule catches missing directives).
**Warning signs:** ARCH-06 violation; wrong data shown to coach; D-23/D-06 non-compliance.

---

## Code Examples

### GET /coach/clients — Aggregate Query with Signal Flags

```typescript
// Source: derived from Phase 25 createUserClient pattern in db.ts
// All cross-user reads work because is_coach_of() RLS is on all 11 athlete tables.
export async function listCoachClients(jwt: string, coachId: string) {
  const db = createUserClient(jwt);

  // Step 1: get all active client links
  const { data: links, error } = await db
    .from('coach_client_links')
    .select('client_id, created_at')
    .eq('coach_id', coachId)
    .is('revoked_at', null);

  if (error) throw new Error(error.message);

  // Step 2: for each client, fetch profile + aggregate signals
  // In production, this should be a single JOIN query or RPC for N>20 clients.
  // For Phase 26 (coaches typically <50 clients), N+1 is acceptable.
  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const twentyEightDaysAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString();

  // ... build per-client signal flags using aggregate queries
}
```

### Tab Page — Habits Tab Example

```typescript
// Source: derived from Phase 25 RSC pattern + CONTEXT.md D-07
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ClientHabitsPage({
  params,
}: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id: clientId } = await params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  // Fetch habits for this client — is_coach_of() RLS auto-applies
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: habits }, { data: logs }] = await Promise.all([
    supabase.from('habits').select('id, name, type, target, emoji, color')
      .eq('user_id', clientId).limit(30),
    supabase.from('habit_logs').select('habit_id, date, completed, count')
      .eq('user_id', clientId).gte('date', thirtyDaysAgo.split('T')[0]).limit(30),
  ]);

  return (/* read-only habits table */);
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-table` v7 (opt-in React wrapper) | `@tanstack/react-table` v8 (first-class TS, headless) | 2022 | New API; column defs use `accessorKey` not `accessor`; no more `useTable` — use `useReactTable` |
| Recharts v2 (internal `CategoricalChartState` passed as props) | Recharts v3 (hooks-based internal state) | 2024 | Breaking: custom tooltip/legend no longer receive internal state props; use `useActiveTooltipLabel` hook instead |
| `TData` as any | `ColumnDef<TData>` with strict generic | v8 | TypeScript inference requires explicit generic on `ColumnDef<ClientRow>[]` |

**Deprecated/outdated:**
- `useTable()` from react-table v7: replaced by `useReactTable()` in v8 — completely different API
- `react-table` package name: now `@tanstack/react-table`
- Recharts `<Tooltip content>` receiving `CategoricalChartState` props: removed in v3

---

## Runtime State Inventory

Step 2.5: NOT APPLICABLE — Phase 26 is a new-feature phase, not a rename/refactor/migration. No existing runtime state needs to be updated. The only DB change is migration 041 which creates 2 new tables (no existing data touched).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm install, Next.js build | ✓ | (system) | — |
| `@tanstack/react-table` | CLIENT-01, CLIENT-02, CLIENT-07 | ✗ (not installed) | 8.21.3 (latest) | None — D-01 locked |
| `recharts` | CLIENT-07 | ✗ (not installed) | 3.8.1 (latest) | None — D-16 locked |
| Supabase project | All DB operations | ✓ | linked (`.temp/linked-project.json` exists) | — |

[VERIFIED: `apps/web/package.json` — neither `@tanstack/react-table` nor `recharts` present]

**Missing dependencies with no fallback:**
- `@tanstack/react-table@8.21.3` — must be installed in Wave 0
- `recharts@3.8.1` — must be installed in Wave 0

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Tab pages will query Supabase directly via `createServerSupabase()` rather than through the Hono API | Architecture Patterns / Pattern 3 | Low risk — this is the established Phase 23/24/25 pattern; alternative (via API) works but adds latency |
| A2 | Signal flag computation for `GET /coach/clients` will use N+1 queries (one per client) rather than a single JOIN/RPC | Code Examples | Risk if coaches have >50 clients — N+1 is acceptable for Phase 26 per D-03 (coaches typically <100 clients); a future optimization could use a Supabase RPC |
| A3 | Both `coach_client_tags` and `coach_client_notes` can ship in a single migration 041 | Architecture / Migration | Low risk — single transactional unit; both tables have no interdependency; same pattern as existing migrations |

**Three assumptions only, all low-risk.** All other claims are VERIFIED or CITED from official sources.

---

## Open Questions (RESOLVED)

1. **`GET /coach/clients` query strategy: N+1 vs single RPC**
   - What we know: D-03 says all linked clients loaded in a single server fetch; coaches typically have <100 clients
   - What's unclear: Whether to use a PostgreSQL RPC for computing signal flags (last workout date, habit completion, mood avg) or N+1 per-client queries
   - Recommendation: For Phase 26, use a single Supabase RPC for the roster data to avoid N+1. The planner should create a task to write a `list_coach_clients_with_signals(coach_id)` SQL function. This is a MEDIUM-risk open item.
   - **RESOLVED (Plan 26-02):** N+1 approach accepted for Phase 26 (coaches typically <100 clients, per D-03). Per-client loop implemented in `listCoachClients()` in `db.ts`. Single RPC deferred to post-v1.5 optimization.

2. **`user_profiles` column for `display_name` and `photo_url` vs `coach_profiles`**
   - What we know: Athlete profiles are in `user_profiles` (migration 034); coach profiles are in `coach_profiles`. Athletes do NOT have `coach_profiles` rows.
   - What's unclear: What column name holds the athlete's display name and photo? `user_profiles.name`? `user_profiles.avatar_url`?
   - Recommendation: Planner must verify exact column names in `user_profiles` from migration 034 before writing the `listCoachClients` query.
   - **RESOLVED (Plan 26-02):** Column names verified from migration 034: `user_profiles.name` (NOT `display_name`) and `user_profiles.avatar_url` (NOT `photo_url`).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^3 |
| Config file | `backend/api/vitest.config.ts` |
| Quick run command | `rtk vitest run --reporter=verbose test/coach/clients-*.spec.ts` |
| Full suite command | `rtk vitest run` |

[VERIFIED: `backend/api/vitest.config.ts` read directly; existing test files in `backend/api/test/coach/`]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLIENT-01 | `GET /coach/clients` returns roster with signal flags for coach | integration | `rtk vitest run test/coach/clients-roster.spec.ts` | ❌ Wave 0 |
| CLIENT-02 | Signal flags computed correctly (14d / 28d / mood delta thresholds) | unit | `rtk vitest run test/coach/clients-signals.spec.ts` | ❌ Wave 0 |
| CLIENT-03 | All 7 tab routes return 200 for coach; return empty for unlinked coach | integration | `rtk vitest run test/coach/clients-tabs.spec.ts` | ❌ Wave 0 |
| CLIENT-04 | Summary aggregates correct (sessions count, habits %, last workout, mood delta) | unit | `rtk vitest run test/coach/clients-summary.spec.ts` | ❌ Wave 0 |
| CLIENT-05 | Tags CRUD: create, list, delete; coach_id isolation (coach B cannot read coach A tags) | integration | `rtk vitest run test/coach/clients-tags.spec.ts` | ❌ Wave 0 |
| CLIENT-06 | Notes CRUD: upsert, read; `updated_at` updates on PUT; coach_id isolation | integration | `rtk vitest run test/coach/clients-notes.spec.ts` | ❌ Wave 0 |
| CLIENT-07 | Comparison endpoint returns time-series for requested client IDs and metric | integration | `rtk vitest run test/coach/clients-compare.spec.ts` | ❌ Wave 0 |
| CLIENT-08 | Coach-side revoke: link revoked by coach, RLS blocks coach immediately after | integration | `rtk vitest run test/coach/clients-revoke-coach.spec.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `rtk vitest run test/coach/clients-$(relevant).spec.ts`
- **Per wave merge:** `rtk vitest run` (full backend suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `test/coach/clients-roster.spec.ts` — covers CLIENT-01
- [ ] `test/coach/clients-signals.spec.ts` — covers CLIENT-02 (unit test for signal threshold logic)
- [ ] `test/coach/clients-tabs.spec.ts` — covers CLIENT-03 (7 tab routes)
- [ ] `test/coach/clients-summary.spec.ts` — covers CLIENT-04 (aggregate computation)
- [ ] `test/coach/clients-tags.spec.ts` — covers CLIENT-05
- [ ] `test/coach/clients-notes.spec.ts` — covers CLIENT-06
- [ ] `test/coach/clients-compare.spec.ts` — covers CLIENT-07
- [ ] `test/coach/clients-revoke-coach.spec.ts` — covers CLIENT-08
- [ ] `supabase/migrations/041_coach_client_tags_notes.sql` — prerequisite for CLIENT-05/06 tests

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `createServerSupabase()` + `supabase.auth.getUser()` (Phase 23 pattern — already enforced) |
| V3 Session Management | yes | `force-dynamic` + `revalidate=0` + `cache:'no-store'` on all coach pages (ARCH-06 — already enforced by Phase 23 ESLint) |
| V4 Access Control | yes | `is_coach_of()` RLS on all 11 athlete tables (Phase 22); `coach_id = auth.uid()` RLS on tags/notes (migration 041) |
| V5 Input Validation | yes | Tag text max 50 chars (DB CHECK constraint in migration 041); tag input client-side dedup; Zod schemas in coach-sdk for API payloads |
| V6 Cryptography | no | No new cryptographic operations in Phase 26 |

### Known Threat Patterns for Phase 26

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Coach reads unlinked client's data by guessing UUID | Spoofing / Info Disclosure | `is_coach_of()` RLS rejects any query where coach↔client link is absent or revoked — enforced at DB level |
| Coach A reads Coach B's private tags/notes | Info Disclosure | `coach_client_tags_own` + `coach_client_notes_own` RLS: `USING (auth.uid() = coach_id)` — Coach B's rows are invisible to Coach A |
| Athlete reads their coach's private notes | Info Disclosure | Tags/notes tables have NO athlete-read policy — athlete JWT cannot SELECT any rows from these tables |
| Comparison endpoint leaks data for non-linked clients | Spoofing | `GET /coach/clients/compare?ids=...` must validate each `clientId` against `is_coach_of(coachId, clientId)` before querying; unlinked IDs return no data (RLS handles if using per-request JWT) |
| Stale RSC cache serves Coach A's data to Coach B | Info Disclosure | ARCH-06: `force-dynamic` + `revalidate=0` mandatory on all (coach) routes; ESLint rule from Phase 23 enforces |
| Coach revokes their own coach link using the athlete route | Tampering | Phase 26 adds a SEPARATE route `DELETE /links/:clientId` authorized by `coach_id = auth.uid()`; athlete route `DELETE /links/:id` authorized by `client_id = auth.uid()` — two distinct authorization paths |

---

## Sources

### Primary (HIGH confidence)

- `backend/api/src/coach/clients/service.ts` — existing module; Phase 26 extends it [VERIFIED: read directly]
- `backend/api/src/coach/clients/db.ts` — `createUserClient(jwt)` pattern [VERIFIED: read directly]
- `backend/api/src/coach/clients/types.ts` — type shapes [VERIFIED: read directly]
- `supabase/migrations/035_coach_invitations_links_rls.sql` — `is_coach_of()` shape + 11 SELECT policies [VERIFIED: read directly]
- `supabase/migrations/` directory listing — migration 040 is last; 041 is next [VERIFIED: bash ls]
- `apps/web/src/components/coach/InvitationsTable.tsx` — table + empty-state pattern [VERIFIED: read directly]
- `apps/web/src/components/coach/RevokeConfirmModal.tsx` — modal pattern + CONFIRM_TOKEN [VERIFIED: read directly]
- `apps/web/src/components/coach/FilterChipGroup.tsx` — filter chip pattern [VERIFIED: read directly]
- `apps/web/src/components/coach/SpecialtyTagInput.tsx` — tag input pattern [VERIFIED: read directly]
- `apps/web/src/components/coach/CoachSidebar.tsx` — `disabled: true` on Clients nav item [VERIFIED: read directly]
- `apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx` — Server Component pattern [VERIFIED: read directly]
- `packages/coach-sdk/src/schemas/index.ts` — current exports; Phase 26 adds 3 new schemas [VERIFIED: read directly]
- `apps/web/package.json` — confirms @tanstack/react-table + recharts NOT yet installed [VERIFIED: read directly]
- TanStack Table v8 row selection API — `RowSelectionState`, `useReactTable`, `flexRender`, `IndeterminateCheckbox` [CITED: https://github.com/TanStack/table/blob/main/examples/react/row-selection/src/main.tsx]
- TanStack Table v8 global filter API — `onGlobalFilterChange`, `getFilteredRowModel`, `table.setGlobalFilter()` [CITED: https://tanstack.com/table/v8/docs/guide/global-filtering]
- TanStack Table v8 row selection guide — `enableRowSelection`, `getIsAllRowsSelected`, `getIsSomeRowsSelected` [CITED: https://tanstack.com/table/v8/docs/guide/row-selection]
- Recharts v3 API — LineChart, BarChart, ResponsiveContainer, Line, XAxis, YAxis, Tooltip, Legend [CITED: https://recharts.github.io/en-US/api/LineChart]
- Recharts v3 migration guide — breaking changes from v2 [CITED: https://github.com/recharts/recharts/wiki/3.0-migration-guide]

### Secondary (MEDIUM confidence)

- npm registry: `@tanstack/react-table` latest = 8.21.3 [VERIFIED: npm view]
- npm registry: `recharts` latest = 3.8.1 [VERIFIED: npm view]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — both libraries verified from npm registry; API patterns verified from official GitHub examples
- Architecture: HIGH — existing codebase patterns read directly; no assumed patterns
- Pitfalls: HIGH — derived from verified API behavior (Recharts SSR constraint, TanStack row ID stability, RLS authorization direction)
- Migration: HIGH — migration number verified by directory listing; SQL exact from CONTEXT.md D-12

**Research date:** 2026-05-18
**Valid until:** 2026-06-18 (30 days — both libraries are stable; recharts v3 and TanStack Table v8 are not in rapid flux)
