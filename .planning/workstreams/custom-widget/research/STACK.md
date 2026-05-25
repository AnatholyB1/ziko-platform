# Technology Stack — Custom Widget Dashboard Builder

**Project:** Ziko Coach CRM — Custom Widget Dashboard  
**Researched:** 2026-05-25  
**Confidence:** HIGH (all claims verified against official docs, npm, and current sources)

---

## 1. Charting Library

### Decision: Stay on Recharts v3 (already installed)

**Current version in project:** `recharts@3.8.1` (already in `apps/web/package.json`)  
**No new install required.**

### Why Recharts, not Tremor or Nivo

| Criterion | Recharts v3 | Tremor | Nivo |
|-----------|-------------|--------|------|
| Already installed | YES | No | No |
| Bundle size | ~150 kB | ~200 kB (wraps Recharts) | 30-80 kB per chart, 500 kB+ full install |
| Weekly downloads | 2.4M | Much lower | Lower |
| Customization depth | High — composable components | Low — opinionated defaults, no escape hatch | High |
| SSR / Next.js App Router | Requires `'use client'`, no hydration issues | Same (built on Recharts) | SSR-capable SVG, but adds build complexity |
| TypeScript | First-class in v3 | Good | Good |
| AI-generated config friendliness | HIGH — all props are plain scalars | Medium | Medium — data transformers add friction |

**Why not Tremor:** Tremor joined Vercel in January 2025 and is still maintained, but it is a thin wrapper over Recharts. Adding Tremor doubles the chart bundle (150 kB → 200 kB) for zero capability gain. Its opinionated defaults are useful for marketing pages; they are a constraint when each widget type must accept AI-generated config schemas with arbitrary color, label, and axis overrides.

**Why not Nivo:** Nivo's 500 kB full install is prohibitive for a Next.js web app. Its strength is SVG-to-HTML SSR for emails and PDFs — not needed here.

### Recharts SSR Integration Note (IMPORTANT)

Recharts uses D3 internally and requires DOM measurement. The pattern for Next.js 15 App Router:

```tsx
// DashboardWidget.tsx
'use client'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'

// Wrap every chart component in 'use client'.
// ResponsiveContainer needs a fixed height or min-h class on its parent
// so it can measure on first render — set height prop or wrap in a div with h-full.
```

Do not use `ResponsiveContainer` in Server Components. It silently renders nothing because it depends on `ResizeObserver`.

---

## 2. Layout (Drag-and-Drop Grid)

### Decision: `react-grid-layout` v2

**Install:**
```bash
npm install react-grid-layout
```

**Current stable version:** `2.2.1` (released December 30, 2025). Full TypeScript rewrite; no separate `@types/react-grid-layout` needed.

### Why react-grid-layout

- Only maintained drag-and-drop grid library in the React ecosystem with responsive breakpoints and persistent layout serialization as plain JSON arrays — exactly what the flat dashboard config schema needs.
- v2 replaces the broken `WidthProvider` HOC (which caused SSR hydration errors) with a `useContainerWidth` hook that wraps `ResizeObserver` and is safe for `'use client'` components.
- Layout is described as `{ i, x, y, w, h }[]` — a flat, serializable array that maps directly to the `layout` field in the dashboard JSONB config.

### Next.js App Router Integration

```tsx
'use client'
import { ReactGridLayout, useContainerWidth } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

export function DashboardGrid({ layout, children }: Props) {
  const { width, containerRef, mounted } = useContainerWidth({
    measureBeforeMount: false, // false = render after first paint; true = SSR initial width
    initialWidth: 1200,
  })

  return (
    <div ref={containerRef}>
      {mounted && (
        <ReactGridLayout
          layout={layout}
          width={width}
          cols={12}
          rowHeight={80}
          draggableHandle=".drag-handle"
        />
      )}
    </div>
  )
}
```

**SSR note:** Use `mounted` guard. The grid itself is never server-rendered (it needs DOM measurements). This is intentional and correct.

