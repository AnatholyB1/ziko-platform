# Phase 44: Weekly Adaptive Decision Engine - Pattern Map

**Mapped:** 2026-09-02
**Files analyzed:** 14 (10 new, 4 modified)
**Analogs found:** 14 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `backend/api/src/coaching-engine/decide.ts` (NEW) | service (AI decision) | request-response (single-shot `generateObject`) | `backend/api/src/tools/onboarding-retroactive.ts` (schema + sanitizer + `generateObject` call) | exact |
| `backend/api/src/coaching-engine/context.ts` (NEW) | service (aggregation) | CRUD (read-only aggregation) | `backend/api/src/tools/onboarding-retroactive.ts`'s `fetchActivityAggregates()` | exact |
| `backend/api/src/coaching-engine/apply.ts` (NEW) | service (shared write path) | CRUD (RPC write) | `backend/api/src/tools/onboarding-retroactive.ts`'s `computeRetroactiveProfile()` write section | exact |
| `backend/api/src/coaching-engine/tools.ts` (NEW) | service/tool-executor | request-response + RPC write | `backend/api/src/tools/onboarding.ts`'s `assess_profile` executor (per 43-PATTERNS.md) | exact |
| `backend/api/src/coaching-engine/routes.ts` (NEW) | route/controller | request-response + event-driven (fire-and-forget) | `backend/api/src/coach/ai/service.ts`'s `monitor-cron` route (CRON_SECRET guard) + `backend/api/src/routes/push-events.ts` (`waitUntil()` usage) | exact (composite) |
| `backend/api/src/coaching-engine/db.ts` (NEW) | service (client factory + queries) | CRUD | `backend/api/src/tools/db.ts` (`clientForUser`) | exact |
| `backend/api/src/coaching-engine/types.ts` (NEW) | types | — | `backend/api/src/coach/ai/types.ts` (`CoachContext`/`DashboardContext` shape) | role-match |
| `backend/api/src/tools/registry.ts` (MODIFIED — register `create_goal`/`create_program`) | config/registry | CRUD (schema registration) | same file, `assess_profile` registration (lines 176-183) + `allToolSchemas` assembly (lines 583-598) | exact |
| `backend/api/src/app.ts` (MODIFIED — mount `coaching-engine` router) | app wiring | — | same file, `app.route('/coach/ai', coachAiRouter)` (line 84) | exact |
| `backend/api/vercel.json` (MODIFIED — add safety-net cron entry) | config | — | same file, `weekly-digest` cron entry (`0 9 * * 0`) | exact |
| `supabase/migrations/<ts>_athlete_goals.sql` (NEW) | migration | CRUD (new table) | `supabase/migrations/20260831120000_athlete_state.sql` (compact-row RLS/REVOKE shape) | exact |
| `supabase/migrations/<ts>_record_athlete_decision_v2.sql` (NEW) | migration | CRUD (RPC extension) | `supabase/migrations/20260831120200_athlete_decisions_rpc.sql` (full RPC body, `CREATE OR REPLACE`) | exact |
| `supabase/migrations/<ts>_ai_cost_log_source.sql` (NEW) | migration | CRUD (additive column) | `supabase/migrations/027_ai_cost_log.sql` (table this alters) | exact |
| `apps/mobile/app/(app)/_layout.tsx` (MODIFIED — add `useCoachingEngineBootstrap()` + mount reveal overlay) | provider/bootstrap hook | request-response (poll) + event-driven (Modal mount) | same file, `useBrandingBootstrap()` (lines 59-90) + `<PendingFormsOverlay />` mount (line 257) | exact |
| `apps/mobile/src/components/WeeklyReviewRevealOverlay.tsx` (NEW) | component | request-response (poll) + event-driven (Modal) | `apps/mobile/src/components/PendingFormsOverlay.tsx` (full file — Modal mount pattern) + `apps/mobile/app/(auth)/onboarding/ziko-chat.tsx`'s `CelebrationOverlay` (lines 263-343 — dark celebration visual treatment) | exact (composite) |

## Pattern Assignments

### `backend/api/src/coaching-engine/decide.ts` (service, single-shot `generateObject`)

**Analog:** `backend/api/src/tools/onboarding-retroactive.ts` (full file, 314 lines — read this session)

