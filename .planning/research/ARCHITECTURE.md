# Architecture Research — AI Coach Core Integration

**Domain:** Per-athlete AI decision system (conversational onboarding + adaptive weekly decision engine + append-only decision journal) integrating into an existing Hono/Vercel/Supabase fitness platform
**Researched:** 2026-08-30
**Confidence:** HIGH for schema/RLS/plugin-gating recommendations (directly modeled on existing, working codebase patterns) · MEDIUM for the cron/Vercel-serverless cost-latency-reliability tradeoffs (grounded in current Vercel docs, but exact athlete-volume-at-launch is unverified)

This is an **integration** research doc, not a greenfield domain survey — v1.18 AI Coach Core bolts onto an already-shipped orchestrator, cron system, plugin loader, and per-domain-table/RLS convention. Every recommendation below is anchored to a specific existing file/pattern in this repo rather than external genericism.

---

## System Overview — Where the New Pieces Sit

```
┌──────────────────────────────────────────────────────────────────────────┐
│  MOBILE (Expo)                                                            │
│  ┌───────────────┐   ┌──────────────────────┐   ┌──────────────────────┐ │
│  │ PluginLoader   │   │ AIBridge (chat SSE)  │   │ PluginsDrawer (store) │ │
│  │ + minLevel gate│   │ onboarding = normal   │   │ + locked-below-level  │ │
│  │ (MODIFIED)     │   │ /ai/chat/stream call  │   │ badge (MODIFIED)      │ │
│  └───────┬───────┘   └──────────┬───────────┘   └──────────┬───────────┘ │
└──────────┼──────────────────────┼──────────────────────────┼─────────────┘
           │ reads athlete_state.level                        │
           ▼                                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  BACKEND (Hono, Vercel serverless) — backend/api/src/                     │
│                                                                            │
│  routes/ai.ts (MODIFIED)          coaching-engine/ (NEW bounded module,  │
│  ├─ buildSystemPrompt() gains      mirrors backend/api/src/coach/)        │
│  │  "## Athlete State" section    ├─ context.ts                          │
│  ├─ onboarding branch when        │  ├─ fetchAthleteStateSnapshot()      │
│  │  athlete_state.status=         │  │  (compact — feeds 7th query)      │
│  │  'onboarding'                  │  └─ fetchWeeklyReviewContext()       │
│  │                                │     (rich — real activity deltas)    │
│  context/user.ts (MODIFIED)       ├─ tools.ts                            │
│  └─ fetchUserContext() gains      │  └─ create_goal, create_reward,      │
│     athlete_state as 7th          │     create_program, assess_profile   │
│     parallel query                ├─ db.ts (athlete_state/decisions RPC) │
│                                    ├─ apply.ts (shared apply-logic, used  │
│  tools/registry.ts (MODIFIED)     │  by both LLM tool calls AND cron)    │
│  └─ registers the 4 new tools     └─ weekly-review-cron.ts (NEW route)   │
│                                                                            │
│  vercel.json (MODIFIED) — new cron entry, CRON_SECRET-gated, same        │
│  shape as existing notifications-cron.ts / coach/ai monitor-cron         │
└───────────────────────────────┬───────────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  SUPABASE (Postgres + RLS)                                                │
│  athlete_state (NEW, current-state, PK=user_id, SELECT-only for client)  │
│  athlete_decisions (NEW, append-only log, SELECT-only for client)        │
│  record_athlete_decision() / apply_weekly_review() RPC (NEW, SECURITY    │
│    DEFINER, mirrors deduct_ai_credits pattern from migration 026)        │
│  + existing per-domain log tables read for REAL activity (habit_logs,    │
│    nutrition_logs, workout_sessions, sleep_logs, journal_entries...)     │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## (a) Where the weekly review/decision engine lives

### What the codebase already does for "run logic across all users on a schedule"

Three existing crons were read in full to establish precedent:

| Cron | File | Pattern |
|------|------|---------|
| `notifications/cron/streak-at-risk` | `backend/api/src/routes/notifications-cron.ts` | Pure SQL set-intersection across users, no LLM call, loop just does `notificationService.send()` per at-risk user |
| `notifications/cron/weekly-digest` | same file | Loop over opted-in users, 3 parallel aggregate queries per user, no LLM call, `notificationService.send()` |
| `coach/ai/monitor-cron` | `backend/api/src/coach/ai/service.ts` | Loop over coaches → loop over their clients, **deterministic threshold rules** (missed sessions, sleep drop, etc.) build `newAlerts[]`, `insertAlerts()`; `streamText` (the actual LLM agent) is used **only** in the interactive `/coach/ai/chat/stream` route, never inside the cron |

**This is the load-bearing finding:** the one existing cron that is conceptually closest to "AI decision per user, on a schedule" (`monitor-cron`) deliberately keeps the LLM **out** of the per-user loop. It does cheap deterministic detection in the cron and reserves the multi-step tool-calling agent (`stepCountIs(5)`, `streamText`) for on-demand interactive chat only. All crons authenticate via `CRON_SECRET` Bearer header (not `authMiddleware`, since Vercel Cron sends no user JWT) and are registered as flat `GET`/`POST` paths in `backend/api/vercel.json`.

### Recommendation: hybrid, but keep the LLM call minimal and single-shot, never a 5-step agent loop, inside the cron

**Cron does the cheap part (matches existing pattern exactly):**
1. `GET/POST /coaching-engine/cron/weekly-review`, `CRON_SECRET`-gated, scheduled Sunday (stagger after the 09:00 UTC `weekly-digest` cron, e.g. `0 10 * * 0`, so review state is fresh if the digest ever wants to reference it).
2. Query `athlete_state WHERE next_review_due_at <= now()` (service-role client) — cheap, indexed, bounded.
3. For each due athlete, pull the **real logged activity** for the review window via plain aggregate queries against the *existing* per-domain tables (`habit_logs`, `nutrition_logs`, `workout_sessions`, `sleep_logs`, `journal_entries`, etc.) — the same style of query already in `fetchUserContext`/`monitor-cron`, not a new abstraction.

**The AI decision itself must be a single non-streaming, non-tool-calling call, not the interactive agent loop:**
- Use `generateObject` (AI SDK v6) with a Zod schema (`{ new_focus, level_change, reward_id?, rationale }`), with the real-activity aggregates and `athlete_state`/recent `athlete_decisions` **already embedded directly in the prompt** (fetched in step 3, not via tool round-trips). No `stopWhen: stepCountIs(5)` tool loop is needed here — the whole point of the review is "read real data, output one structured decision," which is a single-shot task, unlike open-ended chat.
- This keeps per-athlete latency to roughly one model call (~1–3s) instead of up to 5 sequential tool-calling round trips.
- Run the batch of due athletes with **bounded concurrency** (e.g. chunks of 8–10 via `Promise.all`), not fully sequential (200 athletes × 2s sequential = 400s, already near/over most Vercel duration budgets) and not fully unbounded parallel (risk of Anthropic rate limits / Supabase connection exhaustion).
- Apply the decision **deterministically in code**, not by trusting free-form LLM text: the cron calls the *same* underlying apply-functions the interactive tools use (`create_reward`, `create_goal` executors, refactored into a shared `coaching-engine/apply.ts` so both the LLM tool-call path and the cron path call one function) — this directly satisfies the milestone's stated non-negotiable: *"compare l'effort réel loggé à ce qui était demandé... jamais de punition en cas de sous-performance"* — the gate on whether a reward/level-up is granted is a code-level comparison against the fetched real logs, with the LLM only choosing *which* framing/copy/reward from an allowed pool, never authorizing the underlying grant unilaterally from conversation.

**Cost/latency/reliability tradeoffs (Vercel serverless specifics):**
- Vercel Cron duration limits are identical to regular Function duration limits. Without Fluid Compute, Pro-plan defaults are far too short for a per-athlete-LLM-call loop at any meaningful scale. **With Fluid Compute enabled, Pro/Enterprise support `maxDuration` up to 800s (1800s in beta)** — this must be explicitly configured via the function's `maxDuration` config or `vercel.json` `functions` block; it is not the default. **Action item: verify Fluid Compute is enabled on this Vercel project and set `maxDuration` explicitly on the weekly-review cron route** before relying on batch size assumptions — MEDIUM confidence, not verified against this specific Vercel account. [Vercel Functions duration docs](https://vercel.com/docs/functions/configuring-functions/duration)
- At current early-stage athlete volumes (platform is v1.18, no evidence of a large athlete base yet), a single-shot `generateObject` call per athlete at 8–10 concurrency comfortably fits inside an 800s budget for hundreds of athletes. This will **not** scale indefinitely — if active-athlete count grows past roughly what one cron invocation can process inside the configured `maxDuration`, the fix is pagination (cron processes `next_review_due_at <= now() LIMIT N`, remaining athletes simply get processed by *next week's* run since `next_review_due_at` self-schedules) or moving to a queue. The codebase already uses Upstash (Redis, for rate limiting) — Upstash also offers QStash for exactly this "fan out N background jobs" problem, which is the natural next step if/when volume requires it. Do not build the queue now — YAGNI at current scale, but flag it as the scaling knob.
- **Reliability — Vercel cron delivery is at-least-once** (this is already an explicit lesson baked into this codebase: the "Lazy daily-reset" Key Decision in `PROJECT.md` exists specifically because "Vercel at-least-once cron delivery" caused double-resets elsewhere). The weekly-review cron must be idempotent the same way: (1) the eligibility query (`next_review_due_at <= now()`) is naturally self-healing — once a review is applied and `next_review_due_at` is pushed forward 7 days, a duplicate cron firing in the same window finds nothing to do; (2) additionally add a partial unique index on `athlete_decisions(user_id, decision_type, week_of) WHERE decision_type = 'weekly_focus'` mirroring the exact idempotency pattern already used for AI credits (`idx_credit_tx_idempotency`, migration `026_ai_credits.sql`) as a second line of defense against a retry landing between the read and the `next_review_due_at` write.

**Recommended fallback, not primary mechanism:** because Vercel cron failures are possible (function error, timeout, Anthropic outage), add a cheap **on-app-open safety net**: if an athlete opens the app and their `athlete_state.next_review_due_at` is in the past, the mobile app can call a dedicated backend route (reusing the exact same `apply.ts` logic) to catch up that one athlete's review lazily. This is not the primary trigger (predictable Sunday timing matters for UX — feature unlocks and reward framing should not silently differ based on when an athlete happens to open the app), but it bounds the damage of a missed cron run to "late by however long the athlete is inactive," consistent with the product's explicit "never punish" posture.

**Explicitly rejected alternative:** running the full multi-step tool-calling agent (`streamText`, `stopWhen: stepCountIs(5)`) once per athlete inside the cron loop. This is the interactive-chat shape, built for a human in the loop reacting to streamed tokens and multi-turn tool corrections — it is unnecessary latency and cost for a scheduled batch job that already has all its input data precomputed, and it is exactly the pattern the existing `monitor-cron` avoided.

---

## (b) `athlete_state` / `athlete_decisions` shape, RLS, and system-prompt injection

### Direct precedent already in this codebase

The gamification schema (migration `007_gamification_schema.sql`) is **already** the current-state + append-only-log pattern the milestone asks for, just under different names:

- `user_gamification` (PK = `user_id`, one row per user: `xp`, `level`, `coins`, `current_streak`...) = the "current position" table
- `xp_transactions` / `coin_transactions` (append-only, FK `user_id`, indexed `(user_id, created_at DESC)`) = the audit trail

The AI-credits schema (migration `026_ai_credits.sql`) adds a second, more rigorous precedent: `user_ai_credits` (current balance) + `ai_credit_transactions` (ledger) + a `SECURITY DEFINER` RPC (`deduct_ai_credits`) that does the read-lock-write-log as one atomic transaction, plus a **partial unique index** `(user_id, source, idempotency_key) WHERE idempotency_key IS NOT NULL` for retry-safety.

**Recommendation: model `athlete_state`/`athlete_decisions` directly on the credits pair, not the looser gamification pair** — because gating (level → plugin visibility) is security-relevant in a way XP display is not: `user_gamification`/`xp_transactions` use a single `USING/WITH CHECK (auth.uid() = user_id)` policy with no command restriction, which — read literally — permits an authenticated client to `UPDATE` their own XP/level directly via a raw Supabase REST call, not just read it. That gap is tolerable for a coins-and-titles reward table but **not** for `athlete_state.level`, since level directly drives which plugins/screens unlock (see part c). Recommend tightening this table's RLS relative to the two existing precedents.

### `athlete_state` (current-state, one row per athlete)

```sql
CREATE TABLE public.athlete_state (
  user_id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status                TEXT NOT NULL DEFAULT 'onboarding'
                          CHECK (status IN ('onboarding', 'active', 'paused')),
  track                 TEXT NOT NULL DEFAULT 'general',
  level                 INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  points                INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  tier                  INTEGER NOT NULL DEFAULT 1 CHECK (tier >= 1),
  onboarding_profile    JSONB NOT NULL DEFAULT '{}',   -- confidence/experience/constraints from assess_profile
  current_focus_summary TEXT,                          -- human-readable, shown in UI ("cette semaine : hydratation")
  current_focus_detail  JSONB NOT NULL DEFAULT '{}',    -- structured refs (goal_id, program_id, reward pool)
  last_review_at        TIMESTAMPTZ,
  next_review_due_at    TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.athlete_state ENABLE ROW LEVEL SECURITY;

-- Read-only for the athlete — writes go through record_athlete_decision()/
-- apply_weekly_review() RPC (SECURITY DEFINER) called from backend tool
-- executors, never a direct client UPDATE. Tighter than the
-- user_gamification/user_ai_credits precedent on purpose (see rationale above).
CREATE POLICY "athlete_state_select_own" ON public.athlete_state
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE TRIGGER trg_athlete_state_updated
  BEFORE UPDATE ON public.athlete_state
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

### `athlete_decisions` (append-only journal — the "GSD Key Decisions table" for an athlete)

```sql
CREATE TABLE public.athlete_decisions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision_type  TEXT NOT NULL CHECK (decision_type IN
                    ('onboarding_profile', 'weekly_focus', 'level_change',
                     'reward_grant', 'program_created', 'goal_created')),
  week_of        DATE,                          -- review-week key, NULL for one-off decisions
  summary        TEXT NOT NULL,                 -- "Decision" column equivalent
  rationale      TEXT,                          -- "Rationale" column equivalent
  evidence       JSONB NOT NULL DEFAULT '{}',    -- the real activity data actually read (auditability)
  outcome        JSONB NOT NULL DEFAULT '{}',    -- {level_from, level_to, reward_id, focus, points_delta}
  source         TEXT NOT NULL DEFAULT 'weekly_review_cron'
                    CHECK (source IN ('weekly_review_cron', 'onboarding_tool',
                                       'app_open_fallback', 'manual_admin')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_athlete_decisions_week_idempotency
  ON public.athlete_decisions (user_id, decision_type, week_of)
  WHERE decision_type = 'weekly_focus' AND week_of IS NOT NULL;

CREATE INDEX idx_athlete_decisions_user_created
  ON public.athlete_decisions (user_id, created_at DESC);

ALTER TABLE public.athlete_decisions ENABLE ROW LEVEL SECURITY;

-- Append-only from the athlete's point of view: SELECT only, no client
-- INSERT/UPDATE/DELETE policy at all (writes exclusively via SECURITY
-- DEFINER RPC / service role from backend).
CREATE POLICY "athlete_decisions_select_own" ON public.athlete_decisions
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
```

Both writes should go through one `SECURITY DEFINER` RPC (mirroring `deduct_ai_credits`) so the state update and the log insert happen atomically:

```sql
CREATE OR REPLACE FUNCTION public.record_athlete_decision(
  p_user_id UUID, p_decision_type TEXT, p_week_of DATE, p_summary TEXT,
  p_rationale TEXT, p_evidence JSONB, p_outcome JSONB, p_source TEXT,
  p_state_patch JSONB   -- fields to merge into athlete_state (level, points, focus...)
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.athlete_decisions
    (user_id, decision_type, week_of, summary, rationale, evidence, outcome, source)
  VALUES (p_user_id, p_decision_type, p_week_of, p_summary, p_rationale, p_evidence, p_outcome, p_source)
  ON CONFLICT (user_id, decision_type, week_of) WHERE decision_type = 'weekly_focus' DO NOTHING;

  UPDATE public.athlete_state
  SET level = COALESCE((p_state_patch->>'level')::int, level),
      points = COALESCE((p_state_patch->>'points')::int, points),
      current_focus_summary = COALESCE(p_state_patch->>'current_focus_summary', current_focus_summary),
      last_review_at = NOW(),
      next_review_due_at = NOW() + INTERVAL '7 days',
      updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('success', true);
END; $$;
```

### System-prompt injection — 7th query vs restructure

**Answer: 7th query for `athlete_state`, not a restructure — and the decision log stays out of the always-on context entirely.**

- `fetchUserContext()` (`backend/api/src/context/user.ts`) already runs 6 parallel single-purpose queries and composes bounded sections into the prompt via `buildSystemPrompt()` in `routes/ai.ts` (profile, today's snapshot, recent workouts LIMIT 5, installed plugins, recent forms LIMIT 5). `athlete_state` is exactly this shape: one cheap PK lookup, ~8 compact fields, no reason not to add it as a 7th `Promise.all` entry and a new `## Athlete State` section in `buildSystemPrompt()` (level, track, current focus, points/tier) — every general chat turn benefits from the agent knowing the athlete's current level/focus without a tool round-trip, same rationale as why profile/today's-snapshot are always injected rather than tool-fetched.
- `athlete_decisions` (the log) should **not** be dumped into the general chat prompt — it is an unbounded-growth audit trail, not a snapshot. Two consumers need it differently:
  - The **weekly review** call needs a *rich*, purpose-built context (real per-domain activity deltas for the review window + the last few `athlete_decisions` rows to avoid repeating last week's exact reward) — this is fundamentally different data (deltas over a window, not "today") from what `fetchUserContext` computes, so it should be its own function, `fetchWeeklyReviewContext()`, in the new `coaching-engine/context.ts` module — **do not overload `fetchUserContext`** with a second, incompatible shape. This exactly mirrors the existing precedent: `backend/api/src/coach/ai/context.ts` already has its own `fetchCoachContext()`, entirely separate from `context/user.ts`, because the coach chat needs coach-shaped data. `coaching-engine/` should follow the same "each orchestrator surface gets its own context builder" convention rather than forcing everything through the one athlete-chat context function.
  - The general chat agent can access recent decisions **on demand** via a new bounded tool (e.g. `athlete_get_decision_history`, `LIMIT N`) rather than always-injected — consistent with how `ai_messages` conversation history is only loaded when a `conversationId` is passed (`getOrCreateConversation`), not force-included in every system prompt.

---

## (c) Feature-gating by readiness — integration with PluginLoader/manifest

### What already exists

- `PluginManifest` (`packages/plugin-sdk/src/types.ts`) has `mandatory?: boolean` — plugins so flagged are pre-loaded unconditionally by `PluginLoader` via a hardcoded `MANDATORY_PLUGIN_IDS` array, bypassing `user_plugins` entirely (`apps/mobile/src/lib/PluginLoader.tsx`).
- `user_plugins.is_enabled` is a **per-user, athlete-controlled** toggle (install/uninstall from the drawer) — it answers "has this athlete chosen to have this plugin," not "is this athlete allowed to."
- `plugins_registry.manifest` (JSONB) is the **global, static** definition shared by all users — identical for every athlete regardless of level.

Readiness-gating is a third, new axis: "is this athlete allowed to see this plugin yet," driven by `athlete_state.level`, which is per-user computed state, not a per-user install choice and not a global static constant. It should not collapse into either existing mechanism.

### Recommendation

1. **Add `minLevel?: number` to `PluginManifest`** (packages/plugin-sdk/src/types.ts) — a static, per-plugin threshold, alongside `requiredPermissions`/`mandatory`. Keep it a simple numeric threshold, not a richer `unlockCondition` object with tracks/factions — the milestone spec explicitly frames unlocking as level-based ("déblocage progressif de fonctionnalités par niveau... niveau de départ calculé à l'onboarding") and explicitly defers factions/tracks/leagues to a future milestone (SEED-001, `PROJECT.md`). Building a richer gating schema now would pre-build the very RPG layer this milestone deliberately excludes.
2. **Enforce in `PluginLoader`, not the plugin's own screen/store.** `PluginLoader` is already the single existing gatekeeper deciding whether `registerPlugin()`/`aiBridge.registerPlugin()` gets called at all (it already applies two filters: mandatory-bypass, then `is_enabled`). A level check is a third filter of the identical kind and belongs in the identical place — it must run **before** a screen can even be mounted, not as a runtime check inside the screen (which would let a deep-link or stale route still render a not-yet-unlocked screen). Precedence order, consistent with existing bypass logic: `mandatory: true` plugins always load regardless of level (unlocking is irrelevant for a plugin the athlete can't remove anyway) → otherwise require `!manifest.minLevel || athleteLevel >= manifest.minLevel` → otherwise require `is_enabled`.
3. **Fetch `athlete_state.level` alongside the existing `user_plugins` query** in `PluginLoader`'s `loadInstalledPlugins()` — one extra single-row lookup, same shape as the existing `autoInstallCoachPlugin` profile-role lookup already in that file. Default to `level = 1` if `athlete_state` has no row yet (pre-onboarding athletes, or athletes who existed before this migration) so gating fails safe to "everything a level-1 athlete can see," never to "nothing loads."
4. **Do not add a gating column to `user_plugins` or `plugins_registry`.** The gating *rule* (`minLevel`) is static per plugin and belongs with the other static manifest fields; the gating *input* (`athlete_state.level`) is already a per-user table with its own row — writing a per-user-per-plugin gating decision into `user_plugins` would duplicate data that's fully derivable from the join of those two, and would need a backfill/migration every time a threshold changes. This matches the existing separation already in this codebase: manifest = global static definition, `user_plugins` = per-user install/enable state only, nothing in between today.
5. **Drawer/store screen** (`PluginsDrawer`) needs the same `minLevel` vs `athlete_state.level` comparison, but purely presentational — render a locked badge/lock icon on not-yet-unlocked plugins in the "browse" list instead of making them installable. This is UX polish; the actual security boundary is (2), not this screen.
6. **No demotion/revocation path needed.** The milestone's explicit "jamais de punition en cas de sous-performance" principle means `athlete_state.level` is monotonic non-decreasing in practice — there is no product requirement to handle a plugin becoming re-locked after having been unlocked, which simplifies the PluginLoader change (no need to `unregisterPlugin()` on a level decrease that will never happen by design).

---

## (d) New vs modified components and build order

### New components

| File/module | Purpose |
|---|---|
| `supabase/migrations/<ts>_athlete_state.sql` | `athlete_state` table, SELECT-only RLS, `updated_at` trigger |
| `supabase/migrations/<ts>_athlete_decisions.sql` | `athlete_decisions` table, SELECT-only RLS, weekly-idempotency partial unique index |
| `supabase/migrations/<ts>_athlete_decisions_rpc.sql` | `record_athlete_decision()` SECURITY DEFINER RPC (atomic state-patch + log insert) |
| `backend/api/src/coaching-engine/db.ts` | Queries against `athlete_state`/`athlete_decisions`, RPC calls (service-role client, mirrors `coach/*/db.ts` shape) |
| `backend/api/src/coaching-engine/types.ts` | Shared TS types for the module |
| `backend/api/src/coaching-engine/context.ts` | `fetchAthleteStateSnapshot()` (compact, feeds the 7th query) + `fetchWeeklyReviewContext()` (rich, real-activity deltas + recent decisions) |
| `backend/api/src/coaching-engine/apply.ts` | Shared "apply a decision" logic — called both by LLM tool executors (`create_goal`, `create_reward`, ...) and directly by the weekly-review cron, so the AI-authored decision and the cron-applied effect can never diverge |
| `backend/api/src/coaching-engine/tools.ts` | New AI tool schemas + executors: `create_goal`, `create_reward`, `create_program`, `assess_profile` |
| `backend/api/src/coaching-engine/weekly-review-cron.ts` | `CRON_SECRET`-gated cron route: eligibility scan → real-activity fetch → single `generateObject` decision (bounded concurrency) → `record_athlete_decision()` |
| `.../PluginsDrawer` locked-badge UI (mobile) | Presentational lock state for below-level plugins in the browse list |

### Modified components

| File | Change |
|---|---|
| `backend/api/src/context/user.ts` | `fetchUserContext()` gains `athlete_state` as a 7th parallel query; `UserContext` interface gains an `athleteState` field |
| `backend/api/src/routes/ai.ts` | `buildSystemPrompt()` gains a `## Athlete State` section; gains an onboarding-mode branch when `athlete_state.status === 'onboarding'` (or no row exists) that steers the conversation toward `assess_profile` |
| `backend/api/src/tools/registry.ts` | Registers the 4 new tool schemas + executors from `coaching-engine/tools.ts` into `allToolSchemas`/`executors` |
| `backend/api/vercel.json` | New cron entry for `coaching-engine/cron/weekly-review`, e.g. `0 10 * * 0` (staggered after the existing `0 9 * * 0` weekly-digest); explicit `maxDuration` config verified against Fluid Compute settings |
| `packages/plugin-sdk/src/types.ts` | `PluginManifest` gains `minLevel?: number` |
| `apps/mobile/src/lib/PluginLoader.tsx` | Fetches `athlete_state.level` alongside `user_plugins`; applies gating filter with precedence `mandatory > minLevel > is_enabled`; defaults to level 1 when no `athlete_state` row exists |

### Build order (dependency-driven, not phase-numbered — phases are the roadmap's job)

1. **`athlete_state` + `athlete_decisions` migrations + `record_athlete_decision()` RPC.** Nothing else in this list can be built or tested without these existing — every tool, the cron, the context builders, and the plugin gate all read or write these tables.
2. **`assess_profile` tool + onboarding system-prompt branch in `routes/ai.ts`.** This is the *first writer* of `athlete_state` — a new athlete has no row until onboarding runs. Must land before the weekly review or feature-gating can have any real data to act on (both need a non-empty `athlete_state` to be meaningful, though gating fails-safe to level 1 in the interim per (c)).
3. **`create_goal`, `create_reward`, `create_program` tools + `apply.ts` shared logic**, registered into `tools/registry.ts`. Independent of each other, can be built in parallel; depend on step 1 (schema) and conceptually on step 2 (an athlete profile to scope goals/rewards against), though they can be developed/tested against a manually-seeded `athlete_state` row before onboarding is fully wired.
4. **7th-query context wiring** (`context/user.ts` 7th query + `buildSystemPrompt()` section). Low-risk, mechanically similar to the existing 6 queries; can land any time after step 1, but only becomes visibly meaningful once step 2 is producing real rows.
5. **Feature-gating** (`minLevel` on `PluginManifest` + `PluginLoader` change + `PluginsDrawer` lock badge). Depends on `athlete_state.level` being populated by step 2 to be meaningful, and on a documented default (level 1) for the pre-onboarding/no-row case so existing athletes aren't locked out on rollout.
6. **Weekly-review cron.** Depends on step 3's `apply.ts` — the cron's whole design principle is "the cron computes real-activity evidence and calls the same apply-functions the tools use," so it should be built after, not in parallel with, the tool executors, to avoid writing two divergent implementations of "grant a reward." Also depends on step 1 for idempotency/scheduling fields (`next_review_due_at`).
7. **Push notification hook on review completion** (reuses `notificationService.send()` + the existing idempotency-key convention already proven in `streak-at-risk`/`weekly-digest`). Cosmetic, last, trivial once the cron produces a result to announce.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Running the interactive multi-step tool-calling agent inside a per-user cron loop
**What people do:** Reuse the exact `streamText` + `stopWhen: stepCountIs(5)` + full tool registry shape from `/ai/chat/stream` inside the weekly-review cron, once per athlete.
**Why it's wrong:** That shape is built for a human reacting to streamed tokens and correcting multi-turn tool calls; in a batch job it multiplies latency (up to 5 round trips) and cost per athlete for no benefit, since all the input data is already known before the call. It is also the exact thing the existing `monitor-cron` precedent avoided.
**Instead:** Precompute real-activity data in the cron with plain SQL, then a single `generateObject` call per athlete with that data embedded in the prompt.

### Anti-Pattern 2: Letting the LLM's conversational claim be the source of truth for rewards/level changes
**What people do:** Trust whatever the agent says in a chat turn ("you did great this week!") and grant a reward directly from that text.
**Why it's wrong:** Directly contradicts the milestone's stated requirement — real logged activity must be compared to what was asked, not the conversation. It also opens a manipulation vector (an athlete could talk the agent into granting unearned rewards).
**Instead:** The LLM proposes a decision from real fetched evidence; a deterministic `apply.ts` function (shared between tool calls and the cron) is the only code path that writes `athlete_state`/`athlete_decisions`, and it should itself re-validate against the evidence payload before writing, not merely trust the model's structured output blindly.

### Anti-Pattern 3: Duplicating gating state per-user when it's derivable
**What people do:** Add an `unlocked_plugins` JSONB or a gating boolean per row in `user_plugins`.
**Why it's wrong:** The rule (`minLevel`) is static per plugin; the input (`athlete_state.level`) is already a single per-user row. Duplicating the derived boolean into `user_plugins` means every threshold change requires a backfill migration and creates a second source of truth that can drift.
**Instead:** Compute gating at read time in `PluginLoader` from the join of `manifest.minLevel` and `athlete_state.level`.

---

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|---|---|---|
| `coaching-engine/` ↔ `tools/registry.ts` | Direct import, same pattern as every other plugin's tool module (`habits.ts`, `nutrition.ts`, ...) | No new registration mechanism needed |
| `coaching-engine/` ↔ `context/user.ts` | `context/user.ts` imports a slim read from `coaching-engine/db.ts` for the 7th query; `coaching-engine/context.ts` does NOT import from `context/user.ts` (avoid circular/overloaded context) | Mirrors `coach/ai/context.ts` being fully separate from `context/user.ts` |
| `coaching-engine/weekly-review-cron.ts` ↔ `apply.ts` | Direct function call, service-role client, no LLM tool-call layer in between | Keeps cron and interactive tool paths behaviorally identical for the "apply" step |
| `PluginLoader` ↔ `athlete_state` | One extra Supabase `select` alongside the existing `user_plugins` query, same client/session | No backend round trip needed — RLS SELECT policy makes this a direct client read |
| Weekly review ↔ existing notification system | `notificationService.send()` with a new `idempotencyKey` pattern (`weekly_review_${userId}_${weekOf}`) | Reuses `backend/api/src/services/notificationService.ts`, no new delivery mechanism |

---

## Sources

- Direct repository inspection (HIGH confidence, all cited inline above): `backend/api/src/context/user.ts`, `backend/api/src/tools/registry.ts`, `backend/api/src/routes/ai.ts`, `backend/api/src/routes/notifications-cron.ts`, `backend/api/src/coach/ai/service.ts`, `backend/api/vercel.json`, `apps/mobile/src/lib/PluginLoader.tsx`, `packages/plugin-sdk/src/types.ts`, `supabase/migrations/001_initial_schema.sql`, `supabase/migrations/007_gamification_schema.sql`, `supabase/migrations/012_new_plugins_schema.sql`, `supabase/migrations/026_ai_credits.sql`, `.planning/PROJECT.md`
- [Vercel Functions — Configuring Maximum Duration](https://vercel.com/docs/functions/configuring-functions/duration) — MEDIUM confidence, confirms Fluid Compute Pro/Enterprise 800s maxDuration ceiling (1800s beta); not verified against this specific project's Fluid Compute enablement status
- [Vercel Cron Jobs — Usage & Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) — confirms cron duration limits are identical to Function duration limits

---
*Architecture research for: AI Coach Core integration (v1.18, `milestone-mobile` workstream)*
*Researched: 2026-08-30*
