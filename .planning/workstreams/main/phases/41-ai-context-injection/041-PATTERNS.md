# Phase 41: AI Context Injection - Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 10
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/api/src/coach/ai/types.ts` | model | — | `backend/api/src/coach/dashboards/types.ts` | exact (types-only file, same module pattern) |
| `backend/api/src/coach/ai/service.ts` | service | request-response | self (extend existing) | exact |
| `backend/api/src/coach/dashboards/service.ts` | service | request-response + CRUD | self (extend existing) | exact |
| `supabase/migrations/062_coach_metric_thresholds.sql` | migration | — | `supabase/migrations/050_coach_ai_schema.sql` | exact (same RLS + index pattern) |
| `apps/web/src/hooks/useInsights.ts` | hook | request-response | `apps/web/src/components/coach/dashboard/PowerliftingDashboard.tsx` (useQuery usage) | exact |
| `apps/web/src/components/coach/dashboard/DashboardChatDrawer.tsx` | component | streaming (SSE) | `apps/web/src/components/coach/dashboard/EditChatPanel.tsx` | exact |
| `apps/web/src/components/coach/dashboard/NarrativeSummaryCard.tsx` | component | request-response | `apps/web/src/components/coach/dashboard/ChartCard.tsx` | role-match |
| `apps/web/src/components/coach/dashboard/AlertesModal.tsx` | component | CRUD | `apps/web/src/components/coach/dashboard/DashboardEditOverlay.tsx` (modal structure, fetch pattern) | role-match |
| `apps/web/src/components/coach/dashboard/DashboardControlBar.tsx` | component | request-response | self (extend existing) | exact |
| `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx` | component | request-response | self (extend existing) | exact |

---

## Pattern Assignments

### `backend/api/src/coach/ai/types.ts` (model — extend)

**Analog:** `backend/api/src/coach/dashboards/types.ts` + self

**Existing interface** (lines 27–30 of `backend/api/src/coach/ai/types.ts`):
```typescript
export interface CoachContext {
  profile: { display_name: string | null } | null;
  clients: Array<{ id: string; name: string }>;
}
```

**New interfaces to append** — follow the same "interfaces only, no runtime code" convention:
```typescript
// DashboardContext: injected into the system prompt when the coach
// opens the chat drawer from the Sport dashboard (AI-01, D-03/D-04).
export interface DashboardContext {
  sport_type: string;  // e.g. "Powerlifting"
  metrics: Record<string, string>;  // e.g. { "1RM Squat (dernier)": "185 kg", "RPE moyen": "8.2" }
}

// ThresholdAlert: returned by the insights endpoint when a metric
// crosses a coach-configured threshold (AI-04, D-13).
export interface ThresholdAlert {
  metric_key: string;
  operator: '>' | '<';
  threshold_value: number;
  current_value: number;
}

// InsightsResponse: full response shape from POST /coach/dashboards/:clientId/insights.
export interface InsightsResponse {
  chartInsights: Record<string, string>;
  narrative: string;
  crossedThresholds: ThresholdAlert[];
}

// CoachMetricThreshold: row shape for coach_metric_thresholds table (AI-04, D-11).
export interface CoachMetricThreshold {
  id: string;
  coach_id: string;
  client_id: string;
  sport_type: string;
  metric_key: string;
  operator: '>' | '<';
  threshold_value: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

---

### `backend/api/src/coach/ai/service.ts` (service — extend `buildCoachSystemPrompt`)

**Analog:** self (`backend/api/src/coach/ai/service.ts`)

**Existing function signature** (line 71):
```typescript
function buildCoachSystemPrompt(ctx: CoachContext): string {
```

**Extended signature** — add optional second parameter and `## Dashboard Context` section:
```typescript
import type { CoachContext, DashboardContext } from './types.js';

function buildCoachSystemPrompt(ctx: CoachContext, dashboardCtx?: DashboardContext): string {
  const sections: string[] = [COACH_BASE_SYSTEM];

  if (ctx.profile?.display_name) {
    sections.push(`## Coach Profile\nName: ${ctx.profile.display_name}`);
  }

  if (ctx.clients.length > 0) {
    const clientList = ctx.clients.map((c) => `- ${c.name} (id: ${c.id})`).join('\n');
    sections.push(`## Linked Clients\n${clientList}`);
  } else {
    sections.push('## Linked Clients\nNo linked clients yet. Ask the coach to invite clients first.');
  }

  // AI-01 dashboard context injection — appended only when present (D-03/D-04)
  if (dashboardCtx) {
    const metricLines = Object.entries(dashboardCtx.metrics)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join('\n');
    sections.push(
      `## Dashboard Context\nSport actif: ${dashboardCtx.sport_type}\nIndicateurs récents:\n${metricLines}`
    );
  }

  return sections.join('\n\n');
}
```

**Route handler change** — in POST `/chat/stream` (lines 444–447), extend body type and pass second arg:
```typescript
// Before (line 444):
const { messages = [], conversation_id: bodyConversationId } = await c.req.json<{
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  conversation_id?: string;
}>();

