# Architecture: Custom Widget Dashboard Integration

**Domain:** Coach CRM — per-athlete widget dashboard with Claude-driven editing
**Researched:** 2026-05-25
**Based on:** Direct codebase inspection (coach AI bounded module, Supabase migrations 001-053, Next.js App Router client detail layout, Hono app.ts routing)

---

## Integration Philosophy

The dashboard feature slots into the existing three-layer pattern already established for the coach AI bounded module:

1. **Supabase** — stores dashboard configs as flat JSONB (one row per coach+athlete pair); athlete data already exists across 8+ tables and is read via RLS-scoped JWT client
2. **Hono** — new `coach/dashboards` bounded context, mirroring `coach/ai` structure (db.ts / service.ts / types.ts)
3. **Next.js** — new tab in the existing `ClientTabStrip` + `ClientDetailLayout`, with a split-screen editor as a client component

The `apps/web/src/app/api/coach/[...path]/route.ts` catch-all proxy already forwards all `/coach/*` calls with the coach's JWT attached — **no new proxy route needed**. New Hono routes under `/coach/dashboards` are automatically proxied.

---

## DB Schema

### New Table: `dashboard_configs`

**Migration number:** 054 (next after 053\_referral\_schema.sql)

```sql
SET LOCAL lock_timeout = '5s';

-- ============================================================
-- Migration 054: dashboard_configs
-- Flat JSONB widget array per coach+athlete pair.
-- One row per (coach_id, client_id) — upserted, never appended.
-- RLS: coach reads/writes own rows via JWT (same as coach_alerts).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.dashboard_configs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  widgets     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT  dashboard_configs_unique UNIQUE (coach_id, client_id)
);

ALTER TABLE public.dashboard_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dashboard_configs_own" ON public.dashboard_configs
  FOR ALL
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

-- Index for the single most common query: fetch by coach+client
CREATE INDEX IF NOT EXISTS idx_dashboard_configs_lookup
  ON public.dashboard_configs(coach_id, client_id);
```

### Widget JSONB Schema

The `widgets` column is an ordered array. Each element is a widget object. Flat structure — no nesting, no references between widgets.

```typescript
// Widget union type — 7 widget types
type WidgetType =
  | 'sessions_summary'    // workout sessions count + volume over period
  | 'sleep_chart'         // sleep duration trend (line chart)
  | 'mood_trend'          // journal mood trend
  | 'weight_progression'  // body_measurements weight over time
  | 'nutrition_macros'    // nutrition_logs daily avg macros
  | 'cardio_stats'        // cardio_sessions distance/pace summary
  | 'habits_streak';      // habit_logs streak per habit

interface Widget {
  id: string;           // client-generated UUID (crypto.randomUUID()) — stable across edits
  type: WidgetType;
  title: string;        // coach-editable display label
  period_days: number;  // look-back window: 7 | 14 | 30 | 90
  position: number;     // 0-based render order (integer, not sparse)
  config: WidgetConfig; // type-specific settings (see below)
}

// config shapes per widget type
type WidgetConfig =
  | { metric: 'count' | 'volume_kg' }                           // sessions_summary
  | { show_average: boolean }                                    // sleep_chart
  | { show_energy: boolean; show_stress: boolean }               // mood_trend
  | { show_body_fat: boolean }                                   // weight_progression
  | { show_calories: boolean; show_protein: boolean }            // nutrition_macros
  | { activity_type: string | null }                             // cardio_stats (null = all)
  | { habit_ids: string[] }                                      // habits_streak (empty = all)
```

Full `widgets` column example (2 widgets):

```json
[
  {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "type": "sessions_summary",
    "title": "Séances ce mois",
    "period_days": 30,
    "position": 0,
    "config": { "metric": "count" }
  },
  {
    "id": "c3d479f4-7ac1-0b58-cc43-72a5670e02b2",
    "type": "sleep_chart",
    "title": "Tendance sommeil",
    "period_days": 14,
    "position": 1,
    "config": { "show_average": true }
  }
]
```

### New Table: `coach_memory`

Long-term coach preferences and dashboard templates. Stored as free-form JSONB to avoid schema churn as preferences evolve.

```sql
-- Append to migration 054 or create 055_coach_memory.sql

CREATE TABLE IF NOT EXISTS public.coach_memory (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  preferences JSONB       NOT NULL DEFAULT '{}'::jsonb,
  templates   JSONB       NOT NULL DEFAULT '[]'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_memory_own" ON public.coach_memory
  FOR ALL
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);
```

`preferences` shape:

```json
{
  "default_period_days": 30,
  "preferred_widget_types": ["sessions_summary", "sleep_chart"],
  "layout_preference": "2-column"
}
```

`templates` shape — array of named widget arrays the coach wants to reuse:

```json
[
  {
    "name": "Bilan cardio",
    "widgets": [ /* same Widget[] shape, without position */ ]
  }
]
```

---

## API Routes

All new routes live in a new bounded context: `backend/api/src/coach/dashboards/`.

File structure mirrors the existing `coach/ai/` module:

```
backend/api/src/coach/dashboards/
  db.ts       — Supabase queries
  service.ts  — Hono router (exported as dashboardsRouter)
  types.ts    — TypeScript interfaces
```

### Mount in `app.ts` (MODIFIED — 1 line added)

```typescript
// backend/api/src/app.ts
import { dashboardsRouter } from './coach/dashboards/service.js';
// ...
app.route('/coach/dashboards', dashboardsRouter);
```

### Routes in `service.ts`

All routes require the existing `authMiddleware` (JWT validation via Supabase).

| Method | Path | Description | What it does |
|--------|------|-------------|-------------|
| `GET` | `/coach/dashboards/:clientId` | Fetch current config | Returns `{ config: DashboardConfig \| null }` — null if no config yet |
| `PUT` | `/coach/dashboards/:clientId` | Save full config | Upserts entire `widgets` array — replaces, not patches |
| `POST` | `/coach/dashboards/:clientId/ai-edit` | Claude-driven edit | Receives chat message + current config; returns SSE stream of tool calls + updated config |
| `GET` | `/coach/dashboards/memory` | Fetch coach memory | Returns `{ preferences, templates }` |
| `PUT` | `/coach/dashboards/memory` | Save coach memory | Upserts `preferences` and/or `templates` |

**Route order note:** `/memory` must be registered before `/:clientId` in Hono, otherwise Hono will match `memory` as a clientId param. Register static paths first.

#### `GET /coach/dashboards/:clientId` response

```typescript
// 200
{ config: DashboardConfig | null }

interface DashboardConfig {
  id: string;
  coach_id: string;
  client_id: string;
  widgets: Widget[];
  updated_at: string;
}
```

#### `PUT /coach/dashboards/:clientId` request body

```typescript
{ widgets: Widget[] }
// Validates: max 12 widgets, positions must be 0..n-1, widget IDs must be unique
// Returns: { config: DashboardConfig }
```

#### `POST /coach/dashboards/:clientId/ai-edit` request body

```typescript
{
  message: string;            // coach's natural-language instruction
  current_widgets: Widget[];  // current dashboard state (client sends it — avoids extra DB read)
  conversation_id?: string;   // optional — to persist chat history
}
```

Response: SSE stream (same format as `/coach/ai/chat/stream`):

```
data: {"type":"meta","conversation_id":"uuid"}\n\n
data: {"type":"chunk","content":"text"}\n\n
data: {"type":"widget_update","widgets":[...]}\n\n   ← emitted after each tool call resolves
data: [DONE]\n\n
```

The `widget_update` event lets the Next.js client update the live preview incrementally without waiting for DONE.

---

## Claude Tool Definitions

These tools are scoped to the dashboard editor — **not added to the existing `coachToolSchemas` array** in `coach/ai/tools.ts`. They live in `coach/dashboards/tools.ts`.

The executor pattern is identical to the existing tools: `execute(input, coachId, jwt)`.

### Tool: `add_widget`

```typescript
{
  name: 'add_widget',
  description: 'Add a new widget to the coach dashboard for this athlete. Choose the widget type based on what the coach wants to monitor. Returns the updated widgets array.',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: 'Widget type',
        enum: ['sessions_summary', 'sleep_chart', 'mood_trend', 'weight_progression', 'nutrition_macros', 'cardio_stats', 'habits_streak'],
      },
      title: {
        type: 'string',
        description: 'Display label for the widget (in French if coach communicates in French)',
      },
      period_days: {
        type: 'integer',
        description: 'Look-back period in days',
        enum: [7, 14, 30, 90],
        default: 30,
      },
      config: {
        type: 'string',
        description: 'JSON-encoded widget config object. For sessions_summary: {"metric":"count"}. For sleep_chart: {"show_average":true}. For mood_trend: {"show_energy":false,"show_stress":false}. For weight_progression: {"show_body_fat":false}. For nutrition_macros: {"show_calories":true,"show_protein":true}. For cardio_stats: {"activity_type":null}. For habits_streak: {"habit_ids":[]}.',
      },
    },
    required: ['type', 'title'],
  },
}
```

