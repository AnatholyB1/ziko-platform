# Phase 02: Claude Structuring — Research

**Researched:** 2026-05-27
**Domain:** Vercel AI SDK v6 `generateObject` · Hono v4 route · Supabase coach-client RLS queries · React state machine extension
**Confidence:** HIGH

---

## Summary

Phase 02 adds a single Hono route (`POST /coach/voice/structure`) that assembles athlete context from Supabase, calls Claude via `generateObject` to produce a validated 5-section card, and returns the card JSON to the frontend. The frontend extends the existing `vocalReducer` with 5 new states and renders 6 new React components (one per UI state).

The technical path is fully proven within this codebase. `generateObject` is already used in `backend/api/src/coach/imports/parse/claude.ts` with the exact `anthropicSchema` / `stripUnsupportedKeywords` wrapper needed for Anthropic's restricted JSON Schema subset. All Supabase queries are straightforward reads from tables already used in `coach/clients/db.ts` — coach JWT grants access via `is_coach_of()` RLS on `workout_sessions`, `session_sets`, `body_measurements`, `sleep_logs`, and `coach_client_notes`. Coach notes use a separate self-ownership policy (coach_id = auth.uid()).

The only new infrastructure needed is the route handler itself and the Zod schema for `StructuredCard`. No new migrations, no new packages beyond what is already installed.

**Primary recommendation:** Add `POST /voice/structure` to the existing `voiceRouter` in `backend/api/src/coach/voice/service.ts`. Use `generateObject` with `anthropicSchema()` (copy the pattern from `imports/parse/claude.ts`). Fetch all athlete context server-side inside the route handler — do NOT expect the frontend to assemble it.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STRUCT-01 | Claude receives transcript + full athlete context: last 10 sessions (weight, reps, RPE), recent measurements, sleep scores, private coach notes, previous vocal feedback history | Supabase queries identified for each data type; all tables have coach-read RLS via `is_coach_of()`. Coach notes use `coach_client_notes`. Vocal history is empty array for Phase 02. |
| STRUCT-02 | Output: 5-section structured card — Contexte séance, Points forts, Corrections, Next steps, Tags (force/technique/mental/cardio/récupération) | `generateObject` with Zod schema enforces exact output shape. `AGENT_MODEL` (claude-sonnet-4-20250514) selected. |
| STRUCT-03 | Coach can edit the card before saving — inline editable sections | State machine extension `card-editing` + `CardSection.tsx` click-to-edit pattern defined in UI-SPEC.md. |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Athlete context assembly (sessions, measurements, sleep, notes) | API / Backend | — | Context data lives in Supabase; coach JWT required; assembling server-side avoids exposing raw Supabase queries to the browser |
| Claude `generateObject` call | API / Backend | — | API key is server-side only; structured JSON output must be validated before hitting the wire |
| `POST /coach/voice/structure` Hono route | API / Backend | — | Extends existing `voiceRouter`; auth middleware already mounted |
| State machine extension (structuring/card states) | Frontend / Client | — | `vocalReducer.ts` is a pure function; extending it is a client-side concern |
| 6 new vocal UI components | Frontend / Client | — | All components live in `apps/web/src/components/coach/vocal/` per Phase 01 pattern |
| GSAP animations (card entrance, section stagger, tags pop) | Frontend / Client | — | GSAP already installed from Phase 01 |
| Inline section editing (CardSection click-to-edit) | Frontend / Client | — | Pure React state, no server involvement until [Sauvegarder] |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` (Vercel AI SDK) | `^6.0.116` (installed: `6.0.191`) | `generateObject` for structured Claude output | Already in `backend/api/package.json` — proven in `imports/parse/claude.ts` [VERIFIED: npm registry] |
| `@ai-sdk/anthropic` | `^3.0.58` | Claude model provider | Project standard; `AGENT_MODEL` constant in `config/models.ts` [VERIFIED: codebase] |
| `zod` | `^4.3.6` (project uses v4) | StructuredCard schema validation | Project standard; `ai` v6 peer-deps accept `^3.25.76 \|\| ^4.1.8` [VERIFIED: npm registry] |
| `@ai-sdk/provider-utils` | `4.0.27` (installed) | `zodSchema()` for schema conversion | Already imported in `imports/parse/claude.ts` [VERIFIED: codebase] |
| `hono` | `^4.7.0` | Route handler | Project-wide standard [VERIFIED: codebase] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@supabase/supabase-js` | `^2.50.0` | Athlete context queries | Use `createUserClient(jwt)` pattern from `clients/db.ts` |
| `gsap` | installed from Phase 01 | Card entrance + section stagger animations | All Phase 02 motion design per UI-SPEC.md |
| `lucide-react` | project standard | `sparkles`, `loader-2`, `check-circle`, `alert-triangle` icons | Already used in Phase 01 components |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `generateObject` | `streamText` + manual JSON parse | `generateObject` validates schema; parsing streaming JSON is error-prone and not needed here since latency budget is 5–10s |
| `anthropicSchema()` from existing util | `zodSchema()` directly | Direct `zodSchema()` passes Zod-generated keywords that Anthropic rejects (minimum/maximum on integers). Must use the `stripUnsupportedKeywords` wrapper. |
| Server-side context assembly | Client sends full context | Client-side assembly would require exposing Supabase queries to the browser and passing large payloads over the network. Server-side is consistent with `coach/clients/db.ts` pattern. |