// After:
const { messages = [], conversation_id: bodyConversationId, dashboard_context } = await c.req.json<{
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  conversation_id?: string;
  dashboard_context?: DashboardContext;
}>();

// Line 481 — pass dashboardCtx:
const systemPrompt = buildCoachSystemPrompt(coachCtx, dashboard_context);
```

**Auth/guard pattern** (already applied, no change needed):
```typescript
// line 396 — all routes below are auto-gated:
router.use('*', authMiddleware);
// credit gate on chat/stream (lines 440–442):
router.post('/chat/stream', creditCheck('coach_chat'), creditDeduct('coach_chat'), async (c) => {
```

---

### `backend/api/src/coach/dashboards/service.ts` (service — extend with 4 new routes)

**Analog:** self (`backend/api/src/coach/dashboards/service.ts`)

**Registration order rule** (comment L-05, line 17 of analog):
```typescript
// L-05: /memory routes MUST be registered before /:clientId to prevent
// Hono from treating the literal string "memory" as a clientId param.
```
Apply the same rule: register `/:clientId/insights`, `/:clientId/thresholds` (GET/POST/DELETE) **before** the `/:clientId` GET at line 79.

**Imports to add** (follow existing import block, lines 1–11):
```typescript
import { generateText } from 'ai'
import { AGENT_MODEL } from '../../config/models.js'
import { createUserClient } from '../clients/db.js'
import type { InsightsResponse, ThresholdAlert, CoachMetricThreshold } from '../ai/types.js'
```

**Core insights route pattern** — follows creditCheck pattern from `/:clientId/ai-edit` (lines 120–127):
```typescript
// POST /:clientId/insights — MUST be registered before GET /:clientId
dashboardsRouter.post(
  '/:clientId/insights',
  creditCheck('coach_chat'),
  creditDeduct('coach_chat'),
  async (c) => {
    const { userId: coachId } = c.get('auth')
    const jwt = c.req.header('Authorization')!.slice(7)
    const clientId = c.req.param('clientId')

    const body = await c.req.json<{
      sport: string
      period: string
      chartData: Record<string, unknown>
    }>()

    const db = createUserClient(jwt)
    const { data: thresholds } = await db
      .from('coach_metric_thresholds')
      .select('*')
      .eq('coach_id', coachId)
      .eq('client_id', clientId)
      .eq('sport_type', body.sport)
      .eq('is_active', true)

    // generateText JSON pattern — mirrors tools.ts lines 294–299
    const { text } = await generateText({
      model: AGENT_MODEL,
      messages: [{ role: 'user', content: buildInsightsPrompt(body.sport, body.period, body.chartData) }],
    })
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    let parsed: { chartInsights: Record<string, string>; narrative: string }
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      parsed = { chartInsights: {}, narrative: '' }
    }

    // Inline threshold evaluation — operator is '>' | '<' only (D-11)
    const crossedThresholds: ThresholdAlert[] = []
    for (const t of (thresholds ?? [])) {
      const currentVal = (body.chartData as any)[t.metric_key]
      if (typeof currentVal === 'number') {
        const crossed = t.operator === '>' ? currentVal > t.threshold_value : currentVal < t.threshold_value
        if (crossed) crossedThresholds.push({
          metric_key: t.metric_key,
          operator: t.operator,
          threshold_value: t.threshold_value,
          current_value: currentVal,
        })
      }
    }

    return c.json({ ...parsed, crossedThresholds } satisfies InsightsResponse)
  }
)
```

**Thresholds CRUD pattern** — follows the same `db.from(...).select/insert/delete` pattern as `getDashboardConfig` in `db.ts`:
```typescript
// GET /:clientId/thresholds — MUST be registered before GET /:clientId
dashboardsRouter.get('/:clientId/thresholds', async (c) => {
  const { userId: coachId } = c.get('auth')
  const jwt = c.req.header('Authorization')!.slice(7)
  const clientId = c.req.param('clientId')
  const sport = c.req.query('sport')
  const db = createUserClient(jwt)
  let q = db.from('coach_metric_thresholds').select('*').eq('coach_id', coachId).eq('client_id', clientId)
  if (sport) q = q.eq('sport_type', sport)
  const { data, error } = await q
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ thresholds: data ?? [] })
})