Executor logic: parse `config` JSON, generate a new widget ID (`crypto.randomUUID()`), append to current array at the next position, return updated array.

### Tool: `update_widget`

```typescript
{
  name: 'update_widget',
  description: 'Update an existing widget\'s title, period, or config. Use the widget id from the current widgets list. Returns the updated widgets array.',
  parameters: {
    type: 'object',
    properties: {
      widget_id: {
        type: 'string',
        description: 'UUID of the widget to update (from the current widgets list)',
      },
      title: {
        type: 'string',
        description: 'New display label (optional)',
      },
      period_days: {
        type: 'integer',
        description: 'New look-back period: 7, 14, 30, or 90 (optional)',
        enum: [7, 14, 30, 90],
      },
      config: {
        type: 'string',
        description: 'JSON-encoded partial config to merge into existing config (optional)',
      },
    },
    required: ['widget_id'],
  },
}
```

Executor logic: find widget by `widget_id`, apply partial updates (title, period\_days, merge config), return updated array. Throws `'Widget not found'` if ID is missing — Claude receives the error and can ask the coach to clarify.

### Tool: `remove_widget`

```typescript
{
  name: 'remove_widget',
  description: 'Remove a widget from the dashboard. Automatically recompacts positions after removal. Returns the updated widgets array.',
  parameters: {
    type: 'object',
    properties: {
      widget_id: {
        type: 'string',
        description: 'UUID of the widget to remove',
      },
    },
    required: ['widget_id'],
  },
}
```

Executor logic: filter out the widget, recompute `position` (0, 1, 2...), return updated array.

### Tool: `reorder_widgets`

```typescript
{
  name: 'reorder_widgets',
  description: 'Change the display order of widgets. Provide the full ordered list of widget IDs. Returns the updated widgets array.',
  parameters: {
    type: 'object',
    properties: {
      ordered_ids: {
        type: 'string',
        description: 'JSON array of widget UUIDs in the desired display order, e.g. ["uuid-a","uuid-b","uuid-c"]',
      },
    },
    required: ['ordered_ids'],
  },
}
```

Executor logic: parse `ordered_ids`, reassign `position` by index order, validate all IDs exist, return updated array.

### Tool: `read_dashboard`

```typescript
{
  name: 'read_dashboard',
  description: 'Read the current dashboard configuration to understand what widgets are already present before making changes.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
}
```

Executor logic: returns the `current_widgets` array that was passed into the request context (no DB read required — it was already sent by the client). Claude calls this first when given an ambiguous instruction.

### Passing current widgets to executors

The executors in this module receive a mutable state object — not just `(input, coachId, jwt)`. The executor signature is:

```typescript
type DashboardToolExecutor = (
  input: Record<string, unknown>,
  coachId: string,
  jwt: string,
  state: { widgets: Widget[] }, // mutated in-place across tool calls
) => Promise<{ widgets: Widget[] }>;
```

The `state` object is initialised from `current_widgets` in the request body and shared across all tool calls in the `streamText` loop (via closure). Each tool call updates `state.widgets` and returns it. After `[DONE]`, the final `state.widgets` is persisted to `dashboard_configs` via a single `PUT` to Supabase — no intermediate saves.

### System prompt addition for dashboard editing

```typescript
function buildDashboardEditSystemPrompt(clientName: string, currentWidgets: Widget[]): string {
  return `You are Ziko IA Coach helping a coach customize an athlete dashboard for ${clientName}.

## Current Dashboard
${currentWidgets.length === 0
  ? 'The dashboard is empty. You can add widgets.'
  : `${currentWidgets.length} widgets:\n${currentWidgets.map((w, i) => `${i}. [${w.id}] ${w.type} — "${w.title}" (${w.period_days}d)`).join('\n')}`}

## Rules
- Always call read_dashboard first if you are unsure of the current state.
- Widget IDs in the list above are the IDs to use in update_widget and remove_widget.
- After each tool call the live preview updates — the coach will see changes immediately.
- Respond in the same language as the coach (French/English).
- When done, summarize what you changed in 1-2 sentences.`;
}
```

---

## Component Tree

### New tab entry in `ClientTabStrip` (MODIFIED)

Add `{ key: 'dashboard', label: 'Dashboard' }` to the `TABS` array. This is the only change to the existing component.

```typescript
// apps/web/src/components/coach/ClientTabStrip.tsx — MODIFIED
const TABS = [
  { key: 'sessions',     label: 'Séances' },
  { key: 'dashboard',   label: 'Dashboard' },  // NEW — position 2 after Séances
  { key: 'measurements', label: 'Mesures' },
  // ... rest unchanged
];
```

