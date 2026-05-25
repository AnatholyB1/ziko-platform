# Phase 29: AI Coach Orchestrator — Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 14
**Analogs found:** 14 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/api/src/coach/ai/service.ts` | service/router | streaming + request-response | `backend/api/src/routes/ai.ts` | exact |
| `backend/api/src/coach/ai/tools.ts` | registry/config | request-response | `backend/api/src/tools/registry.ts` | exact |
| `backend/api/src/coach/ai/db.ts` | data-access | CRUD | `backend/api/src/coach/clients/db.ts` | exact |
| `backend/api/src/coach/ai/types.ts` | types | — | `backend/api/src/coach/clients/db.ts` (types import block) | role-match |
| `backend/api/src/coach/ai/context.ts` | context-builder | CRUD | `backend/api/src/context/user.ts` | exact |
| `supabase/migrations/050_coach_ai_schema.sql` | migration | batch | `supabase/migrations/036_workout_programs_ai_imports.sql` | role-match |
| `apps/web/src/app/[locale]/(coach)/coach/ai/page.tsx` | server-component | request-response | `apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx` | exact |
| `apps/web/src/app/[locale]/(coach)/coach/ai/AIChatClient.tsx` | client-component | streaming | `backend/api/src/routes/ai.ts` (SSE format doc) | partial |
| `apps/web/src/components/coach/AlertsPanel.tsx` | client-component | CRUD | `apps/web/src/components/coach/CoachSidebar.tsx` | role-match |
| `apps/web/src/components/coach/CoachSidebar.tsx` | client-component | request-response | self (update) | self |
| `apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx` | server-component | request-response | self (update) | self |
| `apps/web/src/app/[locale]/(coach)/coach/programs/ProgramsClient.tsx` | client-component | request-response | self (update) | self |
| `backend/api/vercel.json` | config | — | self (update) | self |
| `backend/api/src/config/credits.ts` | config | — | self (update) | self |

---

## Pattern Assignments

### `backend/api/src/coach/ai/service.ts` (service/router, streaming + request-response)

**Analog:** `backend/api/src/routes/ai.ts`

**Imports pattern** (lines 1-15):
```typescript
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { generateText, streamText, tool, jsonSchema, stepCountIs } from 'ai';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from '../../middleware/auth.js';
import { fetchCoachContext } from './context.js';
import { coachToolSchemas, getCoachToolExecutor } from './tools.js';
import {
  getOrCreateConversation,
  appendMessages,
  updateConversationTitle,
} from '../../context/conversation.js';
import { AGENT_MODEL, VISION_MODEL } from '../../config/models.js';
import { creditCheck, creditDeduct } from '../../middleware/creditGate.js';
```

Note: `getOrCreateConversation` / `appendMessages` / `updateConversationTitle` are reused directly from `../../context/conversation.js` — no new conversation infrastructure.

**Router + auth pattern** (lines 16-18):
```typescript
const router = new Hono();
router.use('*', authMiddleware);
```
Coach JWT is extracted identically: `c.req.header('Authorization')!.slice(7)` — RLS `is_coach_of` fires automatically via the per-request JWT client.

**Service client for token logging** (lines 20-25):
```typescript
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
```

**System prompt builder pattern** (lines 55-89):
```typescript
const COACH_BASE_SYSTEM = `You are Ziko IA Coach, an expert AI assistant for fitness coaches.
// ... (role, behaviour, tool-call rules in same style as BASE_SYSTEM)
`;