// POST /:clientId/thresholds
dashboardsRouter.post('/:clientId/thresholds', async (c) => {
  const { userId: coachId } = c.get('auth')
  const jwt = c.req.header('Authorization')!.slice(7)
  const clientId = c.req.param('clientId')
  const body = await c.req.json<Omit<CoachMetricThreshold, 'id' | 'coach_id' | 'client_id' | 'created_at' | 'updated_at'>>()
  const db = createUserClient(jwt)
  const { data, error } = await db
    .from('coach_metric_thresholds')
    .insert({ ...body, coach_id: coachId, client_id: clientId })
    .select('*')
    .single()
  if (error) return c.json({ error: error.message }, 400)
  return c.json({ threshold: data })
})

// DELETE /:clientId/thresholds/:thresholdId
dashboardsRouter.delete('/:clientId/thresholds/:thresholdId', async (c) => {
  const { userId: coachId } = c.get('auth')
  const jwt = c.req.header('Authorization')!.slice(7)
  const clientId = c.req.param('clientId')
  const thresholdId = c.req.param('thresholdId')
  const db = createUserClient(jwt)
  const { error } = await db
    .from('coach_metric_thresholds')
    .delete()
    .eq('id', thresholdId)
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ deleted: true })
})
```

**Error handling pattern** (from GET `/memory`, lines 28–32):
```typescript
try {
  // ... route logic
} catch (err: any) {
  return c.json({ error: err.message }, 500)
}
```

---

### `supabase/migrations/062_coach_metric_thresholds.sql` (migration)

**Analog:** `supabase/migrations/050_coach_ai_schema.sql`

**Migration header pattern** (lines 1–11 of 050):
```sql
SET LOCAL lock_timeout = '5s';

