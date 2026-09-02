# Phase 44: Weekly Adaptive Decision Engine - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Each week, every active athlete's next focus is decided from what they actually did — logged activity, not self-declared — compared against their assigned focus, plus their decision history. The `coaching-engine/` module ships: an idempotent, bounded-concurrency weekly review (lazy on-app-open primary trigger + a small cron safety net for stragglers), a single-shot `generateObject` decision call (never the interactive multi-step agent loop), and `create_goal`/`create_program` tools registered in the shared orchestrator tool registry, callable identically from the weekly review and interactive chat through one shared apply path. The engine self-corrects onboarding profiling errors over time — escalating or de-escalating a trajectory independently of the athlete's original onboarding-inferred profile.

**In scope:**
- `coaching-engine/db.ts`, `context.ts` (`fetchWeeklyReviewContext()`), `apply.ts` (shared deterministic write path), `tools.ts` (`create_goal`, `create_program` schemas + executors), `weekly-review-cron.ts`
- Lazy on-open trigger wired into an existing frequently-hit read path, with `waitUntil()` fire-and-forget review computation
- Small Sunday cron safety net for athletes who don't open the app that week
- Real-activity-vs-focus comparison, scoped to whichever data table(s) that week's specific focus targets
- Escalate/hold/de-escalate decision logic with AI discretion over a base rule (fast escalate, slow de-escalate)
- New `athlete_goals` table (referenced by `athlete_state.current_focus_detail.goal_id`)
- `create_program` writing structured weekly training targets into `current_focus_detail`
- Idempotency guarantee: running the review twice for the same athlete/week produces exactly one recorded decision
- Independent `ai_cost_log` accounting for the weekly engine's AI cost, funded as platform opex

**Out of scope (belongs to later phases):**
- Reward/points/tier selection from the engine's output — Phase 45
- `PluginManifest.minLevel` / `PluginLoader` gating on `athlete_state.level` — Phase 46
- The Phase 47 push notification when a review completes, `athlete_state` as the 7th parallel context query for the *ongoing* chat orchestrator, and full `ai_cost_log` coverage across all autonomous calls — Phase 47
- Full multi-week AI program generation via the existing `/ai/programs/generate` flow — stays a separate, rarer, explicit chat-initiated action; the weekly engine never calls it automatically
- Legal/regulatory review of reward mechanics — Phase 45's concern, not this phase's

</domain>

<decisions>
## Implementation Decisions

### Review trigger timing