function buildCoachSystemPrompt(coachCtx: CoachContext): string {
  const sections: string[] = [COACH_BASE_SYSTEM];
  sections.push(`## Linked Clients\n${coachCtx.clients.map(c => `- ${c.name} (id: ${c.id})`).join('\n')}`);
  return sections.join('\n\n');
}
```

**buildSDKTools factory pattern** (lines 93-115):
```typescript
function buildCoachSDKTools(coachId: string, jwt: string) {
  return Object.fromEntries(
    coachToolSchemas.map((s) => [
      s.name,
      tool({
        description: s.description,
        inputSchema: jsonSchema<Record<string, unknown>>(s.parameters as any),
        execute: async (input) => {
          const executor = getCoachToolExecutor(s.name);
          if (!executor) throw new Error(`No executor for ${s.name}`);
          try {
            return await executor(input as Record<string, unknown>, coachId, jwt);
          } catch (execErr) {
            const msg = execErr instanceof Error ? execErr.message : String(execErr);
            console.error(`[CoachTool Error] ${s.name}: ${msg}`);
            throw execErr;
          }
        },
      }),
    ]),
  );
}
```

**logTokenUsage pattern** (lines 120-135):
```typescript
function logTokenUsage(
  userId: string,
  modelId: string,
  totalUsage: { inputTokens: number | undefined; outputTokens: number | undefined }
) {
  Promise.resolve(
    supabase.from('ai_cost_log').insert({
      user_id: userId,
      model: modelId,
      input_tokens: totalUsage.inputTokens ?? 0,
      output_tokens: totalUsage.outputTokens ?? 0,
    })
  ).catch((err: unknown) => console.error('[TokenLog] insert failed:', err));
}
```

**SSE streaming route pattern** (lines 162-258 of `routes/ai.ts`):
```typescript
router.post('/chat/stream', creditCheck('coach_chat'), creditDeduct('coach_chat'), async (c) => {
  const { messages = [], conversation_id: bodyConversationId } = await c.req.json<{ ... }>();
  const auth = c.get('auth');
  const coachId = auth.userId;
  const jwt = c.req.header('Authorization')?.slice(7);
  const conversation_id = bodyConversationId ?? c.req.header('X-Conversation-Id') ?? undefined;

  const [coachCtx, convo] = await Promise.all([
    fetchCoachContext(coachId, jwt),
    getOrCreateConversation(coachId, conversation_id, jwt),  // plugin_context = {context:'coach'}
  ]);

  const systemPrompt = buildCoachSystemPrompt(coachCtx);
  const allMessages = [
    ...convo.history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ...messages,
  ];

  const result = streamText({
    model: AGENT_MODEL,
    system: systemPrompt,
    messages: allMessages,
    tools: buildCoachSDKTools(coachId, jwt!),
    stopWhen: stepCountIs(5),
    onFinish: ({ totalUsage }) => {
      logTokenUsage(coachId, 'claude-sonnet-4-20250514', totalUsage);
    },
  });

  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  return stream(c, async (s) => {
    const chunks: string[] = [];
    try {
      await s.write(`data: ${JSON.stringify({ type: 'meta', conversation_id: convo.conversationId })}\n\n`);
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          const text = (part as any).textDelta ?? '';
          if (text && !text.includes('<invoke')) {
            chunks.push(text);
            await s.write(`data: ${JSON.stringify({ type: 'chunk', content: text })}\n\n`);
          }
        }
      }
      await s.write('data: [DONE]\n\n');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Stream error';
      await s.write(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`);
      await s.write('data: [DONE]\n\n');
    }
    // Persist messages after stream
    appendMessages(convo.conversationId, toSave, jwt);
  });
});
```

**Cron route pattern** (from `backend/api/src/routes/storage.ts` lines 131-161):
```typescript
// POST /coach/ai/monitor-cron — Vercel cron, CRON_SECRET auth (no user JWT)
router.post('/monitor-cron', async (c) => {
  const authHeader = c.req.header('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  try {
    // ... alert detection loop over coach_profiles
    return c.json({ success: true, coaches_processed: N, alerts_written: M });
  } catch (err: any) {
    console.error('[MonitorCron] error:', err);
    return c.json({ error: err.message }, 500);
  }
});
```

**Export pattern** (line 501 of `routes/ai.ts`):
```typescript
export { router as coachAiRouter };
```

---

### `backend/api/src/coach/ai/tools.ts` (registry, request-response)

**Analog:** `backend/api/src/tools/registry.ts`

**Imports + type definitions** (lines 1-37):
```typescript
// No imports from athlete registry — coach tools are isolated
export interface AIToolParameter {
  type: 'string' | 'number' | 'integer' | 'boolean';
  description?: string;
  enum?: string[];
}

export interface AITool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, AIToolParameter>;
    required?: string[];
  };
}

export interface ToolExecutor {
  schema: AITool;
  execute: (params: Record<string, unknown>, coachId: string, jwt: string) => Promise<unknown>;
}
```

**Tool schema array + executors map pattern** (lines 40-595):
```typescript
export const coachToolSchemas: AITool[] = [
  {
    name: 'analyze_client',
    description: 'Analyze a linked client\'s training data over a given period.',
    parameters: {
      type: 'object',
      properties: {
        client_id: { type: 'string', description: 'UUID of the linked client' },
        period_days: { type: 'integer', description: 'Look-back period in days (7, 14, 30, 90)' },
      },
      required: ['client_id'],
    },
  },
  {
    name: 'generate_coaching_program',
    description: 'Generate a workout program template for a linked client.',
    parameters: {
      type: 'object',
      properties: {
        client_id: { type: 'string', description: 'UUID of the linked client' },
        goal: { type: 'string', enum: ['muscle_gain', 'fat_loss', 'strength', 'endurance', 'general_fitness'] },
        days_per_week: { type: 'integer', description: '2-6' },
        split_type: { type: 'string', enum: ['full_body', 'upper_lower', 'ppl', 'bro_split', 'custom'] },
        experience_level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
        equipment: { type: 'string', enum: ['full_gym', 'home', 'bodyweight', 'dumbbells_only'] },
        duration_weeks: { type: 'integer', description: 'Program length in weeks (4, 8, 12)' },
      },
      required: ['client_id', 'goal', 'days_per_week'],
    },
  },
  {
    name: 'monitor_client_alerts',
    description: 'Run rule-based SQL alert detection across all linked clients and return structured alerts.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

const executors: Record<string, ToolExecutor['execute']> = {
  analyze_client: analyzeClientExecutor,
  generate_coaching_program: generateCoachingProgramExecutor,
  monitor_client_alerts: monitorClientAlertsExecutor,
};

export function getCoachToolExecutor(name: string): ToolExecutor['execute'] | undefined {
  return executors[name];
}
```

---

### `backend/api/src/coach/ai/db.ts` (data-access, CRUD)

**Analog:** `backend/api/src/coach/clients/db.ts`

**`createUserClient` factory pattern** (lines 26-35 of `clients/db.ts`):
```typescript
export function createUserClient(jwt: string) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    },
  );
}
```
This is the per-request JWT client that fires `is_coach_of` RLS automatically — all coach AI DB reads must use this pattern, never the service client.

**Service client pattern** (lines 19-24 of `clients/db.ts`):
```typescript
function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(process.env.SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```
Service client used only for `ai_tool_audit` inserts (coach-side server writes) and the monitor-cron loop (no user JWT available).

**Typed async DB function pattern** (lines 53-74 of `clients/db.ts`):
```typescript
export async function getCoachAlerts(jwt: string, coachId: string): Promise<CoachAlert[]> {
  const db = createUserClient(jwt);
  const { data, error } = await db
    .from('coach_alerts')
    .select('id, client_id, alert_type, severity, summary, is_read, created_at')
    .eq('coach_id', coachId)
    .eq('is_read', false)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CoachAlert[];
}
```

---

### `backend/api/src/coach/ai/types.ts` (types)

**Analog:** `backend/api/src/coach/clients/db.ts` (types block at top)

The file should declare only interfaces / type aliases — no runtime code.

**Pattern** (mirror the style of `clients/types.ts` if it exists, otherwise inline in db.ts):
```typescript
export interface CoachAlert {
  id: string;
  coach_id: string;
  client_id: string;
  alert_type: 'missed_sessions' | 'sleep_drop' | 'mood_decline' | 'rpe_inflation';
  severity: 'low' | 'medium' | 'high';
  summary: string;
  is_read: boolean;
  created_at: string;
}

export interface AiToolAuditRow {
  id?: string;
  coach_id: string;
  tool_name: string;
  target_client_id: string | null;
  args_hash: string;
  result_status: 'success' | 'error';
  conversation_id: string | null;
}

export interface CoachContext {
  profile: { display_name: string | null } | null;
  clients: Array<{ id: string; name: string }>;
}
```

---

### `backend/api/src/coach/ai/context.ts` (context-builder, CRUD)

**Analog:** `backend/api/src/context/user.ts` — clone and replace athlete queries with coach queries.

**Full file structure pattern** (lines 1-104 of `context/user.ts`):
```typescript
import { clientForUser } from '../tools/db.js';
// OR: use createUserClient from ./db.js (same pattern, different import path)

export interface CoachContext {
  profile: { display_name: string | null } | null;
  clients: Array<{ id: string; name: string }>;
}

export async function fetchCoachContext(coachId: string, jwt?: string): Promise<CoachContext> {
  const db = clientForUser(jwt);  // per-request JWT — RLS auto-applies is_coach_of

  const [profileRes, clientsRes] = await Promise.all([
    db.from('coach_profiles')
      .select('display_name')
      .eq('user_id', coachId)
      .single(),
    db.from('coach_client_links')
      .select('client_id, user_profiles!inner(name)')
      .eq('coach_id', coachId)
      .is('revoked_at', null),
  ]);

  return {
    profile: profileRes.data ? { display_name: profileRes.data.display_name } : null,
    clients: (clientsRes.data ?? []).map((row: any) => ({
      id: row.client_id,
      name: row.user_profiles?.name ?? 'Client inconnu',
    })),
  };
}
```

Key difference from `fetchUserContext`: replaces athlete-specific tables (`user_profiles`, `user_plugins`, `workout_sessions`, `nutrition_logs`, `habits`) with coach tables (`coach_profiles`, `coach_client_links`). The `Promise.all` parallel-fetch structure is identical.

---

### `supabase/migrations/050_coach_ai_schema.sql` (migration, batch)

**Analog:** `supabase/migrations/036_workout_programs_ai_imports.sql` (table creation + RLS pattern)

**Lock timeout guard pattern** (line 1 of `036_...sql`):
```sql
SET LOCAL lock_timeout = '5s';
```

**Table creation pattern** (lines 47-80 of `036_...sql`):
```sql
CREATE TABLE IF NOT EXISTS public.coach_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type      TEXT NOT NULL CHECK (alert_type IN ('missed_sessions','sleep_drop','mood_decline','rpe_inflation')),
  severity        TEXT NOT NULL CHECK (severity IN ('low','medium','high')),
  summary         TEXT NOT NULL,
  is_read         BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_tool_audit (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_name         TEXT NOT NULL,
  target_client_id  UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  args_hash         TEXT NOT NULL,
  result_status     TEXT NOT NULL CHECK (result_status IN ('success','error')),
  conversation_id   UUID NULL REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**RLS pattern** (from `CLAUDE.md` §Database):
```sql
ALTER TABLE public.coach_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach_alerts_own" ON public.coach_alerts
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

ALTER TABLE public.ai_tool_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_tool_audit_own" ON public.ai_tool_audit
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);
```

**Index pattern** (lines 32-43 of `036_...sql`):
```sql
CREATE INDEX IF NOT EXISTS idx_coach_alerts_coach_id
  ON public.coach_alerts(coach_id)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_ai_tool_audit_coach_id
  ON public.ai_tool_audit(coach_id, created_at DESC);
```

---

### `apps/web/src/app/[locale]/(coach)/coach/ai/page.tsx` (server-component, request-response)

**Analog:** `apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx` — exact clone pattern.

**Full pattern** (lines 1-28 of `dashboard/page.tsx`):
```typescript
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { AIChatClient } from './AIChatClient';

export default async function AIPage() {
  const supabase = await createServerSupabase();
  const [{ data: { user } }, locale] = await Promise.all([supabase.auth.getUser(), getLocale()]);
  if (!user) redirect(`/${locale}/login`);

  // Fetch last conversation_id for current session (optional, D-06)
  const { data: lastConvo } = await supabase
    .from('ai_conversations')
    .select('id')
    .eq('user_id', user.id)
    .contains('plugin_context', { context: 'coach' })
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token ?? '';

  return (
    <AIChatClient
      accessToken={accessToken}
      apiUrl={process.env.NEXT_PUBLIC_API_URL ?? ''}
      initialConversationId={lastConvo?.id ?? null}
    />
  );
}
```

Critical: `force-dynamic` + `revalidate=0` is mandatory per Phase 23 D-15 decision. All server components in `(coach)/` must include these two lines at the top.

---

### `apps/web/src/app/[locale]/(coach)/coach/ai/AIChatClient.tsx` (client-component, streaming)

**Analog:** SSE streaming format from `backend/api/src/routes/ai.ts` lines 211-258. No existing web SSE client to copy directly — implement from scratch following the documented wire format.

**SSE wire format** (lines 216-244 of `routes/ai.ts`):
```
data: {"type":"meta","conversation_id":"uuid"}\n\n
data: {"type":"chunk","content":"text fragment"}\n\n
data: {"type":"error","error":"message"}\n\n
data: [DONE]\n\n
```

**Client-side SSE reader pattern** (to implement in AIChatClient):
```typescript
'use client';
// Standard ReadableStream reader pattern for SSE
async function streamChat(accessToken: string, apiUrl: string, messages: Message[], conversationId: string | null) {
  const res = await fetch(`${apiUrl}/coach/ai/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ messages, conversation_id: conversationId }),
  });

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6);
      if (payload === '[DONE]') return;
      const event = JSON.parse(payload);
      // handle event.type: 'meta' | 'chunk' | 'error'
    }
  }
}
```

**Component structure** (from UI-SPEC.md):
- `'use client'` directive required
- State: `messages`, `isStreaming`, `inputValue`, `conversationId`, `error`
- Props: `accessToken: string`, `apiUrl: string`, `initialConversationId: string | null`
- Reads `?template` and `?client` from `useSearchParams()` for deep-link prefill
- Deep-link auto-send: `useEffect` with 500ms delay after mount

---

### `apps/web/src/components/coach/AlertsPanel.tsx` (client-component, CRUD)

**Analog:** `apps/web/src/components/coach/CoachSidebar.tsx` — follows the same `'use client'` pattern with `react-icons/io5` icons and inline Tailwind.

**Component file structure pattern** (lines 1-36 of `CoachSidebar.tsx`):
```typescript
'use client';
import { IoShieldCheckmarkOutline, IoAlertCircleOutline } from 'react-icons/io5';

interface AlertsPanelProps {
  accessToken: string;
  apiUrl: string;
  unreadCount: number;
}

export function AlertsPanel({ accessToken, apiUrl, unreadCount }: AlertsPanelProps) {
  // useState for alerts array, loading, expanded state
  // useEffect to fetch from /coach/ai/alerts on mount
  // dismiss handler: PATCH /coach/ai/alerts/:id/read
  // dismiss-all handler: POST /coach/ai/alerts/read-all
}
```

**Icon usage pattern** (lines 1-10 of `CoachSidebar.tsx`):
```typescript
import {
  IoShieldCheckmarkOutline,  // no-alerts state
  IoAlertCircleOutline,      // error / high severity
  IoSparklesOutline,         // panel header
} from 'react-icons/io5';
```

**Design token usage** (from UI-SPEC.md §AlertsPanel):
- Panel card: `className="bg-white rounded-2xl p-6 border border-border shadow-sm"`
- Severity dot colors: `#EF4444` high / `#F59E0B` medium / `#EAB308` low
- Client name: `className="text-sm font-semibold text-text"`
- Alert link: `className="text-sm text-primary font-semibold"`

---

### `apps/web/src/components/coach/CoachSidebar.tsx` (update)

**Current file:** `apps/web/src/components/coach/CoachSidebar.tsx` (all 37 lines — full file already read)

**Change: enable "IA" nav item + add alert badge prop**

Current line 19 to change:
```typescript
// FROM:
{ label: 'IA', href: '/fr/coach/ai', icon: IoSparklesOutline, disabled: true },

// TO:
{ label: 'IA', href: '/fr/coach/ai', icon: IoSparklesOutline, disabled: false, alertCount: unreadAlertCount },
```

`CoachSidebar` needs to accept `unreadAlertCount?: number` prop (passed from the layout server component which fetches unread count). The `NavItem` component receives the badge value and renders the orange bubble per UI-SPEC.md §CoachSidebar Update.

---

### `apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx` (update)

**Current pattern** (lines 1-28 — full file already read):

Add `AlertsPanel` import and render below `<WelcomeCard>`:
```typescript
// Add import:
import { AlertsPanel } from '@/components/coach/AlertsPanel';

// Add to JSX (after WelcomeCard, inside the gap-8 flex col):
<AlertsPanel
  accessToken={session?.access_token ?? ''}
  apiUrl={process.env.NEXT_PUBLIC_API_URL ?? ''}
  unreadCount={unreadAlertCount}
/>
```

Server component fetches `unreadAlertCount` from `coach_alerts` table (same Supabase client, `.eq('is_read', false).select('id', { count: 'exact', head: true })`).

---

### `apps/web/src/app/[locale]/(coach)/coach/programs/ProgramsClient.tsx` (update)

**Current pattern** (lines 1-80 — partial read):

**Add `handleAdaptWithAI` handler** alongside existing `handleEdit`, `handleDuplicate`, `handleAssign`:
```typescript
function handleAdaptWithAI(programId: string, programName: string) {
  router.push(`/${locale}/coach/ai?template=${programId}`);
}
```

**Add "Adapter avec l'IA" button** in the ProgramCard action row, rendered conditionally:
```typescript
// Only for is_template=TRUE programs:
{program.is_template && (
  <button
    onClick={() => handleAdaptWithAI(program.id, program.name)}
    className="flex items-center gap-2 border border-primary text-primary bg-transparent rounded-lg text-sm font-semibold h-10 px-4 py-2 hover:bg-primary/5 transition-colors"
  >
    <IoSparklesOutline size={16} />
    Adapter avec l'IA
  </button>
)}
```
Add `IoSparklesOutline` to the existing `react-icons/io5` import at line 5.

---

### `backend/api/vercel.json` (config update)

**Current file** (all 18 lines — already read):

**Add cron entry** to the existing `"crons"` array:
```json
{
  "path": "/coach/ai/monitor-cron",
  "schedule": "0 7 * * *"
}
```
Result: 3 cron entries total (`/supplements/cron/scrape`, `/storage/cron/cleanup`, `/coach/ai/monitor-cron`).

---

### `backend/api/src/config/credits.ts` (config update)

**Current file** (all 39 lines — already read):

**Add coach tool cost block** after the existing `CREDIT_COSTS` constant:
```typescript
// Per UI-SPEC.md §Credit Cost Classes
export const COACH_TOOL_COSTS = {
  analyze_client: 2,
  generate_coaching_program: 3,
  monitor_client_alerts: 1,
} as const;

export type CoachToolName = keyof typeof COACH_TOOL_COSTS;
```

**Add coach chat to `CREDIT_COSTS`** (needed for `creditCheck`/`creditDeduct` on `/coach/ai/chat/stream`):
```typescript
export const CREDIT_COSTS = {
  chat: 4,
  scan: 3,
  program: 4,
  import: 0,
  coach_chat: 4,  // ADD — same cost as athlete chat
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;
```

---

## Shared Patterns

### Authentication — Per-Request JWT (applies to ALL coach/ai backend files)

**Source:** `backend/api/src/coach/clients/db.ts` lines 26-35 + `backend/api/src/coach/clients/service.ts` lines 57-65

```typescript
// In every route handler:
const jwt = c.req.header('Authorization')!.slice(7);
// Then pass jwt into db.ts functions which call createUserClient(jwt)
// This fires is_coach_of() RLS automatically — never use service client for coach reads
```

**Critical constraint (Phase 22 D-RLS, Phase 23 D-11):** All coach reads use per-request JWT. Never use service role for `coach_client_links`, `coach_alerts`, or `ai_tool_audit` reads. Only use service client for cron operations (monitor-cron) and `ai_cost_log` inserts.

### Credit Gate Middleware (applies to coach chat stream route)

**Source:** `backend/api/src/middleware/creditGate.ts` lines 49-113

```typescript
router.post('/chat/stream', creditCheck('coach_chat'), creditDeduct('coach_chat'), async (c) => {
  // creditCheck runs BEFORE handler — returns 402 if balance < CREDIT_COSTS['coach_chat']
  // creditDeduct runs AFTER handler — fire-and-forget deduction on HTTP 200
```

### Error Response Pattern (applies to all route handlers in service.ts)

**Source:** `backend/api/src/coach/clients/service.ts` lines 56-65

```typescript
try {
  const result = await someDbFn(jwt, userId);
  return c.json(result);
} catch (err: any) {
  console.error('[coach/ai] route error:', err.message);
  return c.json({ error: err.message }, 500);
}
```

### force-dynamic Guard (applies to all Next.js server components in `(coach)/`)

**Source:** `apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx` lines 1-2

```typescript
export const dynamic = 'force-dynamic';
export const revalidate = 0;
```
Both lines mandatory on every coach route page per Phase 23 D-15.

### Server Supabase Client (applies to all Next.js server components)

**Source:** `apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx` lines 6, 10-11

```typescript
import { createServerSupabase } from '@/lib/supabase/server';
// In page:
const supabase = await createServerSupabase();
const [{ data: { user } }, locale] = await Promise.all([supabase.auth.getUser(), getLocale()]);
if (!user) redirect(`/${locale}/login`);
```

### SSE Wire Format (applies to AIChatClient.tsx)

**Source:** `backend/api/src/routes/ai.ts` lines 216-244

```
data: {"type":"meta","conversation_id":"uuid"}\n\n
data: {"type":"chunk","content":"text"}\n\n
data: [DONE]\n\n
```
Client must split on `\n\n`, prefix-match `data: `, and JSON-parse. `[DONE]` is a raw string sentinel (not JSON).

### Icon Library (applies to all web components)

**Source:** `apps/web/src/components/coach/CoachSidebar.tsx` line 1

```typescript
import { IoSparklesOutline, IoSendOutline, IoFlashOutline, ... } from 'react-icons/io5';
```
All icons are Ionicons 5 via `react-icons/io5`. Never use `@expo/vector-icons` on web.

---

## No Analog Found

No files in this phase lack an analog. All 14 files have either an exact or role-match analog.

---

## Metadata

**Analog search scope:** `backend/api/src/`, `apps/web/src/`, `supabase/migrations/`
**Key files scanned:** 12 source files read in full
**Pattern extraction date:** 2026-05-22