-- ============================================================
-- Migration 062: coach_metric_thresholds
-- Numeric alert threshold configuration per coach+client+sport.
-- Coach configures thresholds; evaluation happens on dashboard load
-- inside the insights endpoint (Phase 41, AI-04).
-- RLS: coach reads/writes own rows via JWT.
-- ============================================================
```

**Table + RLS pattern** (mirrors 050's `coach_alerts` table, lines 16–39):
```sql
CREATE TABLE IF NOT EXISTS public.coach_metric_thresholds (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sport_type       TEXT        NOT NULL,
  metric_key       TEXT        NOT NULL,
  operator         TEXT        NOT NULL CHECK (operator IN ('>', '<')),
  threshold_value  NUMERIC     NOT NULL,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_metric_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_metric_thresholds_own" ON public.coach_metric_thresholds
  FOR ALL
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

-- Fast lookup on dashboard load (coach+client+sport combo, active only)
CREATE INDEX IF NOT EXISTS idx_coach_metric_thresholds_lookup
  ON public.coach_metric_thresholds(coach_id, client_id, sport_type)
  WHERE is_active = true;

-- End of migration 062.
```

---

### `apps/web/src/hooks/useInsights.ts` (hook — new file)

**Analog:** `apps/web/src/components/coach/dashboard/PowerliftingDashboard.tsx` (lines 68–73)

**TanStack Query pattern** (exact analog):
```typescript
// PowerliftingDashboard.tsx lines 68-73:
const { data, isLoading, error } = useQuery({
  queryKey: ['powerlifting', clientId, sport, dateRange],
  queryFn: () => fetchPowerliftingData(supabase, clientId, dateRange),
  enabled: sport === 'powerlifting',
  staleTime: 60_000,
});
```

**New hook — follow same structure, POST body instead of supabase client call:**
```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import type { InsightsResponse } from '@/types/coach-ai';  // re-export from backend types or mirror

export function useInsights(
  clientId: string,
  sport: string | null,
  dateRange: string,
  chartData: Record<string, unknown> | null,
) {
  return useQuery<InsightsResponse>({
    queryKey: ['dashboard-insights', clientId, sport, dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/coach/dashboards/${clientId}/insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport, period: dateRange, chartData }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!sport && !!chartData,   // D-08: only fire after sport dashboard data is ready
    staleTime: 120_000,
    gcTime: 300_000,
  });
}
```

---

### `apps/web/src/components/coach/dashboard/DashboardChatDrawer.tsx` (component — new file, SSE)

**Analog:** `apps/web/src/components/coach/dashboard/EditChatPanel.tsx`

**Imports pattern** (lines 1–11 of EditChatPanel):
```typescript
'use client';

import { useState, useRef, useCallback } from 'react';
import { MessageBubble } from '@/components/coach/MessageBubble';
import type { Message } from '@/components/coach/MessageBubble';
import { ChatInputBar } from '@/components/coach/ChatInputBar';
import { TypingIndicator } from './TypingIndicator';
import type { DashboardContext } from '@/types/coach-ai';
```

**Props interface pattern** (lines 17–24 of EditChatPanel, stripped to drawer-relevant fields):
```typescript
interface DashboardChatDrawerProps {
  clientId: string;
  isOpen: boolean;
  onClose: () => void;
  dashboardContextRef: React.MutableRefObject<DashboardContext | null>;  // useRef — avoids stale closure (PITFALLS #3 in RESEARCH.md)
}
```

**SSE fetch + buffer parsing** — copy exactly from EditChatPanel lines 148–224:
```typescript
// Key difference from EditChatPanel: endpoint + body shape
const res = await fetch('/api/coach/ai/chat/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: conversationHistory,
    conversation_id: conversationIdRef.current ?? undefined,
    dashboard_context: dashboardContextRef.current,  // read from ref, not closure — avoids stale value
  }),
});