- **D-01:** Lazy on-app-open is the primary trigger, with a small Sunday cron only as a safety net for athletes who don't open the app that week. On a cheap read that already runs every app open, check if the athlete's review is due; if due, fire it via `waitUntil()` (already used elsewhere in this backend) and return immediately — the next fetch picks up the fresh `athlete_state`. Rejected: a pure synced cron computing every athlete's review at the same wall-clock time — that reintroduces the batch-duration/at-least-once-redelivery engineering this codebase deliberately avoided for the v1.4 lazy-daily-reset, and computes reviews for athletes who won't check for days.
- **D-02:** Cadence is personalized per athlete, rolling from their onboarding completion date — not synced to the same calendar week for everyone. An athlete who finished onboarding on a Wednesday gets reviewed every Wednesday. Matches `next_review_due_at` being a per-athlete timestamp and avoids a single-day traffic spike for the lazy-trigger path.
- **D-03:** When a lazily-triggered review finishes in the background, the athlete gets a brief in-app "Ziko reviewed your week" moment (reusing the `FadeInUp`/celebration pattern already built for Phase 43's onboarding celebration) rather than a silent state update — treated as a retention beat, not a routine confirmation. This is the in-app reveal only; the Phase 47 push notification is a separate, later concern.

### Escalation/de-escalation aggressiveness (stepped-care shape)

- **D-04:** Escalation is fast: one strong week (met or exceeded focus) is enough for the AI to consider escalating next week's focus. No requirement for a consecutive-week streak before rewarding progress.
- **D-05:** De-escalation is slow: a single missed week does NOT by itself trigger de-escalation — the AI only backs off after a pattern of misses (e.g. repeated shortfalls across recent weeks), not one off week (travel, illness, etc.). This asymmetry (fast up, slow down) is deliberate and non-punitive, consistent with REWARD-01's "never a negative or punitive outcome" framing carried from Phase 45's locked requirements.
- **D-06:** The AI has discretion to hold focus steady even when the mechanical escalate/de-escalate rule (D-04/D-05) would otherwise trigger a change, based on other signals in the athlete's decision history (e.g. recent volatility). The rules in D-04/D-05 are a floor/ceiling the AI's judgment operates within, not a hard-coded state machine the AI has no say over — matches ENGINE-02's framing ("AI decides... from comparison plus decision history"). Whichever way it decides, the rationale is recorded in `athlete_decisions` per the existing Phase 42 write-path convention.

### "Met focus" definition & activity data sources

- **D-07:** "Met" requires hitting the assigned target exactly or exceeding it — no tolerance band. Falling short by any amount (even close, e.g. 2/3 of a workout-count target) counts as "missed," not "met." Combined with D-05 (pattern-of-misses-before-de-escalating), a single near-miss still doesn't hurt the athlete's trajectory immediately — it just isn't counted as a win.
- **D-08:** The real-activity comparison reads only the specific logged-data table(s) that week's assigned focus actually targets — never a fixed source checked indiscriminately regardless of focus type. A training-volume focus reads `workout_sessions`/`session_sets`; a habit/consistency focus reads `habit_logs`/`journal_entries`; a nutrition/hydration focus reads `nutrition_logs`/`hydration_logs`. Exact per-focus-type source mapping is Claude's discretion during planning.

### create_goal / create_program scope

- **D-09:** `create_goal` writes to a new, dedicated `athlete_goals` table (goal text, target, target_date, status) — not just a JSONB blob inside `athlete_state`. `athlete_state.current_focus_detail.goal_id` references the active row. This gives goals their own identity/history separate from the compact current-state row.
- **D-10:** `create_goal` sets the broader, multi-week outcome (e.g. "build a base fitness habit by [date]") — the `athlete_goals` row. `create_program` is a lighter, distinct action: it writes this week's concrete structured training targets (session count/type) into `athlete_state.current_focus_detail`, referencing the active goal. Program = the week's plan; goal = what it's building toward. Neither tool triggers the existing full multi-week `/ai/programs/generate` AI generation flow — that stays separate and chat-initiated only (see Out of scope).
- **D-11:** A review only calls `create_program` (updates weekly training targets) on an escalation or de-escalation. A "hold steady" review does not regenerate/rewrite the program — the existing focus/program simply continues, avoiding needless churn and AI calls on weeks where nothing structurally changed.

### Claude's Discretion

- Exact per-focus-type data source mapping (D-08) — which table(s) map to which focus category, finalized during planning.
- Exact numeric definition of "a pattern of misses" for de-escalation (D-05) — e.g. 2-of-last-3 weeks, or a different window — pick during planning/research, informed by the same synthetic-athlete validation approach already flagged for Phase 42's rolling-summary caps.
- `athlete_goals` table exact shape (columns beyond goal text/target/target_date/status) — finalize during planning against `current_focus_detail`'s existing JSONB draft in `research/ARCHITECTURE.md`.
- Exact mechanism for detecting "review is due" on the lazy-trigger read path (D-01) — which existing frequently-hit endpoint carries the check, and how the fired-but-pending state is represented until the next fetch.
- Vercel Fluid Compute / `maxDuration` verification and bounded-concurrency batch sizing for the cron safety net — flagged as an open technical research gap in STATE.md, not a product decision for this discussion.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap

- `.planning/REQUIREMENTS.md` §Moteur de Décision Adaptatif Hebdo (ENGINE) — ENGINE-01 through ENGINE-06 acceptance criteria (project-root file; note the workstream-local `REQUIREMENTS.md` is stale, still v1.6 content — this project-root file is the authoritative v1.18 source)
- `.planning/workstreams/milestone-mobile/ROADMAP.md` §Phase 44 — phase goal, 5 success criteria, dependency on Phases 42 and 43
- `.planning/workstreams/milestone-mobile/STATE.md` — Key Decisions locked project-wide (single-shot `generateObject` architecture, opex funding model, lazy-reset precedent)

### Prior Phase Context (foundation this phase reads/writes against)

- `.planning/workstreams/milestone-mobile/phases/42-decision-system-foundation/42-CONTEXT.md` — `readiness` enum, `record_athlete_decision()` as the sole write path, rolling-summary/recent-window read convention, DB-level write lockdown
- `.planning/workstreams/milestone-mobile/phases/43-conversational-onboarding/43-CONTEXT.md` — onboarding as the first writer of `athlete_state`; Phase 44 explicitly designed as its safety net, not an incidental benefit

### Research (already answers most technical shape questions)

- `.planning/research/SUMMARY.md` — Phase 3/"Weekly Adaptive Decision Engine" rationale, build-order dependencies, open research flags (Fluid Compute/`maxDuration`, no confirmed stepped-care precedent)
- `.planning/research/ARCHITECTURE.md` — full `coaching-engine/` module file list, `athlete_state`/`athlete_decisions` schema draft (`current_focus_detail JSONB`), build-order step 3/6, cron route shape
- `.planning/research/STACK.md` §(a) — hybrid lazy-trigger + cron-safety-net recommendation (directly informs D-01/D-02), idempotency partial-unique-index pattern, `isStepCount`/agentic-turn guidance (note: applies to the *interactive* onboarding/chat turn, not the weekly cron's single-shot `generateObject` call — STATE.md's locked architecture decision)
- `.planning/research/PITFALLS.md` — grounding discipline (AI decisions must cite real logged data, not self-report) — directly informs D-07/D-08

### Existing Precedent (read before writing any migration/route/tool)

- `backend/api/src/coach/ai/monitor-cron` — structurally identical existing cron pattern (`CRON_SECRET` guard, service-role client, route defined before `authMiddleware`) that `weekly-review-cron.ts` follows, minus its sequential per-user loop (that pattern has no LLM call in the loop and would blow duration/cost budgets here per STATE.md)
- `backend/api/src/services/notificationService.ts` — existing `idempotencyKey` pattern (`streak-at-risk`/`weekly-digest`), the precedent Phase 47's push notification will reuse (not built this phase, but shapes what data this phase must leave ready)
- `supabase/migrations/026_ai_credits.sql` — `SECURITY DEFINER` RPC + partial-unique-index idempotency precedent, already the template `record_athlete_decision()` (Phase 42) follows and this phase's weekly-review idempotency guarantee (ENGINE-04) reuses
- `apps/mobile/app/(auth)/onboarding/step-7.tsx`'s `OBReady` — `FadeInUp.springify().damping(12)` entrance animation pattern, reused for D-03's in-app reveal moment

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@vercel/functions` `waitUntil()` — already imported in `routes/push-events.ts`, `coach/programs/service.ts`, `coach/clients/service.ts` — the established "do AI work after responding" pattern this phase's lazy trigger (D-01) reuses.
- `backend/api/src/coach/ai/monitor-cron` — existing cron route shape (auth guard, service-role client) to mirror for `weekly-review-cron.ts`, without copying its sequential per-user loop.
- Phase 43's onboarding-celebration `FadeInUp` pattern — directly reusable for D-03's "Ziko reviewed your week" moment.
- `ai-programs` plugin / `/ai/programs/generate` route — exists and stays untouched by this phase; `create_program` is a deliberately separate, lighter tool (D-10).

### Established Patterns
- **AI SDK v6 conventions (backend, per CLAUDE.md):** `inputSchema` not `parameters`; `stopWhen: stepCountIs(n)` not `maxSteps`; `input`/`output` not `args`/`result`. Applies to `create_goal`/`create_program` tool schemas.
- **Backend ESM import rule:** any new `backend/api/src/coaching-engine/` files need `.js`-suffixed relative imports even for `.ts` sources.
- **RLS/write-lockdown from Phase 42:** any `athlete_state`/`athlete_decisions` write from this phase's cron or tools MUST go through `record_athlete_decision()` — direct writes are revoked at the DB grant level.
- **Idempotency-key pattern:** `UNIQUE (athlete_id, review_week_start) WHERE ...` partial index, same trick as the credits system, guards against double-fire from concurrent app opens and at-least-once cron redelivery (ENGINE-04).

### Integration Points
- `backend/api/src/tools/registry.ts` — `create_goal`/`create_program` register here alongside `assess_profile` (Phase 43) and every other plugin's `aiTools`.
- `record_athlete_decision()` RPC (Phase 42, live) — the single write path `apply.ts` calls, shared by both the cron and interactive tool executors.
- A new `athlete_goals` table (D-09) — new migration, referenced by `athlete_state.current_focus_detail.goal_id`.
- The existing frequently-hit app-open read path (exact endpoint TBD — Claude's discretion) — where the lazy-trigger due-check (D-01) is added.

</code_context>

<specifics>
## Specific Ideas

- The escalate-fast/de-escalate-slow asymmetry (D-04/D-05) is explicitly non-punitive by design, not just a UX nicety — it mirrors REWARD-01's "never a negative outcome" framing one phase early.
- "Program" and "goal" are deliberately different altitudes: goal = multi-week outcome, program = this week's concrete targets (D-10). Full multi-week AI-generated programs (the existing plugin) are a separate, rarer, user-initiated thing this phase never triggers automatically.

</specifics>

<deferred>
## Deferred Ideas

None — every gray area discussed was an implementation-detail or product-behavior refinement within ENGINE-01–06's existing phase boundary; nothing surfaced that belongs in a different phase.

</deferred>

---

*Phase: 44-weekly-adaptive-decision-engine*
*Context gathered: 2026-09-02*