### New page file

```
apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/
  page.tsx          — Server Component: fetches initial config + client name, renders DashboardShell
  loading.tsx       — Skeleton (same pattern as other tab pages)
```

`page.tsx` fetches `dashboard_configs` directly from Supabase (bypassing Hono, following the Hono bypass pattern documented in `project_perf_hono_bypass.md`):

```typescript
// page.tsx (Server Component)
export default async function DashboardPage({ params }) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const [{ data: config }, { data: profile }] = await Promise.all([
    supabase
      .from('dashboard_configs')
      .select('widgets, updated_at')
      .eq('client_id', id)
      .maybeSingle(),
    supabase
      .from('user_profiles')
      .select('name')
      .eq('id', id)
      .single(),
  ]);

  return (
    <DashboardShell
      clientId={id}
      clientName={profile?.name ?? 'Client'}
      initialWidgets={(config?.widgets as Widget[]) ?? []}
      apiUrl={process.env.NEXT_PUBLIC_API_URL ?? ''}
    />
  );
}
```

### Client component tree

```
DashboardShell (client component — owns all mutable state)
  ├── DashboardToolbar
  │     ├── EditButton (toggles editor open)
  │     └── SaveButton (calls PUT /coach/dashboards/:clientId)
  ├── DashboardGrid (left panel — always visible)
  │     └── WidgetCard[] (renders 1 of 7 widget types)
  │           └── WidgetRenderer (switch on widget.type)
  │                 ├── SessionsSummaryWidget
  │                 ├── SleepChartWidget
  │                 ├── MoodTrendWidget
  │                 ├── WeightProgressionWidget
  │                 ├── NutritionMacrosWidget
  │                 ├── CardioStatsWidget
  │                 └── HabitsStreakWidget
  └── DashboardEditor (right panel — conditional, split-screen)
        ├── ChatInputBar (reuse existing component)
        ├── MessageList (reuse MessageBubble)
        └── PreviewBanner ("Modifications en cours — Sauvegarder ?")
```

**Split-screen layout:** When the editor is open, `DashboardShell` renders a `flex gap-6` layout. `DashboardGrid` takes `flex-1` (left). `DashboardEditor` takes `w-96 shrink-0` (right). On mobile (`< lg`), the editor overlays as a bottom sheet.

**State in `DashboardShell`:**

```typescript
const [widgets, setWidgets] = useState<Widget[]>(initialWidgets);
const [pendingWidgets, setPendingWidgets] = useState<Widget[] | null>(null);
const [editorOpen, setEditorOpen] = useState(false);
const [isDirty, setIsDirty] = useState(false);
```

`pendingWidgets` is non-null while the AI stream is in progress and contains live preview changes. On "Sauvegarder", `pendingWidgets` is merged into `widgets` and persisted. On "Annuler", `pendingWidgets` is discarded.

---

## Data Flow

### Flow 1: Initial page load

```
Next.js Server Component (page.tsx)
  └── Supabase direct read: dashboard_configs WHERE client_id = :id
        → initialWidgets: Widget[]
        → passed as prop to DashboardShell (no client-side fetch on mount)
```

### Flow 2: Widget data rendering (live athlete data)

Each widget fetches its own data client-side when rendered, using the existing Next.js API proxy. The fetch is scoped by `widget.period_days` and `clientId`.

```
WidgetCard mounts
  └── useEffect / React Query: GET /api/coach/clients/:clientId/widget-data?type=sleep_chart&period_days=14
        → proxied by apps/web/src/app/api/coach/[...path]/route.ts
        → Hono: GET /coach/clients/:clientId/widget-data (NEW endpoint in coach/clients/service.ts)
              → queries the appropriate Supabase table with JWT-scoped client
              → returns aggregated data for the widget type
```

**New Hono endpoint** (added to `coach/clients/service.ts`):

```typescript
// GET /coach/clients/:clientId/widget-data?type=<WidgetType>&period_days=<number>&config=<json>
// Validates coach_client_links before any data read (same defense-in-depth as analyze_client).
// Returns typed payload matching the widget type.
```

Response shape per widget type:

| Widget type | Response fields |
|-------------|----------------|
| `sessions_summary` | `{ sessions_count, total_volume_kg }` |
| `sleep_chart` | `{ entries: [{date, duration_hours}] }` |
| `mood_trend` | `{ entries: [{date, mood, energy?, stress?}] }` |
| `weight_progression` | `{ entries: [{date, weight_kg, body_fat_pct?}] }` |
| `nutrition_macros` | `{ avg_calories, avg_protein_g, avg_carbs_g, avg_fat_g }` |
| `cardio_stats` | `{ sessions_count, total_distance_km, avg_pace_min_per_km }` |
| `habits_streak` | `{ habits: [{habit_id, name, current_streak, completion_rate}] }` |