**Edit vs view mode:** Pass `isDraggable={isEditing}` and `isResizable={isEditing}` to lock the layout during view mode with zero JS overhead.

---

## 3. JSON Schema for Widget Configs

### Decision: Flat discriminated union with Zod validation

**No new library needed.** Use TypeScript + Zod (already used throughout the codebase for AI SDK tool schemas).

### Schema Design Principles

- **Flat, not nested.** No graph/node architecture. A dashboard is an array of widgets; each widget is a self-contained object.
- **Discriminated on `type`.** Claude generates `{ type: 'line_chart', ... }` — the discriminator lets the renderer branch with full type safety and zero ambiguity.
- **`layout` embedded per widget.** The `react-grid-layout` item `{ i, x, y, w, h }` is stored inside each widget object so the JSONB blob is the single source of truth.

### Canonical TypeScript Schema

```typescript
// packages/coach-sdk/src/dashboard.ts  (or apps/web/src/lib/dashboard-schema.ts)

import { z } from 'zod'

// Shared grid position (react-grid-layout item)
const GridPos = z.object({
  x: z.number().int().min(0).max(11),
  y: z.number().int().min(0),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1),
})

// ---- Widget schemas ----

const LineChartWidget = z.object({
  id: z.string(),
  type: z.literal('line_chart'),
  title: z.string(),
  dataKey: z.string(),          // e.g. "weight_kg", "calories"
  color: z.string().optional(), // hex or CSS variable
  unit: z.string().optional(),
  gridPos: GridPos,
})

const BarChartWidget = z.object({
  id: z.string(),
  type: z.literal('bar_chart'),
  title: z.string(),
  dataKey: z.string(),
  color: z.string().optional(),
  unit: z.string().optional(),
  gridPos: GridPos,
})

const KpiTileWidget = z.object({
  id: z.string(),
  type: z.literal('kpi_tile'),
  title: z.string(),
  dataKey: z.string(),
  unit: z.string().optional(),
  format: z.enum(['number', 'percent', 'duration']).default('number'),
  gridPos: GridPos,
})

const TableWidget = z.object({
  id: z.string(),
  type: z.literal('table'),
  title: z.string(),
  columns: z.array(z.object({ key: z.string(), label: z.string() })),
  gridPos: GridPos,
})

const AthleteListWidget = z.object({
  id: z.string(),
  type: z.literal('athlete_list'),
  title: z.string(),
  filter: z.enum(['all', 'active', 'at_risk']).default('all'),
  gridPos: GridPos,
})

const ThresholdIndicatorWidget = z.object({
  id: z.string(),
  type: z.literal('threshold_indicator'),
  title: z.string(),
  dataKey: z.string(),
  threshold: z.number(),
  unit: z.string().optional(),
  gridPos: GridPos,
})

const CalloutWidget = z.object({
  id: z.string(),
  type: z.literal('callout'),
  title: z.string(),
  message: z.string(),
  severity: z.enum(['info', 'warning', 'success']).default('info'),
  gridPos: GridPos,
})

// Discriminated union — the single Widget type
export const Widget = z.discriminatedUnion('type', [
  LineChartWidget,
  BarChartWidget,
  KpiTileWidget,
  TableWidget,
  AthleteListWidget,
  ThresholdIndicatorWidget,
  CalloutWidget,
])
export type Widget = z.infer<typeof Widget>

// Full dashboard config — this is what is stored in JSONB
export const DashboardConfig = z.object({
  version: z.literal(1),
  name: z.string(),
  widgets: z.array(Widget),
})
export type DashboardConfig = z.infer<typeof DashboardConfig>
```

**Why discriminated union:** The Zod `.discriminatedUnion('type', [...])` is both validation and the tool schema source. Claude's tool input schema is derived from `DashboardConfig` via `zodToJsonSchema` — the same type describes what Claude generates, what Zod validates, and what the renderer switches on.

**Why flat (no graph):** The milestone spec explicitly states flat. Graph/node architectures (Retool, Grafana) add irreversible complexity: cycle detection, dependency resolution, port typing. None of that is needed when widgets are display-only with independent data fetches.