**Installation:** No new packages required. All dependencies are already installed.

---

## Package Legitimacy Audit

No new packages are being installed in this phase. All libraries used are pre-existing project dependencies.

| Package | Registry | Status | Disposition |
|---------|----------|--------|-------------|
| `ai` | npm | Already installed v6.0.191 | Approved (existing) |
| `@ai-sdk/anthropic` | npm | Already installed | Approved (existing) |
| `zod` | npm | Already installed v4.x | Approved (existing) |
| `@ai-sdk/provider-utils` | npm | Already installed v4.0.27 | Approved (existing) |

**Packages removed due to slopcheck:** none — no new installs.

---

## Architecture Patterns

### System Architecture Diagram

```
[VocalReview — "Valider" pressed]
         │
         ▼
[vocalReducer: VALIDATE action]
   → { status: 'structuring', transcript }
         │
         ▼
[VocalRetourPanel: useEffect on status='structuring']
   → POST /api/coach/voice/structure
     { athlete_id, transcript }
         │
         ▼  (Hono voiceRouter — auth middleware applied)
[POST /coach/voice/structure handler]
   ├─ Parallel Supabase queries (coach JWT):
   │   ├─ workout_sessions + session_sets (last 10, with exercise names)
   │   ├─ body_measurements (last 5)
   │   ├─ sleep_logs (last 14 days)
   │   └─ coach_client_notes (single note for this coach+client)
   │
   ├─ vocal_history: [] (Phase 02 stub — Phase 03 adds this)
   │
   ▼
[generateObject — claude-sonnet-4-20250514]
   system: "Tu es un assistant coach..."
   prompt: buildStructuringPrompt(transcript, athleteContext)
   schema: anthropicSchema(StructuredCardZodSchema)
         │
         ▼ (validated StructuredCard object)
[Response: { card: StructuredCard }]
         │
         ▼
[vocalReducer: STRUCTURE_SUCCESS action]
   → { status: 'card-ready', card, editedCard: card }
         │
         ▼
[VocalCardReady renders FeedbackCard with 5 CardSection + TagChip]
   Coach edits → card-editing
   [Sauvegarder] → card-saving (Phase 03 saves to DB; Phase 02: noop/placeholder)
```

### Recommended Project Structure

```
backend/api/src/coach/voice/
├── service.ts          ← ADD: POST /voice/structure route (existing file)
└── (no new files needed for backend)

apps/web/src/components/coach/vocal/
├── vocalReducer.ts           ← EXTEND: 5 new states + 4 new actions
├── VocalRetourPanel.tsx      ← EXTEND: handle structuring states, trigger POST
├── VocalReview.tsx           ← MODIFY: handleValidate triggers structuring, not idle
├── VocalStructuring.tsx      ← NEW: spinner loading state
├── VocalCardReady.tsx        ← NEW: card display + save button
├── VocalStructuringError.tsx ← NEW: error state
├── FeedbackCard.tsx          ← NEW: card container (used in VocalCardReady)
├── CardSection.tsx           ← NEW: per-section block (read/edit)
└── TagChip.tsx               ← NEW: toggleable pill chip
```

### Pattern 1: `generateObject` with Anthropic schema sanitizer

**What:** Use `generateObject` (not `streamText`) when Claude must return structured JSON. The `anthropicSchema()` wrapper strips keywords Anthropic's structured output rejects.

**When to use:** Any route where a validated JSON object is the sole output.