// Buffer + reader loop — copy verbatim from EditChatPanel.tsx lines 162-224:
const reader = res.body!.getReader();
const decoder = new TextDecoder();
let buffer = '';
let aiMsgId: string | null = null;

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const parts = buffer.split('\n\n');
  buffer = parts.pop() ?? '';
  for (const part of parts) {
    const line = part.trim();
    if (!line.startsWith('data: ')) continue;
    const raw = line.slice(6);
    if (raw === '[DONE]') { setIsStreaming(false); continue; }
    try {
      const event = JSON.parse(raw);
      if (event.type === 'meta') { conversationIdRef.current = event.conversation_id; }
      else if (event.type === 'chunk') { /* append to assistant bubble */ }
      else if (event.type === 'error') { setError(event.error ?? 'Erreur inconnue'); setIsStreaming(false); }
    } catch { /* skip malformed JSON */ }
  }
}
```

**Drawer animation — CSS Tailwind transition** (NOT GSAP — see RESEARCH.md anti-patterns):
```tsx
// Outer wrapper — fixed right panel with CSS translate-x transition
<div
  className={`fixed right-0 top-0 h-full w-[420px] bg-white border-l border-[#E2E0DA] z-30
    transform transition-transform duration-200 ease-out shadow-xl
    ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
  role="dialog"
  aria-modal="true"
  aria-label="Chat IA — contexte dashboard"
>
  {/* Header bar */}
  <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E0DA]" style={{ height: 52 }}>
    <span style={{ fontSize: 14, fontWeight: 600, color: '#1C1A17' }}>Demander à l'IA</span>
    <button onClick={onClose} aria-label="Fermer le chat" className="text-muted hover:text-text">
      <X className="w-4 h-4" />
    </button>
  </div>
  {/* Messages + input — same structure as EditChatPanel render (lines 241-297) */}
</div>

{/* Backdrop — partial overlay, does not block chart area */}
{isOpen && (
  <div
    className="fixed inset-0 z-20 bg-black/10"
    onClick={onClose}
    aria-hidden="true"
  />
)}
```

---

### `apps/web/src/components/coach/dashboard/NarrativeSummaryCard.tsx` (component — new file)

**Analog:** `apps/web/src/components/coach/dashboard/ChartCard.tsx`

**Card anatomy pattern** (ChartCard lines 13–26 — white bg, rounded-2xl, border-border, p-6):
```tsx
'use client';

interface NarrativeSummaryCardProps {
  narrative: string | undefined;
  sport: string;
  isLoading: boolean;
}

export function NarrativeSummaryCard({ narrative, sport, isLoading }: NarrativeSummaryCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-border p-6 mb-4 w-full">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base leading-none">🧠</span>
        <h3 className="text-[15px] font-semibold text-text">
          Analyse IA — {sport}
        </h3>
      </div>
      {isLoading ? (
        // 2-line skeleton (D-09)
        <div className="space-y-2">
          <div className="h-3 bg-[#E2E0DA] rounded animate-pulse w-full" />
          <div className="h-3 bg-[#E2E0DA] rounded animate-pulse w-3/4" />
        </div>
      ) : (
        <p className="text-sm text-muted leading-relaxed">
          {narrative ?? 'Analyse IA disponible dès la sélection d\'un sport.'}
        </p>
      )}
    </div>
  );
}
```

---

### `apps/web/src/components/coach/dashboard/AlertesModal.tsx` (component — new file, CRUD)

**Analog:** `apps/web/src/components/coach/dashboard/DashboardEditOverlay.tsx` (modal overlay structure, fetch patterns) + `DashboardControlBar.tsx` (button styles)

**Modal overlay wrapper pattern** (DashboardEditOverlay lines 106–119):
```tsx
'use client';

import { useState, useEffect } from 'react';
import { X, Trash2, Plus } from 'lucide-react';
import type { CoachMetricThreshold } from '@/types/coach-ai';

interface AlertesModalProps {
  clientId: string;
  sport: string | null;
  onClose: () => void;
}

export function AlertesModal({ clientId, sport, onClose }: AlertesModalProps) {
  const [thresholds, setThresholds] = useState<CoachMetricThreshold[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch on mount
  useEffect(() => {
    if (!sport) return;
    fetch(`/api/coach/dashboards/${clientId}/thresholds?sport=${encodeURIComponent(sport)}`)
      .then(r => r.json())
      .then(d => { setThresholds(d.thresholds ?? []); setIsLoading(false); })
      .catch(() => { setError('Impossible de charger les seuils.'); setIsLoading(false); });
  }, [clientId, sport]);

  // Overlay + centered panel (NOT slide-in — modal pattern from DashboardEditOverlay)
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Configuration des alertes"
      style={{ position: 'fixed', inset: 0, zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {/* Backdrop */}
      <div
        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)' }}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div style={{ position: 'relative', zIndex: 1, background: '#FFFFFF', borderRadius: 16, width: 480, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid #E2E0DA' }}>
        {/* Header */}
        <div style={{ height: 52, display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid #E2E0DA' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1C1A17' }}>Alertes — {sport ?? 'Sport'}</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} aria-label="Fermer" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X style={{ width: 16, height: 16, color: '#6B6963' }} />
          </button>
        </div>
        {/* Content — threshold list + add form */}
      </div>
    </div>
  );
}
```

**Fetch for CRUD operations** — follows DashboardEditOverlay handleSave fetch pattern (lines 63–73):
```typescript
// DELETE threshold
async function deleteThreshold(id: string) {
  await fetch(`/api/coach/dashboards/${clientId}/thresholds/${id}`, { method: 'DELETE' });
  setThresholds(prev => prev.filter(t => t.id !== id));
}

// POST new threshold
async function addThreshold(body: Omit<CoachMetricThreshold, 'id' | 'coach_id' | 'client_id' | 'created_at' | 'updated_at'>) {
  const res = await fetch(`/api/coach/dashboards/${clientId}/thresholds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  setThresholds(prev => [...prev, data.threshold]);
}
```

**Badge color pattern** (from CONTEXT.md `## Specific Ideas`):
```tsx
// Orange for warning threshold crossing on ChartCard title bar
const badgeStyle = {
  backgroundColor: '#FF5C1A',  // primary orange = warning
  color: '#FFFFFF',
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 600,
  padding: '1px 6px',
};
// Red for critical (delta > 20%) — not required in Phase 41 but reserved
// const criticalBadgeStyle = { ...badgeStyle, backgroundColor: '#EF4444' };
```

