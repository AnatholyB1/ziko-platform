# Stack Research

**Domain:** AI Coach Core (v1.18) — conversational onboarding agent, weekly adaptive decision engine, verifiable per-athlete decision journal, expanded agentic tool-calling
**Researched:** 2026-08-30
**Confidence:** MEDIUM-HIGH (Context7-verified AI SDK v6 APIs + official Vercel docs; WebSearch-verified Vercel platform limits; architectural recommendations reasoned from this codebase's own established patterns, cross-checked against current best-practice sources)

## Scope Note

This milestone adds **zero new runtime frameworks**. Every recommendation below is either (1) a
library already installed and used elsewhere in the codebase, applied to a new use case, or (2) a
schema/architecture pattern using the existing Postgres+RLS stack. The three questions in scope —
scheduled AI job design, decision-journal compaction, and step-count tuning — are answered by
**how you use** `ai` v6 + Hono + Postgres, not by adding new packages.

## Recommended Stack

### Core Technologies (already in place — apply, don't add)

| Technology | Version (installed) | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `ai` (Vercel AI SDK) | `^6.0.116` (latest 6.x: 6.0.272 — stay on 6.x, do not jump to 7.x this milestone) | Orchestrator loop, tool calling, `stopWhen` | Already the orchestrator's core; v6's `stopWhen`/`isStepCount`/`hasToolCall` composable stop-condition API (replacing v3-era `maxSteps`) is exactly the primitive needed for a "assess → set goal → grant reward" bounded agentic turn |
| `@ai-sdk/anthropic` | `^3.0.58` (latest 3.x: 3.0.115) | Claude provider, incl. `providerOptions.anthropic.cacheControl` | Same provider package already wired to `AGENT_MODEL`/`VISION_MODEL` in `models.ts`; v3 line exposes Anthropic prompt caching (`cacheControl: { type: 'ephemeral' }`), directly useful for point (b) below |
| `@vercel/functions` | `^3.6.0` | `waitUntil()` for deferred/fire-and-forget work | Already used in `routes/push-events.ts`, `coach/programs/service.ts`, `coach/clients/service.ts` — the established pattern for "do the AI work after responding" and for cron dispatch fan-out |
| Hono v4 + Vercel Cron (`vercel.json` `crons[]`) | existing | Scheduling trigger for the weekly review | 8 crons already run this way (`coach/ai/monitor-cron`, `notifications/cron/weekly-digest`, etc.) — the weekly decision-engine job is architecturally identical to `coach/ai/monitor-cron`, just doing an LLM call per athlete instead of a rule check |
| Supabase Postgres (existing tables + RLS) | existing | `athlete_state` (compact current state) + `athlete_decisions` (append-only journal) | No vector DB needed — decision journal is small, structured, per-user, weekly-cadence data; Postgres JSONB + a hand-rolled rolling-summary column is sufficient (see part b) |
| Zod v4 | `^4.3.6` backend (workspace peer `^4.0.0` in `coach-sdk`) | Input schemas for new AI tools (`create_goal`, `create_reward`, `create_program`) | Matches existing `tool({ inputSchema: z.object(...) })` pattern in `tools/<plugin>.ts` |

### Supporting Libraries — none new required

No new npm packages are needed for (a), (b), or (c). Everything is composition of existing
dependencies. If forced to pick one **optional** addition, see "Vercel Queues" in Alternatives
Considered — explicitly **not** recommended for this milestone's scale.

## Installation

```bash
# Nothing new to install for this milestone.
# Confirm existing versions are current within their major line (safe, no breaking changes):
npm view ai@6 version        # -> 6.0.272 available (installed 6.0.116, caret-compatible)
npm view @ai-sdk/anthropic@3 version   # -> 3.0.115 available (installed 3.0.58, caret-compatible)
```

---

## (a) Scheduled/triggered weekly review — recommended pattern: hybrid, lazy-primary + cron-safety-net

**Recommendation: do NOT build a pure cron-driven "iterate every athlete" job as the primary
mechanism.** Build a **lazy, on-demand trigger** (primary) backed by a **Vercel Cron safety net**
(secondary), mirroring a pattern this codebase already chose deliberately once before.

### Why lazy-primary, not cron-primary

This is not a novel opinion for this codebase — it already made this exact call for the credit
system: `Key Decisions` in `PROJECT.md` records **"Lazy daily-reset (date-keyed check at earn
time) — No cron dependency — avoids Vercel at-least-once cron delivery causing double-resets"**
(v1.4 Phase 18). The same failure mode applies to a weekly review: Vercel Cron delivery is
**at-least-once**, and Hobby-tier cron invocation timing is fuzzy by design (an `0 8 * * *`
schedule can fire any time in the 08:00–08:59 window; this project is Pro-tier, so this specific
jitter doesn't apply, but at-least-once redelivery on function retry does). An idempotent,
date-keyed "is this athlete's review already done for ISO week N?" check is required either way —
so make that check the **primary trigger path**, not a cron-only afterthought.

**Primary path — trigger on read, not on schedule:**
- Add a nullable `athlete_state.next_review_due_at timestamptz`.
- On a cheap, frequently-hit read (e.g. the athlete's home/plugin-dashboard load, or `GET
  /ai/tools` context fetch — whatever endpoint already runs on every app open) check if
  `next_review_due_at <= now()`. If due, don't block the response: fire the review via
  `waitUntil()` (already imported from `@vercel/functions` elsewhere in this backend) and return
  immediately. The next poll/refresh picks up the new `athlete_state` once written.
- Guard against double-fire (concurrent opens) with a partial unique index, same trick as the
  credit system's idempotency-key pattern: `UNIQUE (athlete_id, review_week_start) WHERE
  review_week_start IS NOT NULL` on `athlete_decisions`, and an `ON CONFLICT DO NOTHING` insert of
  a "review started" marker row *before* calling the LLM, so a second concurrent trigger is a
  cheap no-op.

**Safety-net path — cron, structurally identical to `coach/ai/monitor-cron`:**
- Add `athlete-decisions/cron/weekly-review` to `vercel.json` `crons[]` (e.g. `0 8 * * 0`, Sunday
  morning), following the **exact** existing shape: route defined *before*
  `router.use('*', authMiddleware)`, auth via `CRON_SECRET` bearer check (copy the
  `monitor-cron` guard verbatim), service-role Supabase client (no user JWT in cron context).
- This job's *only* job is to catch athletes who never opened the app that week. Query
  `athlete_state WHERE next_review_due_at <= now() AND (review not yet marked this week)`,
  small `LIMIT`, and process with bounded concurrency.
- **Do not loop-and-await sequentially over all athletes in one invocation** the way
  `monitor-cron` does today for coaches — that job is cheap (Postgres queries only, no LLM
  call). An LLM call with 2–3 tool-calling steps is realistically 3–10s per athlete; at Pro-plan
  `maxDuration` (configurable up to 300s, already used at `60` in `coach/voice`, `coach/videos`,
  `coach/imports`), sequential processing tops out around 20–40 athletes per invocation. Options,
  in order of preference for this milestone's scale:
  1. **Batch + self-reschedule**: process a capped batch (e.g. 25) per cron tick, each athlete's
     LLM call kicked off via `waitUntil()` for overlap within the batch, `Promise.allSettled`;
     if more remain, the cron's next scheduled tick (or a self-`fetch` to re-invoke) picks up the
     rest. Zero new dependencies, matches the codebase's existing `waitUntil` fire-and-forget
     idiom.
  2. **Vercel Queues** (public beta as of 2026) — a durable, at-least-once fan-out primitive built
     specifically for "cron enqueues N per-user jobs, a separate consumer function processes each
     with its own timeout budget." Architecturally the textbook right tool here, but it is a beta
     product requiring a new dependency and operational surface. **Recommend deferring** this
     until real athlete counts make batch-1 provably insufficient — revisit if/when weekly active
     athlete count exceeds roughly a few hundred.

**Net effect:** most athletes get their review computed at the moment they'd actually see it (next
app open after week-end), keeping the perceived "weekly digest" fresh without wasted compute on
athletes who don't open the app; the cron guarantees no one is silently skipped indefinitely.

## (b) Decision journal — compact, appendable, economical to read (no vector DB)

**Two-table pattern, explicitly modeling the GSD `STATE.md` / Key-Decisions split this milestone
was asked to mirror:**

| Table | Role | Shape |
|-------|------|-------|
| `athlete_state` | Current compact state (1 row per athlete, upserted) | `level`, `current_focus`, `active_goal_id`, `points_total`, `tier`, `rolling_summary text`, `next_review_due_at`, `last_decision_id` |
| `athlete_decisions` | Append-only, verifiable log | `id`, `athlete_id`, `created_at`, `decision_type` (`onboarding` / `weekly_review` / `reward_grant` / `goal_change`), `rationale text`, `grounding jsonb` (the actual logged metrics the decision cites — sessions count, streak, deltas), `outcome jsonb` |

**Why this shape and not pgvector / semantic retrieval:** the repo has **no vector extension
installed** (checked `supabase/migrations/` — only `uuid-ossp`, `pgcrypto`, `unaccent`). Adding
`pgvector` + embedding generation + a retrieval step is real new infrastructure (extension,
embedding calls, index tuning) for a workload that doesn't need semantic search: retrieval here is
always "this one athlete's own recent history," not "find similar decisions across athletes."
That's a pure recency/structure problem, not a similarity-search problem — Postgres `ORDER BY
created_at DESC LIMIT N` on an indexed `athlete_id` column is the correct-scoped tool, not
embeddings.

**Read-time context assembly (the "economical read"):**
1. Always include `athlete_state.rolling_summary` (prose, capped — e.g. ~300–500 tokens) — this is
   the compaction target.
2. Always include the last **N raw** `athlete_decisions` rows verbatim (e.g. last 3–4 weekly
   reviews) — recent decisions need full fidelity (exact numbers cited, exact rationale) because
   they're what "verifiable, grounded in real data" most directly refers to; a decision made two
   days ago shouldn't already be lossy-summarized.
3. Never replay the full `athlete_decisions` table into the prompt. This mirrors current-best
   practice terminology: **"write-before-compaction"** / **anchored incremental summarization** —
   extend a persistent structured summary per eviction span rather than re-summarizing from
   scratch each time, which loses precision across repeated compression cycles.

**Compaction trigger — where the rolling summary gets updated:**
- Do it **as the last step of the weekly review job itself** (already an LLM call in flight,
  already has the full recent context loaded) rather than a separate cron/job: after the review
  step decides goal/reward, have the *same* tool-calling turn (or a cheap follow-up
  `generateObject` call with `VISION_MODEL`-tier cost, since this is pure text summarization, not
  vision) fold the outgoing week's decision into `rolling_summary`, capped to a fixed token/char
  budget (truncate oldest clauses first, since `rolling_summary` is itself periodically
  regenerated — it never needs unbounded growth).
- This avoids a **separate** infrequent-but-needed "context management" background job — the
  compaction cadence naturally matches the decision cadence (weekly), so there's no drift risk of
  raw decisions piling up between compaction runs.

**Cost lever specific to this codebase's existing dependency:** `@ai-sdk/anthropic` v3 supports
Anthropic prompt caching via `providerOptions.anthropic.cacheControl: { type: 'ephemeral' }` (and
a `ttl: '1h'` variant) on message parts. Mark the `rolling_summary` + user-context block as a cache
breakpoint in the weekly-review system prompt — it's per-athlete stable across the multiple
tool-calling steps within one review turn (relevant directly to part (c): more steps = more times
the same context gets sent to the model; caching amortizes that within a single turn). Not
currently used anywhere in the codebase (verified via grep) — this would be the first use; scope
it to just this new job rather than retrofitting the existing chat routes.

**Verifiability constraint enforcement (from the milestone brief — "grounded in real logged data,
not hallucinated"):** make `grounding jsonb` **mandatory** at the DB layer (`NOT NULL CHECK
(jsonb_typeof(grounding) = 'object')`) so a decision row can never be inserted without the tool
having attached the actual queried metrics it claims to be reasoning from. This is a schema-level
guarantee, not a prompt-level hope — the AI tool executor computes `grounding` itself from real
Supabase queries (same pattern as `coach/ai/monitor-cron`'s alert detection, which already queries
`workout_sessions`/`sleep_logs` directly rather than trusting the model) and passes it as a
required field, not something the model free-generates.

## (c) Raising `stopWhen: stepCountIs(5)` for a "assess → set goal → grant reward" turn

**Verified via Context7 (`/vercel/ai`, current docs):** AI SDK v6 replaced `maxSteps` with the
composable `stopWhen` API. `isStepCount(n)` is the direct equivalent of the old cap; `stopWhen` also
accepts an **array** of conditions (OR'd), notably `hasToolCall('toolName')` — stop as soon as a
specific terminal tool has been called, regardless of step count. The SDK's own default (uncapped
`stopWhen`) is 20 steps, specifically to bound runaway cost — this codebase's existing `5` is
already a deliberate tightening below the SDK default, appropriate for a single-purpose chat turn.

**Recommendation for the weekly-review / onboarding agentic turn specifically:**
```ts
import { isStepCount, hasToolCall } from 'ai';

stopWhen: [isStepCount(8), hasToolCall('grant_reward')],
```
- Raise the numeric ceiling modestly (5 → 8, not 5 → 20). A "assess profile → set goal → grant
  reward" turn is 3 *logical* tool calls, but each logical step can cost 2 model round-trips
  (one to call the tool, one to process its result before the next decision) — 8 gives headroom
  for a query-then-decide sub-step (e.g. the model first calls a read-only
  `get_athlete_recent_activity` tool, reasons over the result, *then* calls `create_goal`) without
  opening the door to the SDK's full 20-step ceiling for a bounded, well-defined task. Route-scope
  this via a **named constant next to `AGENT_MODEL`/`VISION_MODEL`** in `models.ts` (e.g.
  `WEEKLY_REVIEW_MAX_STEPS = 8`) rather than a magic number, keeping the "change model/limits in
  one file" convention already established there.
- Add `hasToolCall('grant_reward')` (or whatever the final terminal tool in the flow is named) as
  an OR'd stop condition so a well-behaved run that finishes early doesn't burn unnecessary steps
  waiting to hit the numeric cap — this is a pure win, not a tradeoff.
- **Do not raise the general-purpose `/ai/chat` route's `stepCountIs(5)`** as a side effect of this
  work. Scope the higher cap to the new weekly-review/onboarding routes only; free-form chat
  doesn't have the same bounded-task shape and a higher default there increases runaway-cost
  surface for no benefit.

**Known costs/considerations of raising step count (from Anthropic's own tool-use guidance and AI
SDK step-loop mechanics), specific to Claude Sonnet:**
- **Linear-ish cost growth, not free**: each additional step is a full new model inference call
  that resends the accumulated conversation (system prompt + all prior tool calls/results) as
  input tokens. Without prompt caching (see part b), an 8-step turn can cost meaningfully more than
  a 5-step one even though logically only 3 tools are called — this is the direct argument for
  pairing the step-count increase with the `cacheControl` breakpoint noted above.
- **Context pollution risk**: intermediate tool results (e.g. a full week of raw workout-session
  rows returned by an "assess profile" tool) accumulate in context for every subsequent step in the
  same turn. Keep assessment tools returning **pre-aggregated summaries** (counts, deltas, streaks
  — exactly the `grounding jsonb` shape from part b) rather than raw row dumps, so a "why not just
  raise the cap higher" instinct doesn't silently blow the input-token budget per athlete.
  This is the same discipline the existing `context/user.ts` 6-parallel-query context builder
  already follows (aggregated context, not raw table dumps) — extend it, don't diverge from it.
- **Credit-gate accounting**: this route must still go through the existing `creditCheck`/
  `creditDeduct` middleware and log to `ai_cost_log` per the v1.4 cost-ceiling system (≤€0.75/user/
  month verified target) — an 8-step, cached-prompt turn should be benchmarked against that
  ceiling before shipping, since weekly-review is a *new* recurring cost line the v1.4 budget
  wasn't sized against.
- **Failure mode at the cap**: if `stopWhen` triggers on `isStepCount(8)` before the model reaches
  a terminal `grant_reward`/`create_goal` call, the turn ends with tool calls pending — handle this
  explicitly (e.g. `onStepFinish`/`onStepEnd` inspection or a post-turn check for "was the required
  terminal tool actually called") rather than assuming the model always completes in budget. This
  matters more here than in free-form chat because the weekly review's side effect (a reward grant,
  a state update) is expected to happen every time it runs — a silent no-op on cap-out is a
  correctness bug, not just a UX rough edge.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Hybrid lazy-trigger (on app-open) + Vercel Cron safety net for weekly review | Pure Vercel Cron, iterate-all-athletes-per-tick | If/when the product deliberately wants reviews computed at a fixed wall-clock time regardless of app usage (e.g. marketing wants "everyone's Monday digest ready at 8am") rather than lazily on next open — then cron-primary is simpler, accept the batching/timeout engineering from part (a) |
| Postgres structured rolling-summary + recent-window | pgvector + embeddings for semantic retrieval over decision history | Only becomes relevant if decisions need cross-athlete similarity search (e.g. "find athletes with a similar decision pattern" for coach-facing analytics) — not needed for a single athlete's own linear history |
| `waitUntil()` batch processing in the existing cron pattern | Vercel Queues (public beta) for true per-athlete fan-out with independent retry/timeout budgets | Once weekly active athlete count is large enough that a single cron invocation's `maxDuration` can't cover a full batch even with concurrency — revisit then, don't pre-adopt a beta dependency now |
| `isStepCount(8)` + `hasToolCall('grant_reward')` scoped to the new route | Raising the shared `stopWhen: stepCountIs(5)` used by `/ai/chat` globally | Never for this milestone — free-form chat and a bounded weekly-review turn have different cost/runaway profiles and should not share a limit |
| Stay on `ai@^6.0.116` / `@ai-sdk/anthropic@^3.0.58` (patch-bump within major only) | Upgrade to `ai@7.x` / `@ai-sdk/anthropic@4.x` | Out of scope for this milestone — those are new majors with their own migration surface; do as a dedicated, separately-planned upgrade, not bundled into a feature milestone |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| pgvector / embedding-based memory for the decision journal | No vector extension currently installed; this is a per-user linear-history problem, not a similarity-search problem; adds an extension, an embedding-generation cost line, and index-tuning surface for no retrieval benefit at this scale | Structured `athlete_state.rolling_summary` (text) + recent-window raw rows from `athlete_decisions`, both plain Postgres |
| A single cron invocation looping `await`-sequentially over every athlete with an LLM call each | Will hit Vercel's `maxDuration` (even at Pro's 300s ceiling) well before covering a meaningfully-sized athlete base; also the exact at-least-once-delivery double-run risk this codebase already identified and avoided once (v1.4 lazy-reset decision) | Lazy on-open trigger as primary, small-batch cron safety net with idempotent `UNIQUE (athlete_id, review_week_start)` guard |
| Uncapped or SDK-default (20-step) `stopWhen` for the weekly-review turn | A bounded 3-tool-call task doesn't need 20 steps of headroom; every extra step is a real Claude Sonnet inference cost against the v1.4 €0.75/user/month ceiling, and this is explicitly a *new* recurring cost the existing budget wasn't sized for | A named, small constant (e.g. 8) combined with `hasToolCall(...)` early-exit |
| Vercel Queues (or any new queue/workflow package) for this milestone | Public-beta product; real new operational surface (durable delivery, consumer groups) not justified until batch-1 (`waitUntil` + capped batches) is proven insufficient at actual scale | `waitUntil()` from `@vercel/functions` (already a dependency, already used 3× in this backend) |
| Bumping `ai`/`@ai-sdk/anthropic` to their new majors (7.x/4.x) as part of this feature work | Unrelated migration risk mixed into a feature milestone; the milestone's own scope note says the orchestrator pattern is already validated on v6 — don't destabilize it | Patch-level updates only within the installed major (`^6.0.116`, `^3.0.58` already allow this via `npm install`) |

## Stack Patterns by Variant

**If the weekly review needs to run for a coach-linked athlete whose coach also wants visibility:**
- Reuse the `is_coach_of()` SECURITY DEFINER pattern already established for coach read access
  (v1.8) to expose `athlete_decisions`/`athlete_state` to the linked coach read-only, rather than
  building a parallel coach-facing summary pipeline.

**If onboarding's ≤4-question conversational flow needs the *same* "decide + call tools" shape as
the weekly review:**
- Give it its own `stopWhen` constant too (e.g. `ONBOARDING_MAX_STEPS`), not the weekly-review
  one — onboarding's terminal tool is different (`generate_micro_plan` vs `grant_reward`) and its
  latency budget is tighter (target: plan generated in <5 min live in front of the user, not a
  background job), so keep the two limits independently tunable in `models.ts`.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `ai@^6.0.116` | `@ai-sdk/anthropic@^3.0.58` | Confirmed pairing already in production use in this repo (`backend/api/package.json`); both patch-bumpable within their current major without a migration (verified latest-in-major: `ai` 6.0.272, `@ai-sdk/anthropic` 3.0.115) |
| `@ai-sdk/anthropic@^3.x` `cacheControl` | Claude Sonnet 4 (`claude-sonnet-4-20250514`, the existing `AGENT_MODEL`) | Anthropic prompt caching is a model-provider feature, not SDK-version-gated beyond v3 exposing `providerOptions.anthropic.cacheControl` — no model change needed to use it |
| `@vercel/functions@^3.6.0` `waitUntil()` | Vercel Fluid Compute (Node.js runtime, already in use — `canvas`/`pdfjs-dist`/`mammoth` in this backend require Node, not Edge) | Deferred work still counts against the invoking function's `maxDuration` and Active CPU billing — it defers relative to the *response*, not the invocation; size cron batch counts accordingly |
| Vercel Cron | Pro plan (confirmed: this project already runs 8 crons incl. sub-daily cadences like `weekly-digest` `0 9 * * 0`, and `maxDuration: 60` is already set on 3 routes) | Pro allows configurable `maxDuration` up to 300s and per-minute cadence precision — Hobby's 10s/once-daily limits don't apply here, but at-least-once delivery semantics apply on every plan |

## Sources

- Context7 `/vercel/ai` — `isStepCount()`, `stopWhen` composable conditions, `hasToolCall`, default 20-step cap, migration from `maxSteps` (HIGH confidence, current v6 docs)
- Context7 `/vercel/ai` — Anthropic `cacheControl` / `providerOptions.anthropic.cacheControl`, `ttl: '1h'` variant, `usage.inputTokenDetails.cacheReadTokens`/`cacheWriteTokens` (HIGH confidence, current docs)
- `vercel.com/docs/limits`, `vercel.com/docs/cron-jobs/manage-cron-jobs`, `vercel.com/changelog/cron-jobs-now-support-100-per-project-on-every-plan` — Hobby vs Pro cron duration/cadence limits (MEDIUM confidence, WebSearch-verified against multiple sources incl. official changelog)
- `vercel.com/docs/queues` + community field notes (dev.to, "Background Jobs on Vercel in 2026") — Vercel Queues public-beta status, `waitUntil()` billing semantics (MEDIUM confidence — official docs page exists, cross-referenced with independent write-up)
- Anthropic engineering blog (`anthropic.com/engineering/advanced-tool-use`) + Claude Platform Docs (tool-use overview, latency reduction guide) — sequential tool-call cost/latency/context-pollution guidance (MEDIUM confidence, WebSearch-verified official + community sources agree)
- This repository — `backend/api/vercel.json`, `backend/api/src/coach/ai/service.ts` (`monitor-cron`), `backend/api/src/routes/push-events.ts`, `backend/api/src/coach/programs|clients/service.ts` (`waitUntil` usage), `backend/api/src/context/conversation.ts` (confirmed: no existing compaction — full history currently replayed), `supabase/migrations/*` (confirmed: no `pgvector` extension installed), `backend/api/package.json`, `.planning/PROJECT.md` Key Decisions (v1.4 lazy-reset precedent) — HIGH confidence, direct inspection
- `npm view ai@6 version` / `npm view @ai-sdk/anthropic@3 version` — confirmed current patch versions within installed majors (HIGH confidence, direct registry query)

---
*Stack research for: AI Coach Core (v1.18) — weekly review job design, decision-journal compaction, agentic step-count tuning*
*Researched: 2026-08-30*