**Example:**
```typescript
// Source: backend/api/src/coach/imports/parse/claude.ts (verified in codebase)
import { generateObject, jsonSchema, NoObjectGeneratedError } from 'ai';
import { zodSchema } from '@ai-sdk/provider-utils';
import { z } from 'zod';

// Anthropic-safe schema wrapper — copy this function verbatim
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

// StructuredCard Zod schema
const StructuredCardSchema = z.object({
  context:     z.string(),
  strengths:   z.string(),
  corrections: z.string(),
  next_steps:  z.string(),
  tags:        z.array(z.enum(['force', 'technique', 'mental', 'cardio', 'recuperation'])),
});

const CARD_SCHEMA = anthropicSchema<z.infer<typeof StructuredCardSchema>>(StructuredCardSchema);

// Usage inside route handler
const { object: card } = await generateObject({
  model: AGENT_MODEL,
  schema: CARD_SCHEMA,
  system: STRUCTURING_SYSTEM_PROMPT,
  prompt: buildStructuringPrompt(transcript, context),
});
```

### Pattern 2: Server-side athlete context assembly

**What:** Fetch all athlete data server-side in the route handler using the coach's JWT. Run queries in parallel with `Promise.all` where tables are independent.

**When to use:** Whenever Claude needs athlete data that lives in Supabase.

**Example:**
```typescript
// Source: pattern from backend/api/src/coach/clients/db.ts (verified in codebase)
import { createUserClient } from '../clients/db.js';

async function fetchAthleteContext(jwt: string, athleteId: string) {
  const db = createUserClient(jwt);

  // Last 10 sessions with their sets (two queries — sets require session IDs first)
  const { data: sessions } = await db
    .from('workout_sessions')
    .select('id, name, started_at, total_volume_kg')
    .eq('user_id', athleteId)
    .order('started_at', { ascending: false })
    .limit(10);

  const sessionIds = (sessions ?? []).map(s => s.id);
  const [setsRes, measurementsRes, sleepRes, noteRes] = await Promise.all([
    sessionIds.length > 0
      ? db.from('session_sets')
           .select('session_id, set_number, reps, weight_kg, rpe, exercise_id')
           .in('session_id', sessionIds)
      : Promise.resolve({ data: [] }),
    db.from('body_measurements')
       .select('weight_kg, body_fat_pct, created_at')
       .eq('user_id', athleteId)
       .order('created_at', { ascending: false })
       .limit(5),
    db.from('sleep_logs')
       .select('date, duration_hours, quality')
       .eq('user_id', athleteId)
       .order('date', { ascending: false })
       .limit(14),
    db.from('coach_client_notes')
       .select('content')
       .eq('client_id', athleteId)
       // coach_id constraint is enforced by RLS (auth.uid() = coach_id)
       .maybeSingle(),
  ]);

  return {
    sessions: sessions ?? [],
    sets: setsRes.data ?? [],
    measurements: measurementsRes.data ?? [],
    sleep_scores: sleepRes.data ?? [],
    coach_notes: noteRes.data?.content ?? '',
    vocal_history: [], // Phase 03 will populate this from coach_vocal_feedbacks
  };
}
```

**Critical RLS note:** `coach_client_notes` uses `auth.uid() = coach_id` (self-ownership), NOT `is_coach_of()`. The WHERE clause must NOT include `coach_id = coachId` explicitly — RLS enforces it. Adding it would be redundant but safe. However, `createUserClient(jwt)` with the coach's JWT means `auth.uid()` = coach's UUID, so the note is filtered correctly.

### Pattern 3: vocalReducer extension

**What:** Add Phase 02 state types and actions to the existing union types. The VALIDATE action transitions to `structuring` instead of `idle`.

**When to use:** State machine transitions for Phase 02 flows.

**Example:**
```typescript
// Source: apps/web/src/components/coach/vocal/vocalReducer.ts (to be modified)

// New states added to VocalState union:
// | { status: 'structuring'; transcript: string }
// | { status: 'card-ready'; card: StructuredCard; editedCard: StructuredCard }
// | { status: 'card-editing'; card: StructuredCard; editedCard: StructuredCard; activeSection: CardSection }
// | { status: 'card-saving'; editedCard: StructuredCard }
// | { status: 'card-saved' }
// | { status: 'structuring-error'; transcript: string; message: string }

// New actions added to VocalAction union:
// | { type: 'STRUCTURE_SUCCESS'; card: StructuredCard }
// | { type: 'STRUCTURE_ERROR'; message: string }
// | { type: 'SECTION_EDIT'; section: CardSection; value: string }
// | { type: 'TAG_TOGGLE'; tag: TagKey }
// | { type: 'START_SAVING' }
// | { type: 'SAVE_COMPLETE' }
// | { type: 'RESET' }

// VALIDATE case changes: 'review' → 'structuring' (not 'idle')
case 'VALIDATE': {
  if (state.status !== 'review') return state;
  return { status: 'structuring', transcript: state.transcript }; // CHANGED
}
```