---

### `apps/web/src/components/coach/dashboard/DashboardControlBar.tsx` (component — extend)

**Analog:** self

**Existing props interface** (lines 14–34 of DashboardControlBar.tsx) — add two new callback props:
```typescript
interface DashboardControlBarProps {
  // ... existing props unchanged ...
  // New in Phase 41 (AI-01/AI-04):
  onOpenChat: () => void;
  onOpenAlerts: () => void;
}
```

**Button pattern to copy** (existing Export PDF button, lines 106–128):
```tsx
// "Demander à l'IA" button — same style as Comparer button (lines 75–86)
<button
  onClick={onOpenChat}
  className="h-9 px-3 flex items-center gap-1.5 text-sm font-medium text-text border border-border rounded-lg bg-white hover:bg-[#F0EFE9] transition-colors"
>
  <MessageCircle className="w-4 h-4 text-muted" />
  Demander à l'IA
</button>

// "Alertes" button — same style, placed before the chat button
<button
  onClick={onOpenAlerts}
  className="h-9 px-3 flex items-center gap-1.5 text-sm font-medium text-text border border-border rounded-lg bg-white hover:bg-[#F0EFE9] transition-colors"
>
  <Bell className="w-4 h-4 text-muted" />
  Alertes
</button>
```

**Import addition** (line 3 of DashboardControlBar.tsx — already imports from lucide-react):
```typescript
import { Users, FileDown, Loader2, Check, MessageCircle, Bell } from 'lucide-react';
```

---

### `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx` (component — extend)

**Analog:** self

**New state variables** — follow the `useState` pattern already in the page (lines 29–47):
```typescript
// Phase 41 AI state — add after existing state declarations
const [isChatOpen, setIsChatOpen] = useState(false);
const [isAlertesOpen, setIsAlertesOpen] = useState(false);
const [chartSummary, setChartSummary] = useState<Record<string, unknown> | null>(null);
// dashboardContextRef: read by DashboardChatDrawer without stale closure (useRef pattern)
const dashboardContextRef = useRef<{ sport_type: string; metrics: Record<string, string> } | null>(null);
```

**useInsights hook call** — add after existing hooks (line 37 area), follows useExportPDF pattern:
```typescript
import { useInsights } from '@/hooks/useInsights';

const { data: insights, isLoading: insightsLoading } = useInsights(clientId, sport, dateRange, chartSummary);
```

**DashboardControlBar extension** — add two new props to existing JSX (lines 153–172):
```tsx
<DashboardControlBar
  // ... all existing props unchanged ...
  onOpenChat={() => setIsChatOpen(true)}
  onOpenAlerts={() => setIsAlertesOpen(true)}
/>
```

**NarrativeSummaryCard placement** — inside `{activeTab === 'sport'}` block, above `<div ref={sportDashboardRef}>` (line 174):
```tsx
<NarrativeSummaryCard
  narrative={insights?.narrative}
  sport={sport ?? ''}
  isLoading={insightsLoading && !!sport}
/>
```