---

## 4. Live Preview Pattern (Tool Calling)

### Decision: Optimistic client-side state + Vercel AI SDK v6 `useChat` with typed tool parts

**No new library needed.** The pattern is architectural, built on the existing AI SDK v6 setup.

### Flow

```
Coach types "add a line chart for body weight"
  → POST /api/ai/dashboard/chat  (streamText, server action or API route)
  → Claude calls tool: update_dashboard_config({ widgets: [...] })
  → Tool result streams back as a typed part
  → useChat parses part.type === 'tool-update_dashboard_config'
  → Client reads part.output.config (validated with DashboardConfig.parse)
  → React setState updates preview immediately
  → Preview panel re-renders with new widget layout
  → Coach clicks "Save" → PATCH /api/dashboards/:id
```

### Server-Side Tool Definition

```typescript
// backend/api/src/tools/dashboard.ts
import { tool } from 'ai'
import { z } from 'zod'
import { DashboardConfig } from '@ziko/coach-sdk'

export const updateDashboardConfig = tool({
  description: 'Update the dashboard layout with the coach\'s requested changes.',
  inputSchema: DashboardConfig,  // AI SDK v6 uses inputSchema (not parameters)
  execute: async (input) => {
    // Validate and return — no DB write here, that's the Save button
    const parsed = DashboardConfig.safeParse(input)
    if (!parsed.success) throw new Error('Invalid config: ' + parsed.error.message)
    return parsed.data
  },
})
```

### Client-Side Rendering

```tsx
'use client'
import { useChat } from '@ai-sdk/react'

const { messages, addToolOutput } = useChat({
  api: '/api/ai/dashboard/chat',
  onToolCall: async ({ toolCall }) => {
    // Automatic client-side tools go here if needed
    // For update_dashboard_config, the server executes it — no client action needed
  },
})

// Render the live preview from the latest tool output
const latestConfig = messages
  .flatMap(m => m.parts ?? [])
  .filter(p => p.type === 'tool-update_dashboard_config' && p.state === 'output-available')
  .at(-1)?.output
```

### Split-Screen Layout

```
┌─────────────────────────────────────────┐
│  [Edit mode]                            │
├──────────────┬──────────────────────────┤
│  Chat panel  │  Live preview            │
│  (1/3 width) │  (2/3 width, real grid)  │
│              │  react-grid-layout       │
└──────────────┴──────────────────────────┘
[Full-screen view mode — chat panel hidden]
```

Use a simple boolean `isEditing` in Zustand. When false, the chat panel unmounts and the grid fills the viewport. No router change needed; no URL state required for MVP.

### Integration Concern: Vercel AI SDK v6 vs existing `/ai/chat` route

The existing backend uses `POST /ai/chat/stream` and `POST /ai/chat` (Hono routes). The dashboard tool should be a **separate route** (`POST /ai/dashboard/chat`) with its own tool registry to avoid contaminating the mobile coaching conversation tools. The mobile `AIBridge` SSE client reads the Ziko SSE format (`data: {"type":"chunk",...}`); the dashboard uses standard AI SDK streaming. Do not mix them.

---

## 5. Storage (Dashboard Config in Supabase)

### Decision: New `coach_dashboards` table with `config JSONB` column + pg_jsonschema validation

**Migration approach:** Add a new SQL migration (`022_coach_dashboards.sql`).

### Table Schema

```sql
CREATE TABLE public.coach_dashboards (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL DEFAULT 'My Dashboard',
  config        jsonb NOT NULL DEFAULT '{"version":1,"name":"My Dashboard","widgets":[]}'::jsonb,
  is_default    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Index for fast per-coach queries
CREATE INDEX coach_dashboards_coach_id_idx ON public.coach_dashboards(coach_id);

-- RLS (standard Ziko pattern)
ALTER TABLE public.coach_dashboards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach_dashboards_own" ON public.coach_dashboards
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

-- Only one default dashboard per coach
CREATE UNIQUE INDEX coach_dashboards_default_idx
  ON public.coach_dashboards(coach_id)
  WHERE is_default = true;

-- Optional: pg_jsonschema validation (Supabase has pg_jsonschema enabled by default)
-- Add after schema is stable to prevent migration churn during development
```