### Pattern 4: Claude prompt design for structured feedback

**What:** System prompt defines the coach AI persona and JSON contract. User prompt packs the transcript + athlete context into a compact, structured format.

**When to use:** The `generateObject` call in the structure route handler.

**Example:**
```typescript
const STRUCTURING_SYSTEM_PROMPT = `Tu es un assistant expert pour les coachs de fitness.
À partir du transcript d'un retour vocal du coach et du contexte complet de l'athlète,
produis une card structurée avec exactement 5 sections.

Règles:
- context: résumé factuel de la séance (exercices, charges, RPE) — 2-4 phrases
- strengths: ce que l'athlète a bien fait — liste ou prose, 2-3 points
- corrections: corrections techniques ou comportementales — 2-3 points précis
- next_steps: recommandations concrètes pour la prochaine séance ou la semaine
- tags: tableau de 1 à 3 tags parmi ["force","technique","mental","cardio","recuperation"]
  choisis uniquement ceux qui correspondent au contenu du retour vocal

Réponds uniquement avec le JSON demandé. Pas d'explication.`;

function buildStructuringPrompt(transcript: string, ctx: AthleteContext): string {
  const sessionLines = ctx.sessions.map((s, i) => {
    const sessionSets = ctx.sets.filter(set => set.session_id === s.id);
    const setsSummary = sessionSets
      .slice(0, 8) // cap to avoid token bloat
      .map(set => `    Set ${set.set_number}: ${set.reps}×${set.weight_kg}kg RPE${set.rpe ?? '?'}`)
      .join('\n');
    return `  Séance ${i + 1} (${s.started_at?.split('T')[0] ?? 'date inconnue'}): ${s.name ?? 'Sans nom'}\n${setsSummary}`;
  }).join('\n');

  const measurementLines = ctx.measurements
    .map(m => `  ${m.created_at?.split('T')[0]}: ${m.weight_kg}kg, BF ${m.body_fat_pct ?? '?'}%`)
    .join('\n');

  const sleepLines = ctx.sleep_scores
    .map(s => `  ${s.date}: ${s.duration_hours}h qualité ${s.quality}/5`)
    .join('\n');

  return `## Transcript du retour vocal du coach
${transcript}

## Contexte athlète
### 10 dernières séances
${sessionLines || '  Aucune séance enregistrée'}

### Mesures récentes
${measurementLines || '  Aucune mesure'}

### Sommeil (14 derniers jours)
${sleepLines || '  Aucune donnée sommeil'}

### Notes privées du coach
${ctx.coach_notes || '  Aucune note'}

### Historique feedbacks vocaux
${ctx.vocal_history.length === 0 ? '  Aucun feedback précédent' : ctx.vocal_history.map(f => `  ${f.created_at}: ${JSON.stringify(f.card)}`).join('\n')}`;
}
```

### Anti-Patterns to Avoid

- **Using `zodSchema()` directly without `stripUnsupportedKeywords`:** Zod v4 generates `minimum`/`maximum` on `z.number()` and `minItems`/`maxItems` on `z.array()`. Anthropic's structured output rejects these. Always use the `anthropicSchema()` wrapper (copy from `imports/parse/claude.ts`).
- **Client-side context assembly:** Do not pass `sessions[]`, `measurements[]` etc. from the browser — the context object is large, requires Supabase access, and exposes internal data structures over the wire.
- **Mutable `card` in component state:** The `FeedbackCard` must maintain two copies: `card` (original from Claude) and `editedCard` (coach-modified). Only `editedCard` is sent to save. The original is preserved for diffing or cancel.
- **VALIDATE dispatching to `idle`:** The existing `vocalReducer` sends VALIDATE → `idle`. Phase 02 changes this to → `structuring`. The test in `vocalReducer.test.ts` (`review → idle on VALIDATE`) must be updated to `review → structuring`.
- **No `maxDuration` export on the structure route:** The `voiceRouter` already exports `maxDuration = 60` for Vercel. The `generateObject` call typically completes in 3–8 seconds with Claude Sonnet, well within that budget. Do not create a separate Vercel function file.
- **Querying `coach_client_notes` with explicit `coach_id` WHERE clause on top of RLS:** RLS policy on `coach_client_notes` is `auth.uid() = coach_id`. The Supabase JS client respects this automatically. Adding `.eq('coach_id', coachId)` is safe but redundant. The column does not need to be in the SELECT either.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured JSON output from Claude | Manual `JSON.parse` on `streamText` output | `generateObject` from `ai` | Validates schema, retries on malformed output, throws `NoObjectGeneratedError` on failure |
| Anthropic JSON Schema compatibility | Custom schema builder | `anthropicSchema()` wrapper from `imports/parse/claude.ts` | Already handles all Anthropic-banned keywords; battle-tested in Phase 28 |
| Auth validation on the new route | Custom JWT check | `authMiddleware` (already mounted via `voiceRouter.use('*', authMiddleware)`) | The existing wildcard middleware on voiceRouter covers all routes including `/structure` |
| Coach-client access control | Manual `is_coach_of()` SQL call | Supabase RLS + coach JWT via `createUserClient(jwt)` | RLS on workout_sessions, session_sets, sleep_logs, body_measurements all include `is_coach_of()` policy — no application-level check needed |

**Key insight:** The Anthropic schema pitfall is the single most dangerous hand-roll. The `zodSchema()` → `stripUnsupportedKeywords()` → `jsonSchema()` pipeline already exists in this codebase. Copy it — do not re-derive it.

---

## Common Pitfalls

### Pitfall 1: Zod v4 keywords rejected by Anthropic structured output

**What goes wrong:** `generateObject` throws `400 Bad Request` from Anthropic API with message about invalid JSON Schema keywords.

**Why it happens:** Zod v4 emits `minimum`/`maximum` on `z.number()`, `minItems`/`maxItems` on `z.array()`, and `format` on some types. Anthropic's structured output endpoint rejects these keywords.

**How to avoid:** Use `anthropicSchema<T>(zodType)` from `imports/parse/claude.ts`. Copy the function verbatim — do not use `zodSchema()` directly.

**Warning signs:** API call throws with schema-related error text; `generateObject` never returns `object`.

### Pitfall 2: `VALIDATE` reducer case still returns `idle` after Phase 02

**What goes wrong:** Coach clicks [Valider], state jumps to `idle` instead of `structuring`. Spinner never appears. No Claude call is made.

**Why it happens:** The existing `vocalReducer.ts` has `case 'VALIDATE': return { status: 'idle' }`. The existing test asserts `review → idle on VALIDATE`. Both must be updated in the same task.

**How to avoid:** In the reducer update task, change the VALIDATE case to return `{ status: 'structuring', transcript: state.transcript }`. Update the test expectation from `'idle'` to `'structuring'`.

**Warning signs:** Clicking [Valider] clears the panel immediately; console shows no POST to `/api/coach/voice/structure`.

### Pitfall 3: `coach_client_notes` coach-read RLS — query scope

**What goes wrong:** `getClientNote()` returns `null` even when a note exists, OR the query fails with RLS violation.

**Why it happens:** `coach_client_notes` uses `auth.uid() = coach_id` (self-ownership), not `is_coach_of()`. The coach's JWT must be used (not a service key). The query must NOT include `.eq('user_id', athleteId)` — the column is `client_id`, not `user_id`.

**How to avoid:** Use `.eq('client_id', athleteId)` (correct column). Use `createUserClient(jwt)` with coach JWT. RLS handles `coach_id` automatically.

**Warning signs:** Supabase returns empty `data` or `{}` for notes that exist in the DB.

### Pitfall 4: `session_sets` requires join — no direct `user_id` column

**What goes wrong:** Trying to query `session_sets` directly with `.eq('user_id', athleteId)` fails — `session_sets` has no `user_id` column.

**Why it happens:** `session_sets` references `workout_sessions(id)` via `session_id`. The coach-read RLS policy uses a subquery: `session_id IN (SELECT id FROM workout_sessions WHERE user_id = ...)`. Access requires fetching session IDs first, then querying sets by `session_id IN (ids)`.

**How to avoid:** Always fetch session IDs in step 1, then `.in('session_id', ids)` for sets in step 2 (can be parallelized with other step-2 queries using `Promise.all`).

**Warning signs:** Supabase JS throws a type error or returns empty on direct `session_sets` `.eq('user_id', ...)` query.

### Pitfall 5: `clientId` in `VocalRetourPanel` is currently ignored

**What goes wrong:** Phase 02 `structuring` state needs `clientId` to POST to `/coach/voice/structure`. The component already receives `clientId` as a prop, but Phase 01 sets it aside with `void clientId`.

**Why it happens:** Phase 01 code has `void clientId; // reserved for Phase 02`.

