# Phase 44: Weekly Adaptive Decision Engine - Research

**Researched:** 2026-09-02
**Domain:** Autonomous, idempotent weekly AI decision job (single-shot `generateObject`) layered onto an already-shipped `athlete_state`/`athlete_decisions` foundation (Phase 42) and onboarding writer (Phase 43), in a Hono/Vercel/Supabase monorepo
**Confidence:** MEDIUM-HIGH — HIGH for everything anchored to this exact codebase's live schema/RPC/precedent files (all directly read this session); MEDIUM for Vercel Fluid Compute/plan-tier specifics (not discoverable from the repo, unchanged from the project-root research's own MEDIUM rating); LOW/flagged-`[ASSUMED]` for the one genuinely un-precedented product-behavior number (exact "pattern of misses" window)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Review trigger timing**
- **D-01:** Lazy on-app-open is the primary trigger, with a small Sunday cron only as a safety net for athletes who don't open the app that week. On a cheap read that already runs every app open, check if the athlete's review is due; if due, fire it via `waitUntil()` and return immediately. Rejected: a pure synced cron computing every athlete's review at the same wall-clock time.
- **D-02:** Cadence is personalized per athlete, rolling from their onboarding completion date — not synced to the same calendar week for everyone.
- **D-03:** When a lazily-triggered review finishes in the background, the athlete gets a brief in-app "Ziko reviewed your week" moment (reusing the `FadeInUp`/celebration pattern from Phase 43's onboarding celebration) rather than a silent state update. Distinct from Phase 47's push notification (out of scope here).

**Escalation/de-escalation aggressiveness (stepped-care shape)**
- **D-04:** Escalation is fast: one strong week (met or exceeded focus) is enough for the AI to consider escalating next week's focus. No consecutive-week streak requirement.
- **D-05:** De-escalation is slow: a single missed week does NOT by itself trigger de-escalation — only after a pattern of misses. Deliberate non-punitive asymmetry (fast up, slow down), consistent with REWARD-01.
- **D-06:** The AI has discretion to hold focus steady even when the mechanical escalate/de-escalate rule would otherwise trigger a change, based on other signals in decision history. D-04/D-05 are a floor/ceiling, not a hard-coded state machine. Rationale always recorded in `athlete_decisions`.

**"Met focus" definition & activity data sources**
- **D-07:** "Met" requires hitting the assigned target exactly or exceeding it — no tolerance band. Falling short by any amount counts as "missed."
- **D-08:** The real-activity comparison reads only the specific logged-data table(s) that week's assigned focus actually targets — never a fixed source checked indiscriminately. Training-volume focus reads `workout_sessions`/`session_sets`; habit/consistency focus reads `habit_logs`/`journal_entries`; nutrition/hydration focus reads `nutrition_logs`/`hydration_logs`. Exact per-focus-type source mapping is Claude's discretion.

**create_goal / create_program scope**
- **D-09:** `create_goal` writes to a new, dedicated `athlete_goals` table (goal text, target, target_date, status) — not just a JSONB blob. `athlete_state.current_focus_detail.goal_id` references the active row.
- **D-10:** `create_goal` sets the broader, multi-week outcome (the `athlete_goals` row). `create_program` is lighter: it writes this week's concrete structured training targets (session count/type) into `athlete_state.current_focus_detail`, referencing the active goal. Neither tool triggers the existing full multi-week `/ai/programs/generate` flow — that stays separate and chat-initiated only.
- **D-11:** A review only calls `create_program` on an escalation or de-escalation. A "hold steady" review does not regenerate/rewrite the program.

### Claude's Discretion

- Exact per-focus-type data source mapping (D-08) — which table(s) map to which focus category, finalized during planning.
- Exact numeric definition of "a pattern of misses" for de-escalation (D-05) — e.g. 2-of-last-3 weeks, or a different window.
- `athlete_goals` table exact shape (columns beyond goal text/target/target_date/status).
- Exact mechanism for detecting "review is due" on the lazy-trigger read path (D-01) — which existing frequently-hit endpoint carries the check, and how the fired-but-pending state is represented until the next fetch.
- Vercel Fluid Compute / `maxDuration` verification and bounded-concurrency batch sizing for the cron safety net.

### Deferred Ideas (OUT OF SCOPE)

None — every gray area discussed in Phase 44's discussion was an implementation-detail or product-behavior refinement within ENGINE-01–06's existing phase boundary; nothing surfaced that belongs in a different phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENGINE-01 | Weekly comparison of real logged activity (not self-declared) vs assigned focus | §Architecture Patterns "Real-activity comparison"; D-08 mapping table below; `fetchWeeklyReviewContext()` design |
| ENGINE-02 | AI decides next week's focus from comparison + decision history | §Code Examples generateObject schema; Anthropic schema-sanitizer pitfall (load-bearing, undocumented in prior research) |
| ENGINE-03 | Weekly engine acts as guard-rail, escalates/de-escalates independently of onboarding profile | §Open Questions "readiness vs level" resolution; `readiness` field precedent from Phase 42 |
| ENGINE-04 | Idempotent per athlete/week, resists at-least-once cron redelivery | §Common Pitfalls "week_of must be captured, not computed at fire time" — critical correctness finding; live `record_athlete_decision()` RPC behavior |
| ENGINE-05 | Weekly engine AI cost logged to `ai_cost_log`, funded as opex, never deducted from athlete credits | §Common Pitfalls "`ai_cost_log` has no `source` column today" — schema gap requiring a new migration |
| ENGINE-06 | `create_goal`/`create_program` registered in the shared tool registry, callable identically from cron and chat | §Architecture Patterns "Tool registration & the apply.ts split"; live `tools/registry.ts` pattern |
</phase_requirements>

## Summary

Phase 42 and Phase 43 are live in production and change the shape of this research relative to the project-root docs written before either shipped: `athlete_state`, `athlete_decisions`, and `record_athlete_decision()` are real, RLS-locked, and already being called successfully by Phase 43's `assess_profile` (fresh onboarding) and `computeRetroactiveProfile()` (retroactive recompute) tools. The retroactive-recompute tool (`backend/api/src/tools/onboarding-retroactive.ts`) is, in every load-bearing respect, **the exact pattern Phase 44's weekly review must reuse**: a single-shot `generateObject` call fed pre-aggregated real-activity data, writing exclusively through `record_athlete_decision()`. It also surfaces one critical, previously-undocumented gotcha — Anthropic's structured-output endpoint rejects JSON Schema keywords (`minimum`, `maximum`, etc.) that `@ai-sdk/provider-utils`' `zodSchema()` silently adds for any `z.number().int()` field, and this codebase already has a working `stripUnsupportedKeywords()` sanitizer to strip them. Phase 44 must copy this sanitizer verbatim or every `generateObject` call for the weekly decision will fail at the Anthropic API boundary.

The second major finding is a correctness subtlety in the already-shipped `record_athlete_decision()` RPC that the phase plan must design around rather than assume: idempotency is enforced by a unique index on `(user_id, decision_type, week_of)`, and `week_of` is a parameter the **caller** supplies — it is not computed inside the function. If the lazy on-open trigger and the Sunday cron safety net each compute `week_of` independently from "today's date" at their respective fire times, they will compute *different* `week_of` values for the same logical review cycle and the idempotency guarantee silently breaks (both writes succeed, violating ENGINE-04). The correct design captures `athlete_state.next_review_due_at` (the value that made the review "due") *before* firing and derives `week_of` from that captured value, not from wall-clock "now" at fire time. A related, smaller gap: `record_athlete_decision()` only advances `next_review_due_at` when `p_decision_type = 'weekly_focus'` — so a freshly-onboarded athlete's `next_review_due_at` stays `NULL` after Phase 43's onboarding write, meaning the lazy-trigger due-check (`next_review_due_at <= now()`) needs to either treat `NULL` as "due" or — the cleaner fix — a new migration extends the RPC to also stamp `next_review_due_at = NOW() + INTERVAL '7 days'` when `p_decision_type = 'onboarding_profile'`, which is what actually implements D-02's "rolling from onboarding completion date" as literally as possible.

Third, `ai_cost_log` (migration `027_ai_cost_log.sql`) has no `source` column today — it is `user_id, model, input_tokens, output_tokens, created_at` only, written unconditionally in every route's `onFinish` callback regardless of credit-gating. ENGINE-05's "opex, never deducted from athlete credits" is already trivially satisfiable by *not* wiring `creditCheck`/`creditDeduct` onto the weekly-review path (those are a completely separate system from `ai_cost_log` — confirmed by direct inspection of `creditGate.ts`), but there is currently no column to record *which* autonomous system produced a given cost row, which OPS-03 (Phase 47) will need across every autonomous caller. Recommend Phase 44 ship the `source` column now (small, additive migration) rather than let Phase 47 retrofit it after multiple call sites already exist without it.

Fourth, the phase's own "existing frequently-hit app-open read endpoint" premise (D-01/Claude's Discretion) does not have a clean, obviously-correct answer in this codebase today — direct inspection of every route hit during mobile app-open found no single endpoint that is simultaneously (a) backend-routed (needed for `waitUntil()`), (b) hit on literally every app open, and (c) semantically in the athlete-coaching domain. The two closest real candidates and the recommended resolution are documented in Architecture Patterns below.