### Coach Memory (Preferences)

Dashboard configs are naturally per-coach because `coach_id = auth.uid()`. For long-term coach preferences (preferred colors, default widget types, AI coaching style learned from past edits), store in a `coach_preferences` JSONB column on `user_profiles` or in a dedicated `coach_memory` table. Do not embed preferences in the dashboard config — that would conflate layout state with identity.

### Why JSONB, not normalized tables

The dashboard config is a **document**, not relational data. Widgets have heterogeneous shapes (a KPI tile has `format`, a line chart has `color`, etc.). Normalizing to a `widgets` table with nullable columns for every field would require a schema migration for every new widget type. JSONB stores the entire config atomically, and Zod validates shape on read/write — this is the correct boundary.

### API Surface (Hono routes to add)

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/dashboards` | List coach's dashboards (name, id, is_default) |
| `GET` | `/dashboards/:id` | Fetch full config |
| `POST` | `/dashboards` | Create new dashboard |
| `PATCH` | `/dashboards/:id` | Save updated config (after AI edit session) |
| `DELETE` | `/dashboards/:id` | Delete |
| `POST` | `/ai/dashboard/chat` | AI chat with dashboard tools |

---

## Integration Concerns Summary

| Concern | Severity | Mitigation |
|---------|----------|------------|
| Recharts `ResponsiveContainer` + SSR | Medium | Always wrap chart components in `'use client'`, add fixed height to parent |
| `react-grid-layout` hydration mismatch | Medium | Use `mounted` guard from `useContainerWidth`, `initialWidth: 1200` |
| AI SDK dashboard route vs mobile chat route | High | Separate Hono routes, separate tool registry — never share |
| JSONB config grows unbounded | Low | Cap widgets array at 20 in Zod schema (`z.array(Widget).max(20)`) |
| Tool calling `inputSchema` size (large config) | Medium | Claude context window is sufficient; use `DashboardConfig` not full conversation history for tool input |
| Zod `zodToJsonSchema` for AI SDK input | Low | Use `zod-to-json-schema@3.x` — already a transitive dep of AI SDK |

---

## Installation Summary

```bash
# From apps/web — only new addition
npm install react-grid-layout
# react-grid-layout@2.2.1 (no @types needed — full TS in v2)

# recharts@3.8.1 is already installed
# zod is already installed
```

**CSS (import once in the dashboard layout file):**
```tsx
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
```

---

## Sources

- [Recharts v3 npm (recharts@3.8.1)](https://www.npmjs.com/package/recharts)
- [Recharts + Next.js App Router integration guide](https://app-generator.dev/docs/technologies/nextjs/integrate-recharts.html)
- [ResponsiveContainer SSR known issue #531](https://github.com/recharts/recharts/issues/531)
- [shadcn/ui chart docs (Recharts-based)](https://ui.shadcn.com/docs/components/radix/chart)
- [react-grid-layout v2 GitHub](https://github.com/react-grid-layout/react-grid-layout)
- [react-grid-layout v2 RFC / TypeScript rewrite](https://github.com/react-grid-layout/react-grid-layout/blob/master/rfcs/0001-v2-typescript-rewrite.md)
- [Recharts v3 vs Tremor vs Nivo 2026 — PkgPulse](https://www.pkgpulse.com/guides/recharts-v3-vs-tremor-vs-nivo-react-charting-2026)
- [Vercel AI SDK 6 blog](https://vercel.com/blog/ai-sdk-6)
- [AI SDK UI Chatbot with Tool Calling docs](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-with-tool-calling)
- [AI SDK Core: Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [Supabase pg_jsonschema](https://supabase.com/docs/guides/database/extensions/pg_jsonschema)
- [Supabase JSON/JSONB guide](https://supabase.com/docs/guides/database/json)
- [Zod discriminated unions](https://zod.dev/api)