**How to avoid:** Remove the `void clientId` line. Use `clientId` in the POST body to the structure endpoint. The prop is already plumbed through from `page.tsx`.

**Warning signs:** `athlete_id` in the POST body is `undefined`; route handler returns 400.

### Pitfall 6: GSAP animations on state transitions — SSR / React strict mode

**What goes wrong:** GSAP animations throw `window is not defined` during SSR, or run twice in React strict mode (development only).

**Why it happens:** `'use client'` directive on the component files prevents SSR issues. Strict mode double-invocation of effects can cause double-animation, but GSAP idempotently re-runs `from()` calls.

**How to avoid:** All vocal components already have `'use client'`. Run GSAP inside `useEffect`. Use `gsap.context()` cleanup if animations are complex (not required for simple `from()` calls). Matches Phase 01 pattern.

---

## Code Examples

### Route Handler: POST /coach/voice/structure

```typescript
// Source: pattern from backend/api/src/coach/imports/parse/claude.ts + coach/voice/service.ts
// Add to backend/api/src/coach/voice/service.ts

import { generateObject, jsonSchema, NoObjectGeneratedError } from 'ai';
import { zodSchema } from '@ai-sdk/provider-utils';
import { z } from 'zod';
import { AGENT_MODEL } from '../../config/models.js';
import { createUserClient } from '../clients/db.js';

// Anthropic-safe schema (copy of existing pattern)
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

const StructuredCardZod = z.object({
  context:     z.string(),
  strengths:   z.string(),
  corrections: z.string(),
  next_steps:  z.string(),
  tags:        z.array(z.enum(['force', 'technique', 'mental', 'cardio', 'recuperation'])),
});
const CARD_SCHEMA = anthropicSchema<z.infer<typeof StructuredCardZod>>(StructuredCardZod);

voiceRouter.post('/structure', async (c) => {
  const { userId: coachId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);

  const body = await c.req.json<{ athlete_id: string; transcript: string }>();
  if (!body.athlete_id || !body.transcript) {
    return c.json({ error: 'athlete_id and transcript are required' }, 400);
  }

  const { athlete_id, transcript } = body;

  // --- Fetch athlete context ---
  const db = createUserClient(jwt);
  const { data: sessions } = await db
    .from('workout_sessions')
    .select('id, name, started_at, total_volume_kg')
    .eq('user_id', athlete_id)
    .order('started_at', { ascending: false })
    .limit(10);

  const sessionIds = (sessions ?? []).map((s: any) => s.id);
  const [setsRes, measurementsRes, sleepRes, noteRes] = await Promise.all([
    sessionIds.length > 0
      ? db.from('session_sets').select('session_id, set_number, reps, weight_kg, rpe').in('session_id', sessionIds)
      : Promise.resolve({ data: [] }),
    db.from('body_measurements').select('weight_kg, body_fat_pct, created_at').eq('user_id', athlete_id).order('created_at', { ascending: false }).limit(5),
    db.from('sleep_logs').select('date, duration_hours, quality').eq('user_id', athlete_id).order('date', { ascending: false }).limit(14),
    db.from('coach_client_notes').select('content').eq('client_id', athlete_id).maybeSingle(),
  ]);

  const athleteContext = {
    sessions: sessions ?? [],
    sets: (setsRes as any).data ?? [],
    measurements: measurementsRes.data ?? [],
    sleep_scores: sleepRes.data ?? [],
    coach_notes: (noteRes.data as any)?.content ?? '',
    vocal_history: [], // Phase 03 dependency
  };

  // --- generateObject ---
  try {
    const { object: card } = await generateObject({
      model: AGENT_MODEL,
      schema: CARD_SCHEMA,
      system: STRUCTURING_SYSTEM_PROMPT,
      prompt: buildStructuringPrompt(transcript, athleteContext),
    });
    return c.json({ card });
  } catch (err: any) {
    if (err instanceof NoObjectGeneratedError) {
      console.error('[coach/voice] structure NoObjectGeneratedError:', err.message);
      return c.json({ error: 'La structuration a échoué — Claude n\'a pas retourné de JSON valide.' }, 502);
    }
    console.error('[coach/voice] structure error:', err.message);
    return c.json({ error: err.message ?? 'Structuration failed' }, 500);
  }
});
```