**Imports pattern** (lines 1-6):
```typescript
import { generateObject, jsonSchema } from 'ai';
import { zodSchema } from '@ai-sdk/provider-utils';
import { z } from 'zod';
import { clientForUser } from './db.js';
import { AGENT_MODEL } from '../config/models.js';
```

**Anthropic schema sanitizer — copy verbatim** (lines 28-54, load-bearing, do not re-derive):
```typescript
const ANTHROPIC_BANNED_KEYWORDS = new Set([
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum',
  'minLength', 'maxLength', 'minItems', 'maxItems',
  'multipleOf', '$schema', 'format',
]);

function stripUnsupportedKeywords(node: unknown): unknown {
  if (typeof node !== 'object' || node === null) return node;
  if (Array.isArray(node)) return node.map(stripUnsupportedKeywords);
  return Object.fromEntries(
    Object.entries(node as Record<string, unknown>)
      .filter(([key]) => !ANTHROPIC_BANNED_KEYWORDS.has(key))
      .map(([key, value]) => [key, stripUnsupportedKeywords(value)]),
  );
}

function anthropicSchema<T>(zodType: z.ZodTypeAny) {
  const raw = zodSchema(zodType).jsonSchema;
  return jsonSchema<T>(stripUnsupportedKeywords(raw) as any);
}
```
Any `z.number().int()` field in the weekly-decision schema MUST route through `anthropicSchema()` — passing a raw Zod schema straight to `generateObject({ schema: ... })` fails intermittently at the Anthropic API boundary (confirmed live gotcha, not in prior project-root research).

**Core `generateObject` call pattern** (lines 61-77, 252-267 — adapt directly):
```typescript
const WeeklyDecisionZod = z.object({
  trajectory: z.enum(['escalate', 'hold', 'de-escalate']),
  new_readiness: z.enum(['fragile', 'building', 'ready']),
  rationale: z.string(),
  call_create_program: z.boolean(), // D-11: only true on escalate/de-escalate
});
const WEEKLY_DECISION_SCHEMA = anthropicSchema<z.infer<typeof WeeklyDecisionZod>>(WeeklyDecisionZod);

const { object } = await generateObject({
  model: AGENT_MODEL,
  schema: WEEKLY_DECISION_SCHEMA,
  system: WEEKLY_REVIEW_SYSTEM_PROMPT,
  prompt: buildWeeklyReviewPrompt(context), // fetchWeeklyReviewContext() output — never raw messages
});
```
System-prompt discipline to copy (lines 75-77): explicitly instruct the model that zero/sparse activity is real evidence, never a gap to guess around — same grounding-discipline language, adapted for weekly trajectory instead of onboarding profile.

**Error handling:** no try/catch inside this module — `generateObject` throwing propagates to the caller (`apply.ts` / route handler), matching `onboarding-retroactive.ts`'s convention of letting RPC/model errors bubble rather than swallowing them locally.

---

### `backend/api/src/coaching-engine/context.ts` (service, real-activity aggregation)

**Analog:** `backend/api/src/tools/onboarding-retroactive.ts`'s `fetchActivityAggregates()` (lines 89-188)

**Core aggregation pattern** (lines 110-130, adapt to be focus-type-scoped per D-08):
```typescript
export async function fetchWeeklyReviewContext(userId: string, userToken?: string) {
  const db = clientForUser(userToken);

  // 1. athlete_state — captures next_review_due_at BEFORE any model call (Pitfall 1/ENGINE-04)
  const { data: state } = await db
    .from('athlete_state')
    .select('next_review_due_at, current_focus_detail, readiness, rolling_summary')
    .eq('user_id', userId)
    .single();

  // 2. bounded recent-window read (FOUND-05 convention, ~4 rows)
  const { data: recentDecisions } = await db
    .from('athlete_decisions')
    .select('decision_type, week_of, summary, outcome, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(4);

  // 3. ONLY the table(s) current_focus_detail.focus_type maps to (D-08) —
  //    mirror fetchActivityAggregates()'s Promise.all parallel-read shape,
  //    but select the query set conditionally on focus_type, never all tables.
  const focusType = (state?.current_focus_detail as any)?.focus_type;
  const activityData = await fetchFocusScopedActivity(db, userId, focusType);

  return { state, recentDecisions, activityData };
}
```
Never fetch every activity table unconditionally — the anti-pattern this file must avoid is `context/user.ts`'s "fetch everything" shape (RESEARCH.md's "Don't Hand-Roll" table explicitly separates this concern into its own context builder).