**Primary recommendation:** Reuse `onboarding-retroactive.ts`'s `generateObject` + sanitizer + `record_athlete_decision()` pattern verbatim for the weekly-review decision call; capture `next_review_due_at` before firing and derive `week_of` from it (never from `CURRENT_DATE` at fire time); ship a `source` column on `ai_cost_log` and a small RPC extension so onboarding also stamps the first `next_review_due_at`; wire the lazy-trigger due-check into a new sibling hook at the exact same universal mount point as `apps/mobile/app/(app)/_layout.tsx`'s existing `useBrandingBootstrap()`, calling a new minimal `coaching-engine` route rather than repurposing an unrelated coach/AI-tip endpoint.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Weekly review trigger detection (due-check) | API / Backend (new `coaching-engine` route) | Browser/Client (mounts the check via a bootstrap hook) | Firing `waitUntil()` background work requires a live serverless function invocation — the check must be server-side even though the mobile app is what causes it to run |
| Real-activity aggregation (ENGINE-01) | API / Backend | Database / Storage | Aggregation logic mirrors `fetchUserContext`/`fetchActivityAggregates` — backend-computed from Postgres reads, never trusted from client or LLM |
| Decision generation (ENGINE-02/03) | API / Backend | — | Single-shot `generateObject` call, no client or DB involvement beyond supplying the prompt data |
| Decision write / idempotency (ENGINE-04) | Database / Storage | API / Backend | The unique-index + `ON CONFLICT DO NOTHING` guarantee lives in Postgres; the backend caller only supplies correct inputs (correctly-derived `week_of`) |
| `create_goal`/`create_program` tool execution (ENGINE-06) | API / Backend | Database / Storage | Tool executors are backend functions; writes still funnel through the DB-level RPC lockdown |
| AI cost accounting (ENGINE-05) | Database / Storage | API / Backend | `ai_cost_log` insert is backend-fired but the accounting/reporting boundary (opex vs credit-funded) is a DB-schema-level distinction (`source` column) |
| In-app "Ziko reviewed your week" reveal (D-03) | Browser/Client (mobile) | API / Backend (data it reads) | Pure presentation reading `athlete_state.last_review_at`/`current_focus_summary`, no new backend logic beyond what already exists |

## Project Constraints (from CLAUDE.md)

- Backend ESM import rule: every relative import in new `backend/api/src/coaching-engine/*.ts` files must end in `.js`, even for `.ts` sources.
- AI SDK v6 conventions: `inputSchema` not `parameters` (for the SDK `tool()` wrapper used by interactive-chat registration — note the internal `AITool.parameters` field name in `tools/registry.ts` is a pre-existing, unrelated naming convention, not the SDK's); `stopWhen`/`isStepCount` not `maxSteps` (not applicable to the weekly review itself, which uses `generateObject`, not a tool-calling loop — only relevant if `create_goal`/`create_program` are also exposed to the interactive `/ai/chat(/stream)` orchestrator, which they should be per ENGINE-06); `input`/`output` not `args`/`result` in tool callbacks.
- Models: `AGENT_MODEL`/`VISION_MODEL` centralized in `backend/api/src/config/models.ts` — any new step-count or model constant for this phase (if needed) must be added there, not hardcoded.
- Never edit an existing Supabase migration — always add a new one, `YYYYMMDDHHMMSS_description.sql` timestamp format.
- Design tokens/no-dark-mode/mobile inline-style conventions apply to the D-03 celebration overlay UI.
- `showAlert` from `@ziko/plugin-sdk`, never `Alert` from `react-native`, if any error/confirmation UI is needed.

## Standard Stack

### Core

No new runtime dependencies — this phase is 100% composition of what Phase 42/43 already exercise in production.

| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` | `^6.0.116` [VERIFIED: npm registry — `npm view ai@6 version` confirms 6.0.275 is current-in-major, installed range still valid] | `generateObject`, `jsonSchema` | Already used identically by `onboarding-retroactive.ts`'s single-shot decision call — direct precedent, not a new pattern |
| `@ai-sdk/anthropic` | `^3.0.58` [VERIFIED: npm registry — `npm view @ai-sdk/anthropic@3 version` confirms 3.0.116 current-in-major] | Claude provider via `AGENT_MODEL` | Same centralized model constant every other AI route uses |
| `@ai-sdk/provider-utils` | transitive (via `ai`/`@ai-sdk/anthropic`) | `zodSchema()` for schema conversion | Already imported directly in `onboarding-retroactive.ts` for the Anthropic-schema-sanitizer pattern this phase must reuse |
| `@vercel/functions` | `^3.6.0` [VERIFIED: npm registry — 3.9.5 latest, installed range valid] | `waitUntil()` | Already used 3x elsewhere in this backend (`push-events.ts`, `coach/programs`, `coach/clients`) — direct precedent for the lazy-trigger fire-and-forget |
| Zod | `^4.3.6` (backend) | Decision-schema definition, converted via `zodSchema()`/sanitizer, never passed directly to `generateObject`'s `schema` for an Anthropic call | `onboarding-retroactive.ts`'s `RetroactiveProfileZod` is the direct template |
| Supabase Postgres (existing) | — | `athlete_state`, `athlete_decisions`, new `athlete_goals` | Already live; this phase adds one table + extends one RPC |

### Supporting

None new. `zodSchema` is already a transitive dependency exercised by the exact pattern this phase copies.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single-shot `generateObject` for the weekly decision | Multi-step tool-calling agent (`streamText` + `stopWhen`) inside the cron | Explicitly rejected by STATE.md's locked architecture decision and by the `monitor-cron`/onboarding-retroactive precedent — higher latency/cost per athlete for no benefit since all input data is pre-fetched |
| Extending `record_athlete_decision()` with an optional new-goal parameter | A second, parallel `create_athlete_goal()` SECURITY DEFINER RPC | Extending keeps "one write door" intact (Phase 42's D-06/D-07 doctrine) and gives atomicity for free; a second RPC risks the two tables drifting out of sync on partial failure. Recommended: extend. |

**Installation:**
```bash
# Nothing new to install. Confirm currency only:
npm view ai@6 version
npm view @ai-sdk/anthropic@3 version
npm view @vercel/functions version
```

**Version verification:** All three confirmed current-within-installed-major via direct `npm view` this session (see table above). No `package.json` changes required for this phase.

## Package Legitimacy Audit

**Not applicable — this phase installs zero new external packages.** Every dependency used (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/provider-utils`, `@vercel/functions`, `zod`) is already installed and already exercised by shipped Phase 42/43 code in this exact repository. The Package Legitimacy Gate protocol (slopcheck, registry cross-check) is scoped to *new* package installs and is skipped here by design, not by omission.