### Frontend: Triggering the structure call

```typescript
// Source: VocalRetourPanel.tsx (to be modified — pattern from uploadBlob())
async function handleStructure(transcript: string) {
  try {
    const res = await fetch('/api/coach/voice/structure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ athlete_id: clientId, transcript }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Structuration failed' }));
      dispatch({ type: 'STRUCTURE_ERROR', message: (data as any).error ?? 'Structuration failed' });
      return;
    }
    const data = await res.json();
    dispatch({ type: 'STRUCTURE_SUCCESS', card: data.card });
  } catch {
    dispatch({ type: 'STRUCTURE_ERROR', message: 'Erreur réseau. Vérifiez votre connexion.' });
  }
}

// useEffect: fire when state transitions to 'structuring'
useEffect(() => {
  if (state.status !== 'structuring') return;
  handleStructure(state.transcript);
}, [state.status]);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `streamText` + manual JSON parse | `generateObject` with Zod schema | Vercel AI SDK v4+ | Schema validation, `NoObjectGeneratedError` on failure, cleaner code |
| `z.ZodType` passed directly to `generateObject` schema | `anthropicSchema()` wrapper with `stripUnsupportedKeywords` | Discovered in Phase 28 (IMPORT-BUG-01) | Without this, Anthropic rejects Zod-generated schemas with banned keywords |
| `args` / `result` in AI tool callbacks | `input` / `output` | AI SDK v6 | Project CLAUDE.md documents this; applies to tool callbacks, not `generateObject` |

**Deprecated/outdated:**
- `parameters` field in AI tools: replaced by `inputSchema` in AI SDK v6 (not applicable here — `generateObject` uses `schema`, not `inputSchema`)
- Direct `zodSchema()` from `@ai-sdk/provider-utils` without stripping: still works for other providers, but fails on Anthropic structured output

---

## Runtime State Inventory

Not applicable — this is a greenfield feature addition. No renames, refactors, or migrations in Phase 02.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vercel AI SDK (`ai`) | `generateObject` call | Yes | 6.0.191 | — |
| `@ai-sdk/anthropic` | Claude model | Yes | installed | — |
| `zod` v4 | StructuredCard schema | Yes | ^4.3.6 | — |
| `@ai-sdk/provider-utils` | `zodSchema()` | Yes | 4.0.27 | — |
| `ANTHROPIC_API_KEY` | Claude API calls | Yes (in backend `.env`) | — | — |
| `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` | Athlete context queries | Yes | — | — |
| `gsap` | Phase 02 animations | Yes (Phase 01 installed) | — | — |
| `lucide-react` | Card icons | Yes (project standard) | — | — |

**Missing dependencies with no fallback:** None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (apps/web: vitest.config.ts present) |
| Config file | `apps/web/vitest.config.ts` |
| Quick run command | `cd apps/web && npx vitest run src/components/coach/vocal/ --passWithNoTests` |
| Full suite command | `cd apps/web && npx vitest run --passWithNoTests` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STRUCT-01 | `vocalReducer`: VALIDATE → `structuring` (not `idle`) | unit | `cd apps/web && npx vitest run src/components/coach/vocal/vocalReducer.test.ts` | Yes — update existing test |
| STRUCT-01 | `vocalReducer`: STRUCTURE_SUCCESS → `card-ready` with card | unit | same file | No — Wave 0 gap |
| STRUCT-01 | `vocalReducer`: STRUCTURE_ERROR → `structuring-error` | unit | same file | No — Wave 0 gap |
| STRUCT-02 | `vocalReducer`: card-ready + SECTION_EDIT updates editedCard | unit | same file | No — Wave 0 gap |
| STRUCT-02 | `vocalReducer`: TAG_TOGGLE adds/removes tag from editedCard | unit | same file | No — Wave 0 gap |
| STRUCT-03 | `vocalReducer`: card-ready + START_SAVING → `card-saving` | unit | same file | No — Wave 0 gap |
| STRUCT-03 | `vocalReducer`: card-saving + SAVE_COMPLETE → `card-saved` | unit | same file | No — Wave 0 gap |
| STRUCT-03 | `vocalReducer`: card-saved + RESET → `idle` | unit | same file | No — Wave 0 gap |

### Wave 0 Gaps

- [ ] `apps/web/src/components/coach/vocal/vocalReducer.test.ts` — update VALIDATE test (review → `structuring`), add 7 new state transition tests for Phase 02 actions

*(Backend route has no automated test stub required — pattern follows Phase 01 which has no backend unit tests. Integration tested manually via smoke test.)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `authMiddleware` already mounted on `voiceRouter.use('*', ...)` — covers `/structure` automatically |
| V4 Access Control | yes | Supabase RLS `is_coach_of()` on all athlete data tables; `coach_client_notes` self-ownership policy; route validates `athlete_id` is present |
| V5 Input Validation | yes | `athlete_id` and `transcript` presence check (400 on missing); `generateObject` Zod schema validates Claude output shape |
| V6 Cryptography | no | No new cryptographic operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Coach A queries athlete belonging to Coach B (IDOR) | Elevation of Privilege | `is_coach_of()` RLS on all queried tables enforces at DB level; `createUserClient(jwt)` passes coach JWT |
| Transcript injection into Claude prompt (prompt injection) | Tampering | Transcript is injected as plain text, not as instructions; system prompt is fixed server-side; `generateObject` with strict Zod schema cannot be manipulated to produce a different JSON shape |
| Large transcript payload (DoS) | Denial of Service | Add `transcript` length guard (e.g., max 10,000 chars ≈ 5 min at ~33 chars/s); Hono's `bodyLimit` already applies to JSON routes via 4MB Vercel default |

---

## Sources

### Primary (HIGH confidence)
- Codebase: `backend/api/src/coach/imports/parse/claude.ts` — `generateObject` + `anthropicSchema()` + `stripUnsupportedKeywords` pattern verified in production code [VERIFIED: codebase]
- Codebase: `backend/api/src/coach/clients/db.ts` — all athlete data queries, RLS patterns, `createUserClient(jwt)` [VERIFIED: codebase]
- Codebase: `backend/api/src/coach/voice/service.ts` — existing voiceRouter structure, `authMiddleware` mounting, `maxDuration = 60` [VERIFIED: codebase]
- Codebase: `backend/api/src/config/models.ts` — `AGENT_MODEL = anthropic('claude-sonnet-4-20250514')` [VERIFIED: codebase]
- Codebase: `apps/web/src/components/coach/vocal/vocalReducer.ts` — current state machine to extend [VERIFIED: codebase]
- Migration `035_coach_invitations_links_rls.sql` — `is_coach_of()` RLS on `workout_sessions`, `session_sets`, `body_measurements`, `sleep_logs` [VERIFIED: codebase]
- Migration `041_coach_client_tags_notes.sql` — `coach_client_notes` self-ownership RLS confirmed [VERIFIED: codebase]
- npm registry: `ai` v6.0.191 peer deps include `zod: '^3.25.76 || ^4.1.8'` [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)
- UI-SPEC.md `02-UI-SPEC.md` — state machine extension types, component list, API contract, motion design [VERIFIED: codebase]
- Phase 01 CONTEXT.md — locked decisions inherited by Phase 02 [VERIFIED: codebase]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `generateObject` with `prompt` parameter (not `messages`) is supported in Vercel AI SDK v6 alongside `system` | Code Examples | If not, switch to `messages: [{ role: 'user', content: prompt }]` pattern used in `parseWithVision` |
| A2 | Claude Sonnet 4 (`claude-sonnet-4-20250514`) via `generateObject` reliably returns valid JSON within the 60s `maxDuration` for typical 5-min coaching transcripts (~800 tokens input) | Standard Stack | Latency could exceed budget for very long context; fall back to `VISION_MODEL` (Haiku) if needed |

**All other claims are verified from codebase or npm registry.**

---

## Open Questions (RESOLVED)

1. **Exercise names in session_sets**
   - What we know: `session_sets` has `exercise_id` (UUID FK to `exercises`), not `exercise_name` directly
   - What was unclear: Should the structuring prompt include exercise names, or just raw IDs?
   - **RESOLVED:** Use raw set data only (set_number/reps/weight_kg/rpe). No join to `exercises`. The prompt is readable without exercise names; avoiding the join keeps latency low.

2. **`card-saving` save target for Phase 02**
   - What we know: Phase 03 creates the `coach_vocal_feedbacks` table and save route. Phase 02 has `card-saving` state in the UI.
   - What was unclear: Should Phase 02s [Sauvegarder] call a real endpoint (which returns 501) or simply transition to `card-saved` after a short timeout (fake save)?
   - **RESOLVED:** Use a fake save — dispatch `SAVE_COMPLETE` after 500ms timeout. Phase 03 wires the real endpoint.

3. **`POST /coach/voice/structure` vs save endpoint naming**
   - What we know: UI-SPEC.md calls the structuring route `POST /coach/voice/structure`. Card saving is Phase 03s responsibility.
   - What was unclear: The UI-SPEC.md `card-saving` state description mentions a POST request in flight that is inconsistent with phase boundaries.
   - **RESOLVED:** `POST /coach/voice/structure` is structuring only. The save endpoint `/coach/voice/save` is Phase 03 scope. The inconsistency in UI-SPEC.md is a doc error; do not implement a save call in Phase 02.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in installed packages and existing code
- Architecture: HIGH — `generateObject` pattern, RLS queries, state machine all directly verified in codebase
- Pitfalls: HIGH — Zod v4 / Anthropic schema pitfall is documented in existing code comment (IMPORT-BUG-01); RLS column name pitfall verified from migration SQL

**Research date:** 2026-05-27
**Valid until:** 2026-06-27 (AI SDK v6 stable; Anthropic JSON Schema restrictions are stable API behavior)