**Aggregation reduction pattern** (lines 138-187 — same "aggregate counts, never raw rows" convention): reduce raw query results to plain counts/sums before handing to `decide.ts`, exactly like `workout_sessions_90d`/`total_volume_kg_90d` are computed from raw `workouts` array.

---

### `backend/api/src/coaching-engine/apply.ts` (service, shared deterministic write path)

**Analog:** `backend/api/src/tools/onboarding-retroactive.ts`'s `computeRetroactiveProfile()` (lines 206-313, especially the RPC-write section 259-312)

**Core write pattern — capture `week_of` before the model call, never `CURRENT_DATE` at fire time** (ENGINE-04, Pitfall 1 from RESEARCH.md; pattern derived from `supabase/migrations/20260831120200_athlete_decisions_rpc.sql`):
```typescript
export async function applyWeeklyDecision(
  userId: string,
  decision: WeeklyDecisionResult,
  context: WeeklyReviewContext,
  weekOf: string, // captured from state.next_review_due_at BEFORE generateObject(), never Date.now()
  source: 'weekly_review_cron' | 'app_open_fallback',
  userToken?: string,
) {
  const db = clientForUser(userToken);

  const { data, error } = await db.rpc('record_athlete_decision', {
    p_user_id: userId,
    p_decision_type: 'weekly_focus',
    p_week_of: weekOf,
    p_summary: decision.rationale,
    p_rationale: decision.rationale,
    p_evidence: { ...context.activityData, evidence_source: 'real_activity_history' }, // never the model's own echo (Pitfall in Security Domain table)
    p_outcome: { trajectory: decision.trajectory, new_readiness: decision.new_readiness },
    p_source: source,
    p_state_patch: { readiness: decision.new_readiness }, // readiness ONLY — see Open Question 1, do not touch level/points/tier
  });

  if (error) throw new Error(`record_athlete_decision failed: ${error.message}`);
  const result = data as { success?: boolean; error?: string; decision_id?: string } | null;
  if (result?.success !== true) return { success: false as const, error: result?.error ?? 'unknown_rpc_failure' };

  // D-11: only call create_program on escalate/de-escalate, never on hold
  if (decision.call_create_program && decision.trajectory !== 'hold') {
    await createProgramExecutor({ /* structured training targets */ }, userId, userToken);
  }

  // ENGINE-05: independent ai_cost_log accounting, source column distinguishes opex from user-chat cost
  await db.from('ai_cost_log').insert({ user_id: userId, model: 'claude-sonnet-4-20250514', source, input_tokens: 0, output_tokens: 0 });

  return { success: true as const, decision_id: result.decision_id! };
}
```
**Never substitute a generic/defaulted evidence object when aggregates are empty** — same discipline as `onboarding-retroactive.ts` line 269-273's comment.

---

### `backend/api/src/coaching-engine/tools.ts` (`create_goal`/`create_program` executors — service/tool-executor)

**Analog:** `backend/api/src/tools/onboarding.ts`'s `assess_profile` executor (per `43-PATTERNS.md` lines 90-141, RESEARCH.md's own worked example lines 402-435)

**Imports pattern:**
```typescript
import { clientForUser } from './db.js';
```

**`create_goal` executor pattern** (RESEARCH.md Code Examples, lines 408-435 — direct template):
```typescript
export async function create_goal(
  params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const db = clientForUser(userToken);
  const { data, error } = await db.rpc('record_athlete_decision', {
    p_user_id: userId,
    p_decision_type: 'goal_created',
    p_week_of: null,
    p_summary: params.goal_text,
    // p_rationale has NO database default — an undefined value is dropped by supabase-js and
    // PostgREST can then no longer resolve the 10-arg signature (42883). Always send a fallback.
    p_rationale: params.rationale ?? 'Goal created from athlete conversation.',
    p_evidence: params.evidence, // mandatory grounding, FOUND-02
    p_outcome: { goal_text: params.goal_text, target_date: params.target_date },
    p_source: params.source ?? 'onboarding_tool',
    p_state_patch: { current_focus_detail: { goal_id: '$NEW_GOAL_ID' } }, // RPC fills the real id post-extension
    p_new_goal: {
      goal_text: params.goal_text,
      target_metric: params.target_metric,
      target_value: params.target_value,
      target_date: params.target_date,
      status: 'active',
    },
  });
  if (error) throw new Error(`record_athlete_decision failed: ${error.message}`);
  return data;
}
```
**Security note (must copy):** always resolve the target athlete from the authenticated caller's `userId` parameter, never from a field the LLM's structured output supplies — Known Threat Patterns table in RESEARCH.md flags a model-supplied `user_id` as a Tampering/Elevation-of-Privilege vector.