**Caching:** Widget data is fetched with `staleTime: 5 * 60 * 1000` (5 minutes) via TanStack Query. The key is `['widget-data', clientId, widget.type, widget.period_days, JSON.stringify(widget.config)]`.

### Flow 3: AI-driven dashboard edit

```
Coach types instruction in DashboardEditor ChatInputBar
  └── POST /api/coach/dashboards/:clientId/ai-edit
        body: { message, current_widgets: pendingWidgets ?? widgets, conversation_id? }
        → proxied to Hono: POST /coach/dashboards/:clientId/ai-edit
              → authMiddleware validates JWT
              → coach_client_links check (defense-in-depth)
              → buildDashboardEditSystemPrompt(clientName, currentWidgets)
              → streamText with 4 dashboard tools (state closure over current_widgets)
              → SSE stream to client
  └── DashboardEditor reads SSE:
        - type='chunk': append to chat messages (MessageBubble)
        - type='widget_update': setPendingWidgets(data.widgets) → DashboardGrid re-renders live
        - [DONE]: show PreviewBanner ("Sauvegarder les modifications ?")

Coach clicks "Sauvegarder"
  └── PUT /api/coach/dashboards/:clientId
        body: { widgets: pendingWidgets }
        → Hono upserts dashboard_configs
        → setWidgets(pendingWidgets); setPendingWidgets(null); setIsDirty(false)
```

### Flow 4: Coach memory (templates)

```
Coach clicks "Enregistrer comme modèle"
  └── GET /api/coach/dashboards/memory (fetch existing)
  └── PUT /api/coach/dashboards/memory
        body: { templates: [...existing, { name: 'Mon modèle', widgets: currentWidgets }] }

Coach opens a new client and clicks "Appliquer un modèle"
  └── GET /api/coach/dashboards/memory
  └── Coach picks template → setPendingWidgets(template.widgets)
  └── PUT /api/coach/dashboards/:newClientId (persist with one click)
```

---

## What Is New vs Modified

### New (green-field)

| Artifact | Location | Type |
|----------|----------|------|
| `dashboard_configs` table | migration 054 | New Supabase table |
| `coach_memory` table | migration 054 | New Supabase table |
| `coach/dashboards/db.ts` | backend | New file |
| `coach/dashboards/service.ts` | backend | New file (Hono router) |
| `coach/dashboards/tools.ts` | backend | New file (4 Claude tools) |
| `coach/dashboards/types.ts` | backend | New file |
| `GET /coach/clients/:id/widget-data` | backend | New endpoint in existing service |
| `DashboardShell` | apps/web | New client component |
| `DashboardGrid` + `WidgetCard` + 7 `*Widget` renderers | apps/web | New components |
| `DashboardEditor` | apps/web | New client component |
| `apps/web/.../clients/[id]/dashboard/page.tsx` | apps/web | New page |
| `apps/web/.../clients/[id]/dashboard/loading.tsx` | apps/web | New page skeleton |

### Modified (existing files touched)

| Artifact | Change |
|----------|--------|
| `backend/api/src/app.ts` | +1 line: `app.route('/coach/dashboards', dashboardsRouter)` |
| `ClientTabStrip.tsx` | Add `{ key: 'dashboard', label: 'Dashboard' }` to TABS array |

No changes to: `coach/ai/tools.ts`, `coach/ai/service.ts`, `context/user.ts`, the Next.js proxy route, or any Supabase RLS policies on existing tables.

---

## Constraints Honoured

- **Flat JSON schema only** — `widgets` is a flat ordered array; no graph, no node tree, no inter-widget references
- **RLS preserved** — all Hono routes use `createUserClient(jwt)`, service key never touches `dashboard_configs`
- **Existing proxy reused** — `apps/web/src/app/api/coach/[...path]/route.ts` already handles all `/coach/*` paths including SSE
- **Bounded context isolation** — dashboard tools are in `coach/dashboards/tools.ts`, never merged into `coach/ai/tools.ts`
- **No new proxy routes** — the catch-all already covers `/coach/dashboards/*`
- **Credit gate** — `POST /coach/dashboards/:clientId/ai-edit` should apply `creditCheck('coach_chat')` + `creditDeduct('coach_chat')` (same as `/coach/ai/chat/stream`) since it calls Claude