## Architecture Patterns

### System Architecture Diagram

```
MOBILE (Expo) ─────────────────────────────────────────────────────────────
  apps/mobile/app/(app)/_layout.tsx (AppLayout, mounts on EVERY app open)
    ├─ useBrandingBootstrap()            [existing, unrelated — coach theme]
    └─ useCoachingEngineBootstrap()      [NEW — mirrors the above exactly]
         │ GET /coaching-engine/review-check  (fire-and-forget, ignores response)
         ▼
BACKEND (Hono, Vercel serverless) ──────────────────────────────────────────
  backend/api/src/coaching-engine/  (NEW module, mirrors coach/* module shape)
    ├─ routes.ts
    │    GET  /review-check   — cheap due-check + waitUntil() fire (D-01 primary trigger)
    │    POST /cron/weekly-review  — CRON_SECRET-gated safety net (D-01 secondary trigger)
    │         │  auth: CRON_SECRET bearer, defined BEFORE authMiddleware
    │         ▼
    ├─ context.ts
    │    fetchWeeklyReviewContext(userId)
    │      1. read athlete_state (captures next_review_due_at, current_focus_detail, readiness)
    │      2. read rolling_summary + last 4 athlete_decisions (FOUND-05 bounded window)
    │      3. read ONLY the table(s) current_focus_detail.focus_type maps to (D-08)
    │         ▼
    ├─ decide.ts
    │    generateObject({ model: AGENT_MODEL, schema: WEEKLY_DECISION_SCHEMA (sanitized), ... })
    │      → { trajectory: 'escalate'|'hold'|'de-escalate', new_readiness, rationale,
    │           call_create_program: boolean, new_focus_detail? }
    │         ▼
    ├─ apply.ts
    │    applyWeeklyDecision(userId, decision, evidence, weekOf, source)
    │      → db.rpc('record_athlete_decision', { p_decision_type:'weekly_focus',
    │                p_week_of: weekOf /* captured, not CURRENT_DATE */, p_source, ... })
    │      → if trajectory != 'hold': calls create_program executor (D-11)
    │      → logs AI cost to ai_cost_log with source='weekly_review_cron'
    │         ▼
    └─ tools.ts
         create_goal   (new RPC-extension write → athlete_goals + athlete_state.current_focus_detail.goal_id)
         create_program (writes athlete_state.current_focus_detail training targets)
         — BOTH registered in tools/registry.ts's `executors` map AND spread into
           `allToolSchemas` (unlike assess_profile) so /ai/chat(/stream) can call
           them interactively too (ENGINE-06)
         ▼
SUPABASE (Postgres + RLS) ───────────────────────────────────────────────────
  athlete_state / athlete_decisions      (live, Phase 42 — unmodified table shape)
  record_athlete_decision()              (live, Phase 42 — EXTENDED this phase:
                                           adds p_new_goal param + onboarding
                                           next_review_due_at stamp)
  athlete_goals                          (NEW — SELECT-only RLS, write via the
                                           extended RPC only, same lockdown
                                           doctrine as athlete_state/decisions)
  ai_cost_log                            (existing — EXTENDED this phase: adds
                                           `source` column)
  + existing per-domain tables read for evidence: workout_sessions/session_sets,
    habit_logs/journal_entries, nutrition_logs/hydration_logs
```

### Recommended Project Structure

```
backend/api/src/coaching-engine/
├── routes.ts       # GET /review-check, POST /cron/weekly-review (mounted in app.ts)
├── context.ts       # fetchWeeklyReviewContext() — mirrors coach/ai/context.ts's
│                     # "each orchestrator surface gets its own context builder"
├── decide.ts        # generateObject call + Zod schema + Anthropic sanitizer
├── apply.ts          # applyWeeklyDecision() — the ONE function both the cron
│                     # and (indirectly, via create_goal/create_program tool
│                     # executors) interactive chat call
├── tools.ts          # create_goal, create_program schemas + executors
├── db.ts             # clientForUser() re-export + athlete_goals queries
└── types.ts

apps/mobile/app/(app)/_layout.tsx        # MODIFIED: add useCoachingEngineBootstrap()
apps/mobile/app/(app)/index.tsx           # MODIFIED (or new component): D-03 celebration
                                          # detection, reusing 43's useFocusEffect re-poll
                                          # pattern against athlete_state.last_review_at
supabase/migrations/
├── <ts>_athlete_goals.sql                # NEW table, SELECT-only RLS, REVOKE lockdown
├── <ts>_record_athlete_decision_v2.sql   # CREATE OR REPLACE: add p_new_goal param,
│                                         # stamp next_review_due_at on onboarding_profile
└── <ts>_ai_cost_log_source.sql           # ADD COLUMN source TEXT NOT NULL DEFAULT 'user_chat'
```

### Pattern 1: Single-shot `generateObject` decision call (ENGINE-02) — reuse `onboarding-retroactive.ts` verbatim

**What:** The weekly decision is produced by exactly the pattern Phase 43 already shipped and validated in production for a structurally identical problem (infer a structured judgment from pre-aggregated real activity, write via `record_athlete_decision()`).
**When to use:** Every weekly-review invocation, both the lazy on-open path and the cron safety-net path — same function, different `source` argument passed to `record_athlete_decision()` (`'app_open_fallback'` vs `'weekly_review_cron'`, both already valid enum values on the live `athlete_decisions.source` CHECK constraint).
**Load-bearing gotcha (verified this session, not in prior project-root research):** `@ai-sdk/provider-utils`' `zodSchema()` adds JSON Schema keywords (`minimum`, `maximum`, `minLength`, etc.) that Anthropic's structured-output endpoint rejects. `onboarding-retroactive.ts` already carries a working `stripUnsupportedKeywords()`/`anthropicSchema<T>()` pair — copy it into `coaching-engine/decide.ts` rather than re-deriving it; the banned-keyword set is `{minimum, maximum, exclusiveMinimum, exclusiveMaximum, minLength, maxLength, minItems, maxItems, multipleOf, $schema, format}`.

**Example:**
```typescript
// Source: backend/api/src/tools/onboarding-retroactive.ts (live, shipped Phase 43)
import { generateObject, jsonSchema } from 'ai';
import { zodSchema } from '@ai-sdk/provider-utils';
import { z } from 'zod';

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

// Weekly-decision schema — adapt from RetroactiveProfileZod's shape
const WeeklyDecisionZod = z.object({
  trajectory: z.enum(['escalate', 'hold', 'de-escalate']),
  new_readiness: z.enum(['fragile', 'building', 'ready']),
  rationale: z.string(),
  call_create_program: z.boolean(), // D-11: only true on escalate/de-escalate
});
```