**Sport dashboard callback prop** — each sport dashboard receives `onDataReady` (Open Question #2 resolution from RESEARCH.md):
```tsx
<PowerliftingDashboard
  // ... existing props ...
  onDataReady={(summary) => {
    setChartSummary(summary);
    // Also update dashboardContextRef for the chat drawer
    if (sport) {
      dashboardContextRef.current = {
        sport_type: sport,
        metrics: Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, String(v)])),
      };
    }
  }}
/>
```

**DashboardChatDrawer + AlertesModal mount** — add after `{activeTab === 'widget'}` block, at bottom of return (line ~304):
```tsx
{/* AI-01: Dashboard chat drawer */}
<DashboardChatDrawer
  clientId={clientId}
  isOpen={isChatOpen}
  onClose={() => setIsChatOpen(false)}
  dashboardContextRef={dashboardContextRef}
/>

{/* AI-04: Threshold config modal */}
{isAlertesOpen && (
  <AlertesModal
    clientId={clientId}
    sport={sport}
    onClose={() => setIsAlertesOpen(false)}
  />
)}
```

**ChartCard threshold badge wiring** — pass `crossedThresholds` from insights down to each sport dashboard as a prop; each `ChartCard` renders a badge when `insights?.crossedThresholds.some(t => t.metric_key === chartKey)`.

---

## Shared Patterns

### Authentication
**Source:** `backend/api/src/coach/dashboards/service.ts` line 14
**Apply to:** All new Hono routes in `dashboardsRouter`
```typescript
dashboardsRouter.use('*', authMiddleware)
// All routes under dashboardsRouter are already auth-gated — no per-route auth needed.
```

### Credit Gate
**Source:** `backend/api/src/coach/dashboards/service.ts` lines 120–122
**Apply to:** `POST /:clientId/insights` only (AI call)
```typescript
dashboardsRouter.post('/:clientId/insights',
  creditCheck('coach_chat'),
  creditDeduct('coach_chat'),
  async (c) => { /* ... */ }
)
```

### Error Handling (backend)
**Source:** `backend/api/src/coach/dashboards/service.ts` lines 28–32
**Apply to:** All new Hono route handlers
```typescript
try {
  // ... route logic
} catch (err: any) {
  return c.json({ error: err.message }, 500)
}
```

### Supabase JWT Client
**Source:** `backend/api/src/coach/dashboards/service.ts` lines 82–83
**Apply to:** All new Hono route handlers that query Supabase
```typescript
const { userId: coachId } = c.get('auth')
const jwt = c.req.header('Authorization')!.slice(7)
const db = createUserClient(jwt)
// Always scope by coach_id — defense in depth (RLS + explicit eq)
```

### generateText JSON pattern
**Source:** `backend/api/src/coach/ai/tools.ts` lines 294–299
**Apply to:** `POST /:clientId/insights` route
```typescript
const { text } = await generateText({
  model: AGENT_MODEL,
  messages: [{ role: 'user', content: prompt }],
});
const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
const parsed = JSON.parse(cleaned);
```

### SSE stream error handling (frontend)
**Source:** `apps/web/src/components/coach/dashboard/EditChatPanel.tsx` lines 225–229
**Apply to:** `DashboardChatDrawer.tsx` streamChat function
```typescript
} catch (err) {
  console.error('[DashboardChatDrawer] stream error:', err);
  setError('Erreur de connexion. Réessayez dans un instant.');
  setIsStreaming(false);
}
```

### Card anatomy (frontend)
**Source:** `apps/web/src/components/coach/dashboard/ChartCard.tsx` line 15
**Apply to:** `NarrativeSummaryCard.tsx`
```typescript
className="bg-white rounded-2xl border border-border p-6"
```

### Button style (secondary)
**Source:** `apps/web/src/components/coach/dashboard/DashboardControlBar.tsx` lines 75–86
**Apply to:** New "Demander à l'IA" and "Alertes" buttons in DashboardControlBar
```typescript
className="h-9 px-3 flex items-center gap-1.5 text-sm font-medium text-text border border-border rounded-lg bg-white hover:bg-[#F0EFE9] transition-colors"
```

---

## No Analog Found

All 10 files have close analogs. No entries in this section.

---

## Key Anti-Patterns (from RESEARCH.md — relay to planner)

1. **Route registration order:** `/:clientId/insights` and `/:clientId/thresholds` must be registered before `/:clientId` GET in `dashboardsRouter`. Hono matches in registration order.
2. **No per-chart generateText calls:** One batch call returns all insights. Per-chart calls multiply latency and cost (D-07).
3. **No streamText for insights:** `generateText` only — JSON must be complete before parsing. `streamText` is incompatible with structured JSON output.
4. **No GSAP for drawer:** CSS `transition-transform` + Tailwind `translate-x-full/translate-x-0` is sufficient. DashboardEditOverlay's GSAP is for full-screen opacity — different use case.
5. **Stale closure in SSE handler:** Pass `dashboardContextRef.current` (from `useRef`) into the POST body at call time, not captured at definition time.
6. **insights enabled guard:** `enabled: !!sport && !!chartData` — both must be truthy to avoid 400 on initial mount.

---

## Metadata

**Analog search scope:** `backend/api/src/coach/`, `apps/web/src/components/coach/dashboard/`, `apps/web/src/app/[locale]/(coach)/`, `supabase/migrations/`
**Files scanned:** 10 source files read directly
**Pattern extraction date:** 2026-05-28