**`create_program` executor** — writes `athlete_state.current_focus_detail` training targets only, via the same `record_athlete_decision()` RPC with `p_decision_type: 'program_created'`, `p_state_patch: { current_focus_detail: { ...trainingTargets, goal_id } }`. Never calls `/ai/programs/generate` (D-10).

---

### `backend/api/src/coaching-engine/routes.ts` (route, request-response + fire-and-forget)

**Analog 1 (CRON_SECRET guard, defined BEFORE authMiddleware):** `backend/api/src/coach/ai/service.ts` lines 207-214

**Analog 2 (`waitUntil()` fire-and-forget):** `backend/api/src/routes/push-events.ts` lines 1-10, 48-56, 95-103

**CRON_SECRET guard pattern** (`coach/ai/service.ts` lines 207-214, copy verbatim shape):
```typescript
router.post('/cron/weekly-review', async (c) => {
  const authHeader = c.req.header('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  // ... bounded-concurrency batch processing, NOT a sequential per-user loop
  // (monitor-cron's loop has zero LLM calls in its body — this cron has one
  // generateObject call per athlete and must batch instead; see Anti-Patterns)
});

// All routes below require athlete JWT
router.use('*', authMiddleware);
```

**`waitUntil()` fire-and-forget pattern** (`push-events.ts` lines 1-3, 48-56 — already used 3x in this backend):
```typescript
import { waitUntil } from '@vercel/functions';

router.get('/review-check', async (c) => {
  const { userId } = c.get('auth');
  const userToken = c.req.header('Authorization')?.slice(7);

  waitUntil(
    (async () => {
      const due = await checkAndFireIfDue(userId, userToken, 'app_open_fallback');
    })(),
  );

  return c.json({ ok: true }); // respond immediately — never block on the review
});
```

**`maxDuration` for the cron route** (matches the only 3 existing precedents in this backend — `coach/voice/service.ts`, `coach/imports/service.ts`, `coach/videos/service.ts`, each `export const maxDuration = 60`):
```typescript
export const maxDuration = 60;
```

---

### `backend/api/src/coaching-engine/db.ts` (service, client factory)

**Analog:** `backend/api/src/tools/db.ts` (full file, 16 lines)
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