### Pattern 2: `week_of` must be a captured value, not `CURRENT_DATE` at fire time (ENGINE-04)

**What:** `record_athlete_decision()`'s idempotency arbiter is `UNIQUE (user_id, decision_type, week_of) WHERE decision_type = 'weekly_focus'`. The function does not compute `week_of` — the caller supplies it as `p_week_of`.
**Why it matters:** The lazy on-open trigger can fire at any point after `next_review_due_at` passes (an athlete might not open the app for 3 days after their review became due); the Sunday cron safety net fires on a fixed schedule. If either path derives `week_of` from `CURRENT_DATE`/`NOW()` at the moment it happens to run, the two paths compute *different* values for logically the same review cycle, and both inserts succeed — silently violating ENGINE-04 (exactly the "at-least-once redelivery causes a duplicate" failure mode this milestone has explicitly avoided once already, per STATE.md's v1.4 lazy-reset precedent).
**Correct pattern:** Both the on-open route and the cron read `athlete_state.next_review_due_at` *before* calling `generateObject`, and derive `p_week_of` deterministically from that captured value (e.g. `date_trunc('day', next_review_due_at)::date`), never from wall-clock "now" at fire time. Whichever trigger reads the row first and starts processing is racing against the DB's `ON CONFLICT DO NOTHING`, not against each other's clocks.

```typescript
// Source: pattern derived from supabase/migrations/20260831120200_athlete_decisions_rpc.sql
// (live RPC body, read this session)
const { data: state } = await db
  .from('athlete_state')
  .select('next_review_due_at')
  .eq('user_id', userId)
  .single();

if (!state?.next_review_due_at || new Date(state.next_review_due_at) > new Date()) {
  return; // not due — cheap no-op, exits before any model call
}

const weekOf = state.next_review_due_at.slice(0, 10); // capture BEFORE the model call,
                                                        // never recompute from Date.now()
// ... fetchWeeklyReviewContext(), generateObject(), then:
await db.rpc('record_athlete_decision', {
  p_decision_type: 'weekly_focus',
  p_week_of: weekOf,
  // ...
});
```

### Pattern 3: Tool registration split — `assess_profile` (onboarding-only) vs `create_goal`/`create_program` (dual-surface)

**What:** `tools/registry.ts` already demonstrates two different registration shapes. `assess_profile` is registered **only** in the `executors` map (so `getToolExecutor('assess_profile')` works) but deliberately **excluded** from `allToolSchemas` — confirmed live at `registry.ts:176-182` with an explicit comment: *"assess_profile is deliberately absent from allToolSchemas below (Phase 43 plan 01)."* `create_goal`/`create_program` need the opposite: ENGINE-06 explicitly requires them "usable by both the weekly hebdo engine and the interactive chat," so they must be spread into `allToolSchemas` (making them available to `/ai/chat` and `/ai/chat/stream`'s general tool-calling loop) **and** registered in `executors`.
**Cron caller distinction:** the weekly-review cron does **not** go through the AI-SDK `tool()` wrapper at all (there is no tool-calling loop in a `generateObject` call) — `apply.ts` calls the underlying executor function (or a shared helper both the tool `execute` callback and `apply.ts` delegate to) directly in code, using the structured decision `generateObject` returned. This is what "one shared write path... can never diverge" (CONTEXT.md's own framing) means concretely: the AI-SDK tool wrapper for `create_program` and the cron's direct call both bottom out in the exact same executor function.

```typescript
// Source: backend/api/src/tools/registry.ts (live, lines 583-598 for allToolSchemas assembly)
export const allToolSchemas: AITool[] = [
  ...habitsToolSchemas,
  // ... existing entries ...
  ...coachToolSchemas,
  ...coachingEngineToolSchemas, // NEW — create_goal, create_program (NOT assess_profile-style exclusion)
];
// executors map (line ~134) gains:
//   create_goal: CoachingEngineTools.create_goal,
//   create_program: CoachingEngineTools.create_program,
```

### Pattern 4: Extending `record_athlete_decision()` rather than adding a parallel RPC (D-09)

**What:** `athlete_goals` needs an atomic write alongside the existing `athlete_decisions` insert + `athlete_state` patch, for the same reason the original RPC does both in one transaction — a partial failure (goal row written, decision/state not) would leave `current_focus_detail.goal_id` dangling.
**Recommendation:** Ship a new migration that `CREATE OR REPLACE FUNCTION public.record_athlete_decision(...)` (functions can be safely redefined; this does not require dropping/recreating the table-level lockdown) adding one new optional parameter, e.g. `p_new_goal JSONB DEFAULT NULL`. When non-null, the function inserts into `athlete_goals` inside the same transaction, before applying the `p_state_patch` (so `current_focus_detail.goal_id` can reference the just-created row). This preserves Phase 42's explicit "one write door" doctrine (D-06/D-07: *"If an admin-correction path is needed later, it should call record_athlete_decision() too... not bypass it"*) rather than introducing a second SECURITY DEFINER function that needs its own independent grant-lockdown audit.
**Same migration should also fix the `next_review_due_at` gap:** add `next_review_due_at = CASE WHEN p_decision_type IN ('weekly_focus', 'onboarding_profile') THEN NOW() + INTERVAL '7 days' ELSE next_review_due_at END` (currently only `weekly_focus` advances it) — this is what makes D-02's "rolling from onboarding completion date" literally true; without this fix, every athlete's `next_review_due_at` stays `NULL` until their *second* ever decision, and the due-check has to special-case `NULL` in application code instead of relying on the DB column.

### Pattern 5: The lazy-trigger mount point (D-01/Claude's Discretion — resolved)

**What was checked (direct inspection, this session):** every mobile call site that fires on app open was read to find a genuinely universal, backend-routed, cheap trigger point.
- `POST /ai/chat` (via `useAIDailyTip`, home screen) — **rejected**: cached per calendar day (`ai_tip_${TODAY}` key in MMKV/AsyncStorage), so it does **not** fire on the 2nd+ app open of the same day; also `creditCheck`/`creditDeduct`-gated, an unrelated coupling to introduce into a due-check.
- `POST /notifications/token` (via `useNotificationSetup`) — fires on most, not all, app opens (only once notification permission is already granted; a fresh install with permission not yet granted never hits it). Semantically unrelated domain.
- `GET /coach/clients/links/me` (via `useBrandingBootstrap`, mounted unconditionally in `AppLayout` for every authenticated `userId`) — the **only** candidate confirmed to fire on literally every `(app)` layout mount, backend-routed, `staleTime: 30_000` so it also re-fires on foreground-after-backgrounding. Semantically belongs to the coach-clients module, not coaching-engine.

**Recommendation:** Do not repurpose `/coach/clients/links/me`'s handler (crosses an unrelated module boundary). Instead, add a **sibling** hook in the exact same file (`apps/mobile/app/(app)/_layout.tsx`), copying `useBrandingBootstrap()`'s shape 1:1 (same `useQuery` + `useEffect` structure, same unconditional-per-authenticated-user mount timing), calling a new minimal `GET /coaching-engine/review-check` route. This achieves "runs on every app open, cheap, backend-routed" without either (a) polluting the coach module or (b) depending on an endpoint that skips fires (daily tip, notification token). The new route itself does one indexed `SELECT next_review_due_at FROM athlete_state WHERE user_id = $1`, and only if due does it call `waitUntil()` — everything else (the actual `generateObject` + `apply.ts` work) happens after the response is already sent.

### Anti-Patterns to Avoid

- **Deriving `week_of` from `CURRENT_DATE`/`Date.now()` at fire time instead of from the captured `next_review_due_at`:** silently breaks ENGINE-04's idempotency guarantee under the exact at-least-once/concurrent-trigger conditions this milestone is designed to survive. See Pattern 2.
- **Calling `generateObject` before checking for an existing `weekly_focus` decision this cycle:** the RPC's `ON CONFLICT DO NOTHING` guarantees *correctness* (only one write survives) but not *cost efficiency* — two near-simultaneous triggers (e.g. lazy-trigger + cron landing in the same window) will both pay for a full Claude Sonnet call before one of them discovers it was a no-op. Recommended (not required) optimization: a cheap pre-check `SELECT 1 FROM athlete_decisions WHERE user_id=$1 AND decision_type='weekly_focus' AND week_of=$2` before the model call, mirroring `computeRetroactiveProfile()`'s existing-state guard pattern.
- **Passing a raw Zod schema straight to `generateObject({ schema: MyZodSchema })` for an Anthropic-backed call:** will intermittently fail with an Anthropic API error on any field using `.int()`, `.min()`, `.max()`, etc. Always route through the `anthropicSchema()`/`stripUnsupportedKeywords()` sanitizer already proven in `onboarding-retroactive.ts`.
- **Building a second SECURITY DEFINER RPC for `athlete_goals` instead of extending `record_athlete_decision()`:** doubles the grant-lockdown audit surface (each new RPC needs its own `REVOKE`/`GRANT EXECUTE` verification, per Phase 42's own precedent of discovering and fixing a missed `anon` grant) and reintroduces a two-write-path atomicity risk Phase 42 was specifically designed to prevent.
- **Copying `monitor-cron`'s sequential per-coach `for` loop verbatim for the Sunday safety-net cron:** already flagged repeatedly across the project-root research (SUMMARY/ARCHITECTURE/STACK/PITFALLS) — that pattern has zero LLM calls in its loop body and is safe only for that reason; this phase's safety-net cron has exactly one LLM call per athlete and must batch with bounded concurrency instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Idempotent per-athlete-per-week write | A custom "already processed?" flag column checked-then-set in two round trips | The existing `UNIQUE (user_id, decision_type, week_of) WHERE ...` partial index + `ON CONFLICT DO NOTHING` inside `record_athlete_decision()` | Already live, already atomic (single transaction), already proven correct by Phase 42's own empirical role-switching verification |
| JSON-Schema-from-Zod for a structured Anthropic call | A hand-rolled JSON Schema object for the decision shape | `zodSchema()` + the existing `stripUnsupportedKeywords()` sanitizer | Zod gives type-safe `object` destructuring on the `generateObject` result; hand-rolling risks the exact keyword-rejection bug this pattern already solves |
| Background "fire and don't block the response" dispatch | A manual `setTimeout`/detached promise that Vercel may kill before completion | `waitUntil()` from `@vercel/functions` | Already the established codebase idiom (3 existing call sites); guarantees the function instance stays alive for the deferred work per Vercel's own documented contract |
| Real-activity aggregation per focus type | A single "fetch everything" context builder shared with general chat | A dedicated `fetchWeeklyReviewContext()` in `coaching-engine/context.ts`, scoped per `current_focus_detail.focus_type` | Matches the already-established "each orchestrator surface gets its own context builder" convention (`coach/ai/context.ts` is already separate from `context/user.ts`; `onboarding-retroactive.ts`'s `fetchActivityAggregates()` is its own function too) |

**Key insight:** every "don't hand-roll" item in this phase already has a working, shipped implementation somewhere in this exact codebase from Phase 42 or Phase 43 — this phase is composition and careful reuse, not new-pattern invention.

## Common Pitfalls

### Pitfall 1: `week_of` computed at fire time instead of captured from `next_review_due_at`

**What goes wrong:** ENGINE-04's idempotency guarantee (exactly-one-decision-per-athlete-per-week) silently breaks under the specific at-least-once/dual-trigger conditions this milestone exists to survive.
**Why it happens:** It is the natural-looking implementation — "what week is it" reads as `new Date()`/`CURRENT_DATE` unless the engineer specifically traces through `record_athlete_decision()`'s unique-index arbiter and realizes the caller, not the function, is responsible for supplying a value that's stable across both trigger paths.
**How to avoid:** See Architecture Patterns, Pattern 2. Both the on-open route and the cron must read and pass through the same captured `next_review_due_at` value.
**Warning signs:** Two `athlete_decisions` rows with `decision_type='weekly_focus'` for the same athlete within a few days of each other, with different `week_of` values.

### Pitfall 2: `zodSchema()`'s implicit JSON-Schema keywords rejected by Anthropic's structured-output endpoint

**What goes wrong:** Any `generateObject` call whose Zod schema includes `.int()`, `.min()`, `.max()`, or similar numeric-range/length constraints fails at the Anthropic API layer with a schema-validation error, intermittently-looking (it depends on which fields the model path happens to include).
**Why it happens:** `@ai-sdk/provider-utils`' `zodSchema()` conversion adds `minimum`/`maximum`/etc. into the generated JSON Schema even when the Zod type itself doesn't look like it should produce them; Anthropic's endpoint does not accept these keywords in a tool/structured-output schema.
**How to avoid:** Reuse the exact `stripUnsupportedKeywords()`/`anthropicSchema<T>()` pair already shipped in `onboarding-retroactive.ts` (and mirrored in `coach/voice/service.ts`, `coach/imports/parse/claude.ts` per that file's own header comment) rather than passing a raw Zod schema to `generateObject`.
**Warning signs:** A `generateObject` call that works in isolated testing with a simple schema but fails once numeric confidence/count fields are added.

### Pitfall 3: `ai_cost_log` has no column to distinguish opex-funded autonomous calls from user-initiated ones

**What goes wrong:** ENGINE-05 requires the weekly engine's cost be visible and distinguishable as platform opex; today's `ai_cost_log` schema (`user_id, model, input_tokens, output_tokens, created_at`) cannot express "which system produced this row" at all.
**Why it happens:** Every prior AI route logs identically-shaped rows because, until this phase, every AI cost was either user-initiated-and-credit-gated or (for `coach/ai`) coach-initiated-and-credit-gated — there was never a need to distinguish autonomous-system cost from user cost in the same table.
**How to avoid:** Ship a small additive migration: `ALTER TABLE ai_cost_log ADD COLUMN source TEXT NOT NULL DEFAULT 'user_chat'` (backfills existing rows safely), with the weekly-review's cost-logging call passing `source: 'weekly_review_cron'` or `'app_open_fallback'` matching whichever trigger fired it. This also directly de-risks Phase 47's OPS-03 (broader `ai_cost_log` coverage across all autonomous calls), which would otherwise need to retrofit this column after more call sites exist without it.
**Warning signs:** No way to answer "how much did the weekly engine cost this month" without joining against `athlete_decisions.source`, which is a much less precise join (a decision row doesn't 1:1 map to a cost row, and holds no token counts).

### Pitfall 4: `next_review_due_at` stays `NULL` after onboarding, not "due now"

**What goes wrong:** A freshly-onboarded athlete's `athlete_state.next_review_due_at` is `NULL` (the column's default) because `record_athlete_decision()` only advances it `WHEN p_decision_type = 'weekly_focus'` — Phase 43's `onboarding_profile` decision never touches it. A due-check written as `next_review_due_at <= now()` will never fire for any athlete who hasn't already had at least one weekly review, which is every athlete, forever, unless `NULL` is special-cased.
**Why it happens:** The RPC's `next_review_due_at`-advancing logic was written correctly for the *steady-state* weekly cadence but was never extended to cover the *bootstrap* case, because Phase 42 shipped before Phase 44 existed to need it.
**How to avoid:** Preferred fix (see Pattern 4): extend the RPC itself so `p_decision_type = 'onboarding_profile'` also stamps `next_review_due_at = NOW() + INTERVAL '7 days'`, making D-02's "rolling from onboarding completion date" literally true at the data layer. Acceptable fallback if the RPC extension is deferred: the due-check application code treats `next_review_due_at IS NULL` as due, but this is strictly worse — it computes "due" from the read-time NULL rather than from a real onboarding-anchored date, so the first review's cadence wouldn't actually roll from onboarding completion the way D-02 specifies.
**Warning signs:** Zero weekly-review decisions ever appear for any athlete in manual/QA testing, even after simulating a week of elapsed time, because the due-check condition never evaluates true.

### Pitfall 5: Confusing which field the weekly engine escalates/de-escalates — `readiness` vs `level`

**What goes wrong:** `athlete_state` has both a 3-value `readiness` enum (`fragile`/`building`/`ready`) and an unbounded `level` integer. ENGINE-03's "escalate/de-escalate the trajectory" and Phase 42's own stated design intent both point at `readiness` as the field this phase should write, but `level` also exists and is what Phase 46's `PluginManifest.minLevel` gating will read. Writing the wrong field (or both, redundantly) risks entangling this phase's scope with Phase 45's reward-driven `level`/`points`/`tier` progression, which is supposed to be a separate, later concern.
**Why it happens:** Nothing in CONTEXT.md/ROADMAP.md explicitly states "the weekly engine writes `readiness`, not `level`" — it's an inference from Phase 42's own column comment (*"gives Phase 44's escalate/de-escalate logic a first-class field to read and update"*, attached specifically to `readiness`) plus the `level`/`points`/`tier` ratchet behavior in the live RPC (points/tier are `GREATEST`-ratcheted — a reward-accrual pattern; `level` is freely settable — consistent with either reading, unhelpfully).
**How to avoid:** Recommend (Open Question below, flagged for explicit confirmation during planning, not auto-decided here): Phase 44's `p_state_patch` sets `readiness` and `current_focus_summary`/`current_focus_detail` only. `level`/`points`/`tier` remain untouched by this phase — Phase 45 separately reads the `weekly_focus` decision's outcome (met/exceeded/missed, embedded in `evidence`/`outcome`) to compute its own `reward_grant` decision with its own `p_state_patch`. This keeps the phase boundary clean and matches REWARD-01's framing that points/tiers are earned "selon le résultat de la revue hebdo," i.e. downstream of this phase's output, not decided within it.
**Warning signs:** Phase 45 planning discovers the weekly engine already mutated `level`/`points` and now needs to reconcile two writers of the same field, or Phase 46's gating check reads a `level` value the weekly engine never actually updates (still stuck at onboarding's `level=1`).

## Code Examples

### Weekly-review due-check + `waitUntil()` fire (D-01, backend route)

```typescript
// Source: pattern composed from live backend/api/src/routes/push-events.ts's
// waitUntil() usage + the live record_athlete_decision RPC contract
import { waitUntil } from '@vercel/functions';
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { runWeeklyReview } from './apply.js';

const router = new Hono();
router.use('*', authMiddleware);

router.get('/review-check', async (c) => {
  const { userId } = c.get('auth');
  const userToken = c.req.header('Authorization')?.slice(7);

  waitUntil(
    (async () => {
      const due = await checkAndFireIfDue(userId, userToken, 'app_open_fallback');
      // due-check + weekly-review execution both happen here, after response is sent
    })(),
  );

  return c.json({ ok: true }); // respond immediately — never block on the review
});
```

### `create_goal` executor writing through the extended RPC (D-09, ENGINE-06)

```typescript
// Source: pattern derived from backend/api/src/tools/onboarding.ts's
// assess_profile executor shape (43-PATTERNS.md), adapted for the new
// p_new_goal parameter (Architecture Patterns, Pattern 4)
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
    p_rationale: params.rationale,
    p_evidence: params.evidence, // caller-supplied grounding — mandatory per FOUND-02
    p_outcome: { goal_text: params.goal_text, target_date: params.target_date },
    p_source: params.source ?? 'onboarding_tool', // or 'weekly_review_cron' from apply.ts
    p_state_patch: { current_focus_detail: { goal_id: '$NEW_GOAL_ID' } }, // RPC fills the real id
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

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Project-root research's `athlete_state`/`athlete_decisions` as a *draft* schema (ARCHITECTURE.md) | Live, shipped schema with `readiness` (not `track`), stricter RLS than either drafted precedent, DB-level REVOKE lockdown | Phase 42, 2026-08-31 | This phase must build against the live column/RPC shape (documented above), not the ARCHITECTURE.md draft, which predates a `track`-column cut (D-03 of Phase 42) and other refinements |
| Project-root STACK.md's generic `generateObject`/Anthropic guidance | A concrete, working, sanitizer-equipped implementation exists (`onboarding-retroactive.ts`) | Phase 43, 2026-09-01 | Removes ambiguity about *how* to call `generateObject` safely against Anthropic — copy the shipped pattern, don't re-derive from the SDK docs alone |

**Deprecated/outdated:** none — no library or pattern in this phase's scope has been superseded since the project-root research was written; the changes above are refinements/concretizations, not reversals.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Pattern of misses" for de-escalation should be a small recent-window rule (e.g. 2-of-last-3 weeks) — no consumer-fitness-app or clinical-precedent number was found this session beyond the project-root research's own already-flagged LOW-confidence inference from behavioral-health literature | Open Questions | If the actual window is materially different (e.g. requires 4+ weeks), athletes could feel punished too quickly or the "slow de-escalate" promise (D-05) could feel meaningless if it's effectively immediate |
| A2 | The weekly engine should write `athlete_state.readiness` (not `level`/`points`/`tier`) — inferred from Phase 42's column comment, not explicitly stated anywhere in Phase 44's CONTEXT.md | Common Pitfalls #5, Open Questions | If Phase 45/46 actually expect the weekly engine to move `level` directly, this phase's `apply.ts` would need rework once that dependency surfaces |
| A3 | `GET /coaching-engine/review-check` as a new minimal route (rather than repurposing an existing endpoint) satisfies D-01's "cheap read that already runs every app open" framing closely enough — it's a new network call, not literally an existing one, but mounted at the same universal trigger point as the one true "every app open" precedent found (`useBrandingBootstrap`) | Architecture Patterns, Pattern 5 | If the product intent was strictly "zero new requests, only piggyback existing traffic," this recommendation adds one small new GET call per app open instead |
| A4 | Vercel Fluid Compute enablement status for this project remains genuinely unverified — no account/dashboard access available from the repository alone; this session found no new evidence beyond what project-root STACK.md/ARCHITECTURE.md already flagged as MEDIUM confidence | Environment Availability | If Fluid Compute is actually already enabled, the conservative `maxDuration=60`-without-Fluid-Compute recommendation below is unnecessarily cautious (but not wrong — it still works); if it's not enabled, assuming it is would break the cron at deploy time |

## Open Questions

1. **Does the weekly engine write `athlete_state.readiness`, `level`, or both?**
   - What we know: Phase 42's own column comment ties `readiness` explicitly to "Phase 44's escalate/de-escalate logic"; `level`/`points`/`tier` have ratchet semantics in the live RPC that read more naturally as a Phase 45 reward-accrual concern.
   - What's unclear: CONTEXT.md never states this explicitly — ENGINE-03 just says "peut escalader ou désescalader" without naming the column.
   - Recommendation: default to `readiness`-only for this phase (Common Pitfalls #5); confirm explicitly during planning/discuss before implementation, since it affects `apply.ts`'s `p_state_patch` shape and Phase 45's planning assumptions.

2. **Exact numeric "pattern of misses" window for de-escalation (D-05).**
   - What we know: Must not be a single missed week; must be "a pattern" per the locked product decision; no direct consumer-fitness-app precedent exists (already flagged LOW confidence at the project-root research level).
   - What's unclear: The exact N-of-M window.
   - Recommendation: 2-of-last-3 weekly-review cycles showing "missed," read from the bounded recent-window `athlete_decisions` rows (FOUND-05 convention already caps this at ~4 rows) — small enough to implement against the existing bounded-context read, permissive enough that D-05's "not punished for one bad week" promise is meaningfully true. Treat as `[ASSUMED]` (A1 above) pending explicit confirmation.

3. **Should the lazy-trigger `GET /coaching-engine/review-check` route require any request body/params, or is bare-auth sufficient?**
   - What we know: The check only needs `userId` (from `authMiddleware`) and reads `athlete_state.next_review_due_at`.
   - What's unclear: Whether the mobile client should pass anything else (e.g. current locale, for the eventual celebration copy) or whether that's better read server-side from `user_profiles` at fire time.
   - Recommendation: bare-auth GET is sufficient; locale/copy concerns belong to D-03's celebration UI, which reads `athlete_state` directly (client-side, RLS-scoped), not to this route's request shape.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vercel Cron (Pro-tier scheduling) | D-01 secondary trigger (Sunday safety-net cron) | ✓ | — confirmed: 8 crons already run in `backend/api/vercel.json`, including the sub-daily/weekly-cadence `weekly-digest` (`0 9 * * 0`) | — |
| Vercel Fluid Compute / extended `maxDuration` | Bounded-concurrency batch sizing for the safety-net cron at scale | **Unverified** — no `functions` block in `vercel.json`; three existing routes (`coach/voice`, `coach/imports`, `coach/videos`) each declare `export const maxDuration = 60` inline, with no evidence any route exceeds 60s or that Fluid Compute's extended ceiling (up to 800s) has ever been exercised on this project | — | Recommended: do NOT depend on Fluid Compute being enabled. Set `export const maxDuration = 60` on the new safety-net cron route (matching the three existing precedents exactly) and cap the per-invocation batch (`LIMIT 30-50` athletes, processed in `Promise.allSettled` chunks of 8-10 concurrent single-shot `generateObject` calls at ~1-3s each). This comfortably fits inside 60s at current early-stage athlete volume (no evidence of a large athlete base per STATE.md) without needing platform-tier confirmation. Any athletes not reached in one invocation remain "due" (`next_review_due_at` stays in the past) and are picked up by the next Sunday's cron run or, more likely, by their own next app open via the lazy primary trigger — no data loss, just a later catch-up, consistent with the milestone's non-punitive posture. |
| `CRON_SECRET` env var | Safety-net cron auth guard | ✓ (already used by 8 existing cron routes) | — | — |
| `SUPABASE_SERVICE_KEY`/`SUPABASE_SERVICE_ROLE_KEY` | `record_athlete_decision()` EXECUTE (service_role-only grant) | ✓ (Phase 42-04-SUMMARY.md confirms this is required and already the operative pattern for `clientForUser()`) | — | — |

**Missing dependencies with no fallback:** none — Vercel Fluid Compute's exact status is unverified but has a fully-adequate fallback (conservative `maxDuration=60` + capped batch size) that doesn't block this phase.

**Missing dependencies with fallback:** Vercel Fluid Compute (see row above).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (`^3.x`, backend workspace) |
| Config file | `backend/api/vitest.config.ts` (`fileParallelism: false` — RLS suite mutates `auth.users`, must stay serialized) |
| Quick run command | `npx vitest run test/tools/coaching-engine.spec.ts` (new file, mirrors `test/tools/onboarding.spec.ts`/`retroactive-recompute.spec.ts`) |
| Full suite command | `npm run test` (from `backend/api/`) — `vitest run --passWithNoTests` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENGINE-01 | Real-activity comparison reads only the focus-mapped table(s) | unit | `npx vitest run test/tools/coaching-engine.spec.ts -t "activity aggregation"` | ❌ Wave 0 |
| ENGINE-02 | `generateObject` decision call produces a valid, sanitized-schema structured decision | unit | `npx vitest run test/tools/coaching-engine.spec.ts -t "decision schema"` | ❌ Wave 0 |
| ENGINE-03 | Escalate/hold/de-escalate correctly updates `readiness` (per Open Question 1's resolution) | unit | `npx vitest run test/tools/coaching-engine.spec.ts -t "trajectory"` | ❌ Wave 0 |
| ENGINE-04 | Running the review twice for the same athlete/week produces exactly one decision | integration | `npx vitest run test/rls/athlete-decisions.spec.ts -t "weekly_focus idempotency"` (extend existing file) | ⚠️ File exists, new test case needed |
| ENGINE-05 | Weekly engine's `ai_cost_log` row has `source='weekly_review_cron'`/`'app_open_fallback'`, never touches `creditCheck`/`creditDeduct` | integration | `npx vitest run test/routes/coaching-engine.spec.ts -t "cost logging"` | ❌ Wave 0 |
| ENGINE-06 | `create_goal`/`create_program` callable identically from cron path and `/ai/chat` tool-call path | integration | `npx vitest run test/tools/coaching-engine.spec.ts -t "shared apply path"` | ❌ Wave 0 |
| D-09 (`athlete_goals` RLS) | Athlete reads own goals only; no client write path | RLS integration | `npx vitest run test/rls/athlete-goals.spec.ts` (new file, mirror `athlete-state.spec.ts`) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** targeted `npx vitest run <file> -t "<name>"` for the file(s) touched
- **Per wave merge:** `npm run test` (full backend suite, from `backend/api/`)
- **Phase gate:** Full suite green before `/gsd:verify-work`, plus a manual/scripted check that a duplicate-fire simulation (calling the review-check or cron-simulation path twice in quick succession for the same athlete/week) produces exactly one `athlete_decisions` row — mirrors Phase 42-04's own live empirical verification approach when a real `auth.users` test row is available.

### Wave 0 Gaps

- [ ] `backend/api/test/tools/coaching-engine.spec.ts` — covers ENGINE-01, ENGINE-02, ENGINE-03, ENGINE-06 (mirror `test/tools/onboarding.spec.ts` + `retroactive-recompute.spec.ts` structure)
- [ ] `backend/api/test/routes/coaching-engine.spec.ts` — covers ENGINE-05, the `review-check` route's due/not-due branching, and the `CRON_SECRET` guard on the safety-net cron (mirror `test/routes/onboarding.spec.ts`)
- [ ] `backend/api/test/rls/athlete-goals.spec.ts` — new table RLS (mirror `test/rls/athlete-state.spec.ts`)
- [ ] Extend `backend/api/test/rls/athlete-decisions.spec.ts` with a `weekly_focus` idempotency case (the existing file already covers `onboarding_profile`-shaped decisions per its name; the `weekly_focus` arbiter path is untested)
- [ ] A disposable-`auth.users`-row fixture path for the two functional-correctness RPC assertions Phase 42-04 explicitly deferred (`success: true` round-trip, duplicate-`weekly_focus`-returns-`error:'duplicate'`) — `backend/api/test/rls/fixtures.ts` already has the GoTrue Admin API user-creation helper Phase 42 recommended reusing; this phase is the first real opportunity to close that gap since it's the first phase that actually exercises the `weekly_focus` arbiter path end-to-end

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | yes | `authMiddleware` on `/review-check`; `CRON_SECRET` bearer check (defined before `authMiddleware`) on the safety-net cron route, identical to the live `monitor-cron`/`weekly-digest` pattern |
| V3 Session Management | no | No new session concept introduced |
| V4 Access Control | yes | DB-level REVOKE lockdown on `athlete_goals` (mirrors `athlete_state`/`athlete_decisions`), EXECUTE grant on the extended `record_athlete_decision()` restricted to `service_role` only |
| V5 Input Validation | yes | `create_goal`/`create_program` tool parameter schemas (Zod, sanitized for Anthropic) validate LLM-authored input before it reaches `apply.ts`; `apply.ts` itself must re-derive `evidence` from real queried tables rather than trusting the model's structured output verbatim (Pitfall 1 from the project-root PITFALLS.md, still applicable here) |
| V6 Cryptography | no | No new cryptographic material introduced |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| A cron route reachable without `CRON_SECRET` (e.g. left un-guarded, or guarded after `authMiddleware` instead of before) could be invoked to fabricate weekly decisions/rewards at will | Spoofing / Elevation of Privilege | Reuse the exact `CRON_SECRET` bearer-check pattern verbatim, defined **before** any auth middleware, exactly as `monitor-cron` and `weekly-digest` already do — this is a mandatory checklist item per the project-root PITFALLS.md's "Security Mistakes" table, unchanged for this phase |
| `create_goal`/`create_program` tool executor trusting a model-supplied `user_id`/target athlete instead of the authenticated session's own `userId` | Tampering / Elevation of Privilege | Tool executors must always resolve the target athlete from `c.get('auth').userId` (interactive path) or the cron's own eligibility-scan row (cron path), never from a field the LLM's structured output supplies |
| `athlete_goals` shipped without the same REVOKE-lockdown rigor as `athlete_state`/`athlete_decisions` (the exact gap Phase 42-04 found and fixed for `anon` after initial migration) | Tampering | Explicitly REVOKE INSERT/UPDATE/DELETE from `anon`, `authenticated`, AND `service_role` on `athlete_goals` in the same migration that creates it — do not rely on a follow-up migration to catch a missed role, as happened in Phase 42 |
| LLM-authored `generateObject` decision trusted as ground truth for what actually happened this week (rather than the pre-fetched, backend-queried evidence) | Repudiation / Tampering | `apply.ts` writes `evidence` from the values `fetchWeeklyReviewContext()` actually queried, never from anything the model echoes back in its structured output — same grounding discipline as `computeRetroactiveProfile()`'s comment: *"never substitute a generic or defaulted profile when the aggregates are empty"* |

## Sources

### Primary (HIGH confidence — direct repository inspection, this session)
- `supabase/migrations/20260831120000_athlete_state.sql`, `20260831120100_athlete_decisions.sql`, `20260831120200_athlete_decisions_rpc.sql`, `20260831213147_athlete_state_revoke_anon.sql` — live, shipped Phase 42 schema/RPC
- `supabase/migrations/027_ai_cost_log.sql` — confirmed no `source` column exists today
- `backend/api/src/tools/onboarding-retroactive.ts` — the direct `generateObject`/sanitizer/RPC-write template this phase reuses
- `backend/api/src/tools/registry.ts` — live `AITool`/`executors`/`allToolSchemas` shape, `assess_profile`'s deliberate-exclusion comment
- `backend/api/src/coach/ai/service.ts` (`monitor-cron`) — live sequential-loop/`CRON_SECRET` cron precedent
- `backend/api/src/middleware/creditGate.ts` — confirmed `ai_cost_log` writes are fully decoupled from `creditCheck`/`creditDeduct`
- `backend/api/src/context/user.ts` — confirmed `fetchUserContext()` is not itself an "every app open" hook (only called from AI routes)
- `apps/mobile/app/(app)/_layout.tsx`, `apps/mobile/app/(app)/index.tsx`, `apps/mobile/src/hooks/useAIDailyTip.ts`, `apps/mobile/src/hooks/useNotificationSetup.ts`, `apps/mobile/app/(app)/profile/settings.tsx` — every candidate app-open trigger endpoint checked and ruled in/out
- `backend/api/vercel.json` — confirmed no `functions`/`maxDuration` block; 8 existing crons, no sub-hourly cadence beyond `check-receipts` (every-15-min job lives in `notifications-cron.ts`, not relevant here)
- `backend/api/src/coach/voice/service.ts`, `coach/imports/service.ts`, `coach/videos/service.ts` — confirmed the only three existing `export const maxDuration = 60` precedents in this backend
- `backend/api/test/rls/`, `backend/api/test/tools/`, `backend/api/test/routes/`, `backend/api/vitest.config.ts` — live test infrastructure and existing Phase 42/43 test file precedents
- `npm view ai@6 version` / `npm view @ai-sdk/anthropic@3 version` / `npm view @vercel/functions version` — confirmed current-within-installed-major, this session

### Secondary (MEDIUM confidence — prior project-root research, re-validated against live code this session)
- `.planning/research/SUMMARY.md`, `ARCHITECTURE.md`, `STACK.md`, `PITFALLS.md` (2026-08-30) — remain valid at the architectural-shape level (hybrid lazy-trigger + cron-safety-net, single-shot `generateObject`, bounded-context journal reads); superseded in specifics by the live Phase 42/43 schema/code documented above where they diverge (e.g. `track` column cut, exact RLS strictness, the `week_of`/`next_review_due_at` correctness details this session newly surfaced)
- `.planning/workstreams/milestone-mobile/phases/42-decision-system-foundation/42-CONTEXT.md`, `42-04-SUMMARY.md` — locked schema decisions and live-verification results
- `.planning/workstreams/milestone-mobile/phases/43-conversational-onboarding/43-CONTEXT.md`, `43-02-SUMMARY.md`, `43-PATTERNS.md` — onboarding-as-first-writer precedent, i18n/UI patterns, tool-registration split precedent

### Tertiary (LOW confidence)
- "Pattern of misses" numeric window (A1 in Assumptions Log) — no new evidence found this session beyond the project-root research's own already-flagged inference from general behavioral-health literature, not consumer-fitness-app precedent
- Vercel Fluid Compute enablement status (A4) — genuinely unverifiable from repository inspection alone; unchanged MEDIUM-confidence flag carried forward from project-root STACK.md/ARCHITECTURE.md

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages, all versions directly confirmed via `npm view` this session
- Architecture: HIGH — every recommendation anchored to a specific, live, already-shipped file/pattern in this exact repository (Phase 42 migrations, Phase 43's `onboarding-retroactive.ts`, live `tools/registry.ts`); the one MEDIUM item is Vercel Fluid Compute's exact platform-tier status, unverifiable without account access
- Pitfalls: HIGH — three of five pitfalls (week_of correctness, Anthropic schema sanitizer, `next_review_due_at` NULL gap) were discovered by direct inspection of live, shipped code this session and are not present in the prior project-root research at all; genuinely new, load-bearing findings for this specific phase

**Research date:** 2026-09-02
**Valid until:** 30 days for the architectural recommendations (stable, anchored to shipped code); re-verify Vercel Fluid Compute status and npm package currency if planning is delayed past that window