export function clientForUser(_userToken?: string) {
  return createClient(supabaseUrl, serviceKey ?? supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```
Re-export this verbatim (or import directly from `tools/db.ts`) — `record_athlete_decision()`'s EXECUTE grant is `service_role`-only, so `SUPABASE_SERVICE_KEY` must genuinely be populated in the deploy environment (same caveat 43-PATTERNS.md already flagged).

---

### `backend/api/src/tools/registry.ts` — register `create_goal`/`create_program` (config/registry, CRUD)

**Analog:** same file — `assess_profile`'s deliberate-exclusion comment (lines 176-183) shows the pattern to deviate FROM; `allToolSchemas` assembly (lines 583-598) shows the pattern to follow instead, since ENGINE-06 requires dual-surface availability.

**Import addition** (top of file, alongside line 15's `OnboardingTools` import):
```typescript
import * as CoachingEngineTools from '../coaching-engine/tools.js';
```

**Executor registration** (alongside line 182's `assess_profile` entry, inside the `executors` map at line 134):
```typescript
create_goal: CoachingEngineTools.create_goal,
create_program: CoachingEngineTools.create_program,
```

**Schema block + `allToolSchemas` inclusion — UNLIKE `assess_profile`, these two ARE spread into `allToolSchemas`** (lines 583-598 pattern):
```typescript
const coachingEngineToolSchemas: AITool[] = [
  {
    name: 'create_goal',
    description: 'Set a broader, multi-week outcome goal for the athlete...',
    parameters: { type: 'object', properties: { /* goal_text, target_metric, target_value, target_date */ }, required: ['goal_text', 'target_date'] },
  },
  {
    name: 'create_program',
    description: "Write this week's concrete structured training targets...",
    parameters: { type: 'object', properties: { /* session_count, session_type, etc. */ }, required: [] },
  },
];

export const allToolSchemas: AITool[] = [
  ...habitsToolSchemas,
  // ...existing entries...
  ...coachToolSchemas,
  ...coachingEngineToolSchemas, // NEW — unlike assess_profile, deliberately included (ENGINE-06)
];
```

---

### `backend/api/src/app.ts` — mount `coaching-engine` router (app wiring)

**Analog:** same file, line 84 (`app.route('/coach/ai', coachAiRouter);`)
```typescript
import { coachingEngineRouter } from './coaching-engine/routes.js';
// ...
app.route('/coaching-engine', coachingEngineRouter);
```

---

### `backend/api/vercel.json` — add Sunday safety-net cron entry (config)

**Analog:** same file, `weekly-digest` entry (lines 31-34)
```json
{
  "path": "/coaching-engine/cron/weekly-review",
  "schedule": "0 10 * * 0"
}
```
Add to the `crons` array (currently 8 entries) — `CRON_SECRET` env var is already provisioned and used identically by all 8 existing entries, no new env var needed.

---

### `supabase/migrations/<ts>_athlete_goals.sql` (NEW table, migration)

**Analog:** `supabase/migrations/20260831120000_athlete_state.sql` (full file, 61 lines — RLS/REVOKE/comment shape) + `20260831213147_athlete_state_revoke_anon.sql` (the `anon` REVOKE this migration must NOT omit, per that file's own explicit warning)

**Pattern to copy:**
```sql
CREATE TABLE public.athlete_goals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_text      TEXT NOT NULL,
  target_metric  TEXT,
  target_value   NUMERIC,
  target_date    DATE,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'abandoned')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.athlete_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "athlete_goals_select_own" ON public.athlete_goals
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE TRIGGER trg_athlete_goals_updated
  BEFORE UPDATE ON public.athlete_goals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Write-lockdown — REVOKE from ALL THREE roles in this SAME migration
-- (the athlete_state gap that 20260831213147 had to fix as a follow-up —
-- do not repeat that omission here).
REVOKE INSERT, UPDATE, DELETE ON public.athlete_goals FROM anon, authenticated, service_role;
```
Only `record_athlete_decision()`'s `SECURITY DEFINER` context can write this table (via the `p_new_goal` extension below) — same "one write door" doctrine as `athlete_state`/`athlete_decisions`.

---

### `supabase/migrations/<ts>_record_athlete_decision_v2.sql` (NEW — RPC extension, migration)

**Analog:** `supabase/migrations/20260831120200_athlete_decisions_rpc.sql` (full file, 162 lines — `CREATE OR REPLACE FUNCTION` body to extend)

**Pattern to copy — extend, don't replace, the existing function shape:**
```sql
CREATE OR REPLACE FUNCTION public.record_athlete_decision(
  p_user_id       UUID,
  p_decision_type TEXT,
  p_week_of       DATE,
  p_summary       TEXT,
  p_rationale     TEXT,
  p_evidence      JSONB,
  p_outcome       JSONB,
  p_source        TEXT,
  p_state_patch   JSONB,
  p_new_goal      JSONB DEFAULT NULL  -- NEW param (D-09/Pattern 4)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_decision_id UUID;
  v_goal_id     UUID;
  v_rows        INTEGER;
BEGIN
  -- (a) same evidence guard as today (lines 46-48) — unchanged

  -- (b) NEW: insert athlete_goals BEFORE the state patch, inside the same
  -- transaction, so current_focus_detail.goal_id can reference the real row
  -- (not a placeholder) atomically.
  IF p_new_goal IS NOT NULL THEN
    INSERT INTO public.athlete_goals (user_id, goal_text, target_metric, target_value, target_date, status)
    VALUES (
      p_user_id,
      p_new_goal->>'goal_text',
      p_new_goal->>'target_metric',
      (p_new_goal->>'target_value')::numeric,
      (p_new_goal->>'target_date')::date,
      COALESCE(p_new_goal->>'status', 'active')
    )
    RETURNING id INTO v_goal_id;
  END IF;

  -- (c) same journal insert/ON CONFLICT as today (lines 54-62) — unchanged

  -- (d) same duplicate-detection early return (lines 64-72) — unchanged

  -- (e) same athlete_state self-heal INSERT (lines 74-80) — unchanged

  -- (f) same UPDATE athlete_state SET ... as today (lines 85-118), PLUS:
  --     next_review_due_at now also stamps on 'onboarding_profile' (Pitfall 4 fix,
  --     literally implements D-02's "rolling from onboarding completion date"):
  --     next_review_due_at = CASE WHEN p_decision_type IN ('weekly_focus', 'onboarding_profile')
  --                           THEN NOW() + INTERVAL '7 days' ELSE next_review_due_at END,

  -- (g) same success return, plus goal_id if created
  RETURN jsonb_build_object('success', true, 'decision_id', v_decision_id, 'goal_id', v_goal_id);
END;
$$;

-- Grants unchanged from the original migration — CREATE OR REPLACE preserves
-- them, but re-assert explicitly for clarity/auditability (same as the
-- original file's own "every role named explicitly" discipline, lines 138-142):
REVOKE EXECUTE ON FUNCTION public.record_athlete_decision(UUID, TEXT, DATE, TEXT, TEXT, JSONB, JSONB, TEXT, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_athlete_decision(UUID, TEXT, DATE, TEXT, TEXT, JSONB, JSONB, TEXT, JSONB, JSONB) TO service_role;
```
**Also extend the `athlete_decisions.decision_type` CHECK constraint** if `program_created`/`goal_created` aren't already covered — confirmed already present in the live enum (`20260831120100_athlete_decisions.sql` line 18: `'program_created', 'goal_created'` already listed), so no change needed there.

---

### `supabase/migrations/<ts>_ai_cost_log_source.sql` (NEW — additive column, migration)

**Analog:** `supabase/migrations/027_ai_cost_log.sql` (full file, 29 lines — the table being altered)
```sql
ALTER TABLE public.ai_cost_log
  ADD COLUMN source TEXT NOT NULL DEFAULT 'user_chat';

COMMENT ON COLUMN public.ai_cost_log.source IS
  'Distinguishes opex-funded autonomous AI calls (weekly_review_cron, app_open_fallback) from user-initiated, credit-gated calls (default user_chat). Added Phase 44 (ENGINE-05); backfills existing rows safely via the DEFAULT.';
```
No RLS change needed — the existing `ai_cost_log_own` policy (lines 26-28) already scopes reads correctly regardless of the new column.

---

### `apps/mobile/app/(app)/_layout.tsx` — MODIFIED: add `useCoachingEngineBootstrap()` (bootstrap hook)

**Analog:** same file, `useBrandingBootstrap()` (lines 59-90) — copy the `useQuery` + `useEffect` shape 1:1, same unconditional-per-authenticated-user mount timing.

**Pattern to copy** (lines 59-90, adapted):
```typescript
function useCoachingEngineBootstrap() {
  const userId = useAuthStore((s) => s.user?.id);

  useQuery({
    queryKey: ['coaching-engine-review-check', userId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/coaching-engine/review-check`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error('fetch failed');
      return res.json();
    },
    staleTime: 30_000, // re-fires on foreground-after-backgrounding, same as useBrandingBootstrap
    enabled: !!userId,
  });
}

export default function AppLayout() {
  useBrandingBootstrap();
  useCoachingEngineBootstrap(); // NEW — sibling hook, same file, same mount point
  // ...
```

**Overlay mount pattern** (line 257, alongside `<PendingFormsOverlay />`):
```tsx
<PendingFormsOverlay />
<WeeklyReviewRevealOverlay />
```

---

### `apps/mobile/src/components/WeeklyReviewRevealOverlay.tsx` (NEW — D-03 in-app reveal)

**Analog 1 (Modal mount mechanism — full-screen, above tab bar):** `apps/mobile/src/components/PendingFormsOverlay.tsx` (full file, 491 lines)

**Analog 2 (dark-celebration visual treatment, `FadeInUp` badge):** `apps/mobile/app/(auth)/onboarding/ziko-chat.tsx`'s `CelebrationOverlay` (lines 260-343)

**Modal shell pattern** (`PendingFormsOverlay.tsx` lines 183-196):
```tsx
<Modal
  visible={isVisible}
  animationType="none"
  presentationStyle="fullScreen"
  statusBarTranslucent
  onRequestClose={dismiss} // DELTA from PendingFormsOverlay: this phase's overlay is dismissible via back/gesture (44-UI-SPEC.md), PendingFormsOverlay's mandatory-forms flow is not
>
```
`paddingBottom: 100` does NOT apply — a `Modal` presents above the tab bar entirely (44-UI-SPEC.md explicit note); `PendingFormsOverlay.tsx` line 206 uses it only because its content view is a normal in-Modal scroll layout, not because the tab bar shows through.

**Badge/entrance-animation pattern — copy verbatim from `CelebrationOverlay`, swap glyph only** (`ziko-chat.tsx` lines 291-308):
```tsx
<Animated.View
  entering={FadeInUp.springify().damping(12)}
  style={{
    width: 76, height: 76, borderRadius: 22, backgroundColor: '#FF5C1A',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: 'rgba(255,92,26,0.70)', shadowOffset: { width: 0, height: 12 },
    shadowRadius: 40, shadowOpacity: 1, elevation: 16,
  }}
>
  <Ionicons name="sparkles" size={38} color="#fff" />  {/* was "checkmark" in Phase 43 */}
</Animated.View>
```
Background `#1C1A17`, radial glow `rgba(255,92,26,0.25)` (`ziko-chat.tsx` lines 275-288), headline `#FFFAF6` 28/700, subcopy `rgba(255,250,246,0.70)` 15/400, CTA `#FF5C1A` bg / white text 15/700 — copy every hex value verbatim per `44-UI-SPEC.md`'s Color section (this phase's overlay is the "dark exception," hardcoded hex, not `useThemeStore` tokens).

**Data source / fire-once pattern:** `useQuery` reading `athlete_state.last_review_at`/`current_focus_summary`, gated by a locally-persisted "last seen" marker in MMKV — mirror `PendingFormsOverlay.tsx`'s `useQuery` + `useEffect` populate-local-state shape (lines 48-71), but the "seen" comparison itself has no direct analog in this codebase; closest precedent for the MMKV per-key cache idiom is `useAIDailyTip`'s `ai_tip_${TODAY}` key (referenced in RESEARCH.md Pattern 5, not read this session — grep `apps/mobile/src/hooks/useAIDailyTip.ts` during implementation for the exact MMKV call shape).

**Grounding discipline (must copy):** never render from incomplete/failed review data — if the query doesn't return a real, confirmed-complete review, the overlay simply does not fire (44-UI-SPEC.md's Grounding section, mirrors Phase 43's D-14).

---

## Shared Patterns

### Anthropic schema sanitizer (`stripUnsupportedKeywords`/`anthropicSchema`)
**Source:** `backend/api/src/tools/onboarding-retroactive.ts` lines 28-54 (also mirrored in `coach/voice/service.ts`, `coach/imports/parse/claude.ts` per that file's own header comment)
**Apply to:** `coaching-engine/decide.ts`'s `WEEKLY_DECISION_SCHEMA` — every `generateObject` call in this phase must route through this sanitizer, never pass a raw Zod schema.

### `week_of` capture discipline (ENGINE-04 idempotency)
**Source:** derived from `supabase/migrations/20260831120200_athlete_decisions_rpc.sql` lines 50-72 (the `ON CONFLICT ... DO NOTHING` arbiter) — pattern is new to this phase, not copied from an existing TS file, but the RPC contract it must satisfy is live and unchanged.
**Apply to:** both `routes.ts`'s `/review-check` handler and the `/cron/weekly-review` handler — both must read `athlete_state.next_review_due_at` and pass that captured value as `p_week_of`, never `CURRENT_DATE`/`Date.now()` at fire time.

### `clientForUser` service-role client selection
**Source:** `backend/api/src/tools/db.ts` (full file, 16 lines)
**Apply to:** every `coaching-engine/*.ts` file that touches `athlete_state`/`athlete_decisions`/`athlete_goals`/`ai_cost_log` — always `clientForUser(userToken)`, never a raw `createClient()` inline.

### `record_athlete_decision()` as the sole write path
**Source:** `supabase/migrations/20260831120200_athlete_decisions_rpc.sql` (full file, 162 lines, live in production)
**Apply to:** every write this phase performs to `athlete_state`/`athlete_decisions`/`athlete_goals` — `apply.ts`, both tool executors in `tools.ts`, and no other path. Callers MUST check `data.success === true`, not just the absence of a thrown error (guard-first, error-shaped-return convention, not `RAISE EXCEPTION`).

### `CRON_SECRET` bearer guard, defined BEFORE `authMiddleware`
**Source:** `backend/api/src/coach/ai/service.ts` lines 207-214 (`monitor-cron`), identical pattern at `notifications-cron.ts`'s `weekly-digest`
**Apply to:** `coaching-engine/routes.ts`'s `/cron/weekly-review` handler — mandatory checklist item per RESEARCH.md's Security Domain table; a cron guarded after `authMiddleware` (or left unguarded) lets anyone fabricate weekly decisions at will.

### `waitUntil()` fire-and-forget background work
**Source:** `backend/api/src/routes/push-events.ts` lines 1-3, 48-56, 95-103 (3rd existing call site: `coach/programs/service.ts`/`coach/clients/service.ts`)
**Apply to:** `routes.ts`'s `/review-check` handler — respond `{ ok: true }` immediately, run the due-check + `generateObject` + `apply.ts` chain inside `waitUntil()`.

### Modal-based full-screen overlay above the tab bar
**Source:** `apps/mobile/src/components/PendingFormsOverlay.tsx` (full file), mounted in `apps/mobile/app/(app)/_layout.tsx` line 257
**Apply to:** `WeeklyReviewRevealOverlay.tsx` — same `<Modal presentationStyle="fullScreen" statusBarTranslucent>` shell, mounted as a sibling to `<Tabs>`, not embedded in-place inside a tab screen.

### Dark-celebration visual exception (`FadeInUp` badge, hardcoded hex)
**Source:** `apps/mobile/app/(auth)/onboarding/ziko-chat.tsx`'s `CelebrationOverlay` lines 260-343, itself derived from `apps/mobile/app/(auth)/onboarding/step-7.tsx`'s `OBReady`
**Apply to:** `WeeklyReviewRevealOverlay.tsx` — reuse every token verbatim per `44-UI-SPEC.md`; only the Ionicons glyph (`sparkles` not `checkmark`) and dismiss behavior (CTA + back/gesture, not CTA-only) differ.

### AITool dual-registration split (`executors` map vs `allToolSchemas`)
**Source:** `backend/api/src/tools/registry.ts` lines 134-183 (`assess_profile`'s deliberate exclusion) vs lines 583-598 (`allToolSchemas` assembly)
**Apply to:** `create_goal`/`create_program` — register in BOTH places (unlike `assess_profile`, which is executors-only), because ENGINE-06 requires interactive-chat callability alongside the cron's direct executor call.

## No Analog Found

None — every file identified from CONTEXT.md/RESEARCH.md has a direct, closely-matching analog already shipped in this codebase (RESEARCH.md's own framing: "this phase is composition and careful reuse, not new-pattern invention"). The one partial gap is the MMKV "last seen" fire-once marker for the reveal overlay (`WeeklyReviewRevealOverlay.tsx`), which has no exact prior file to copy verbatim — the closest precedent (`useAIDailyTip`'s per-day MMKV key) is named in RESEARCH.md but was not directly read this session; flagged for a targeted read during planning/implementation rather than treated as "no analog."

## Metadata

**Analog search scope:** `backend/api/src/tools/`, `backend/api/src/coach/ai/`, `backend/api/src/routes/`, `backend/api/src/config/`, `backend/api/src/app.ts`, `backend/api/vercel.json`, `supabase/migrations/2026083*.sql`, `supabase/migrations/027_ai_cost_log.sql`, `apps/mobile/app/(app)/_layout.tsx`, `apps/mobile/src/components/`, `apps/mobile/app/(auth)/onboarding/`
**Files scanned:** 12 direct reads (`tools/onboarding-retroactive.ts`, `tools/registry.ts` [3 ranges], `tools/db.ts`, `coach/ai/service.ts`, `components/PendingFormsOverlay.tsx`, `app/(app)/_layout.tsx`, `app/(auth)/onboarding/ziko-chat.tsx` [CelebrationOverlay range], `config/models.ts`, `app.ts` [grep], `backend/api/vercel.json`) + 5 migration files (`20260831120000_athlete_state.sql`, `20260831120100_athlete_decisions.sql`, `20260831120200_athlete_decisions_rpc.sql`, `20260831213147_athlete_state_revoke_anon.sql`, `027_ai_cost_log.sql`) + `43-PATTERNS.md` (Phase 43's own pattern map, reused directly for `assess_profile`-shaped executor precedent) + `44-RESEARCH.md`/`44-CONTEXT.md`/`44-UI-SPEC.md`
**Pattern extraction date:** 2026-09-02
