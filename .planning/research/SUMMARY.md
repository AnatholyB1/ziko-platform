# Project Research Summary

**Project:** Ziko Platform — v1.18 AI Coach Core (`milestone-mobile` workstream)
**Domain:** Autonomous per-athlete AI decision system — conversational onboarding, weekly adaptive decision engine, non-punitive tiered rewards, progressive feature unlock, verifiable append-only decision journal — integrated into an existing single-orchestrator AI fitness platform
**Researched:** 2026-08-30
**Confidence:** MEDIUM-HIGH

## Executive Summary

This milestone is an **integration**, not a greenfield build: it bolts a new class of *autonomous* (unprompted, scheduled) AI decision-making onto a codebase whose only existing AI surface is *reactive* (user-initiated chat with a bounded 5-step tool loop). No new runtime dependencies are needed — `ai` v6, `@ai-sdk/anthropic` v3, Hono, Vercel Cron, and Postgres+RLS are already in place and sufficient. The work is entirely schema design (a current-state table + an append-only journal, modeled directly on the existing `user_ai_credits`/`ai_credit_transactions` pair, not the looser gamification pair), a new `coaching-engine/` module mirroring the existing `coach/*` module shape, and a scheduling strategy that explicitly avoids the one existing near-precedent (`coach/ai/monitor-cron`'s sequential per-user loop) because that pattern was designed for cheap rule checks, not per-user LLM calls, and would silently truncate mid-run as the athlete base grows.

The recommended approach converges across all four research streams on the same shape: (1) a compact `athlete_state` (current level/tier/focus, RLS SELECT-only, written only via a `SECURITY DEFINER` RPC) plus an append-only `athlete_decisions` journal whose full history is never replayed into a prompt — only a bounded recent window plus a periodically-recompacted rolling summary; (2) the weekly decision itself is a **single-shot `generateObject` call with real activity data pre-fetched and embedded in the prompt**, not a multi-step tool-calling agent loop inside the cron, run with bounded concurrency and idempotent per-athlete-per-week writes (Vercel cron delivery is at-least-once — this codebase already learned that lesson once, via the v1.4 lazy-credit-reset decision, and must apply the same discipline here); (3) reward selection is AI-*curated from a fixed pool*, never randomized, with pinned low/zero temperature and a persisted rationale — a French-regulatory (ANJ/JONUM) requirement, not just a UX preference; (4) feature-gating is a third, new axis (`PluginManifest.minLevel`) enforced centrally in `PluginLoader`, deliberately kept a flat numeric threshold rather than the richer track/faction system explicitly deferred to a future milestone.

The dominant risk across the research is **implicit violation of stated invariants through calculation/plumbing bugs, not through explicit bad design**: AI decisions quietly grounded in the model's own prior claims instead of freshly-queried tables (Pitfall 1), a "never punish" principle undermined by a delta-formula edge case or a UI progress bar that visibly shrinks (Pitfall 4), and a decision journal that is architecturally correct on day one but silently degrades (token cost, "lost in the middle," over-anchoring on stale decisions) after months of production tenure if the compact-summary/full-log split isn't built in from the start (Pitfall 6). All of these are addressed by architectural choices already specified in ARCHITECTURE.md — the risk is in *skipping* them under time pressure, not in not knowing about them.

## Key Findings

### Recommended Stack

No new packages. Everything is composition of what's already installed and used elsewhere in this exact codebase: `ai` v6's `stopWhen`/`isStepCount`/`hasToolCall` composable stop-conditions (used for the *interactive* onboarding/chat turn only — raise from 5 to a named constant like 8, never touch the shared `/ai/chat` default), `@ai-sdk/anthropic` v3's `providerOptions.anthropic.cacheControl` for prompt-caching the stable per-athlete context block (not currently used anywhere in the codebase — first adoption, scoped to just the new routes), `@vercel/functions`' `waitUntil()` for deferred/batch dispatch (already used 3x in this backend), and Vercel Cron + `vercel.json` for the weekly trigger (8 crons already run this way). No vector DB / pgvector — the decision journal is a single-athlete linear-recency problem, not a similarity-search problem, and no vector extension is installed.

**Core technologies (apply existing, add nothing new):**
- `ai` ^6.0.116 + `stopWhen: [isStepCount(8), hasToolCall('grant_reward')]` — bounds the onboarding/interactive agentic turn without opening the SDK's 20-step default
- `@ai-sdk/anthropic` ^3.0.58 `cacheControl: { type: 'ephemeral' }` — amortizes repeated per-athlete context across multi-step turns and weekly reviews
- `generateObject` (not `streamText`/tool-loop) for the weekly decision itself — single-shot, deterministic-shaped output from pre-fetched real data
- Postgres structured `rolling_summary` + recent-window raw rows — explicitly not pgvector/embeddings
- Vercel Cron (`CRON_SECRET`-gated, same shape as `coach/ai/monitor-cron`) as the scheduling trigger, paired with a lazy on-app-open fallback

### Expected Features

**Must have (table stakes / P1 — all load-bearing, per PROJECT.md there is no soft-optional subset):**
- Conversational onboarding, ≤4 free-text questions, `generateObject`-based structured extraction into an experience/confidence/adherence-risk profile with a self-reported confidence field
- Immediately-completable micro-action + first celebration, scaled to the inferred profile, delivered within 5 minutes
- `athlete_state` + `athlete_decisions` journal — the required foundation everything else reads/writes
- Weekly adaptive decision engine reading **real logged activity** (not self-report) vs. assigned focus, producing next week's single focus objective — this doubles as the safety net that corrects onboarding profiling errors, so it cannot be scoped as strictly "later" than onboarding
- Non-punitive point accrual: met-or-exceeded target -> standard-or-better reward signal; under-performed -> no reward, **never negative**
- AI-curated tiered reward pool, deterministic single-id selection (never randomized) — this is both the standout differentiator and the item with the clearest regulatory rationale (French ANJ)
- Feature-gating: plugin drawer visibility driven by readiness/level computed at onboarding and updated weekly

**Should have (differentiators):**
- Free-text -> structured profile inference (vs. competitors' slider/multi-choice quizzes) — thin precedent, MEDIUM-HIGH build complexity
- Adherence-risk-first skip logic (experienced athletes bypass the ramp-up) — real false-positive risk, mitigated by the weekly engine acting as an override signal
- Real-activity-driven weekly *structural* focus decisions (which domain to focus on, not just difficulty) — closer to stepped-care behavior-change design than to any found fitness-app precedent; flagged for a dedicated research pass before the weekly-engine phase is planned

**Defer (v2+, explicitly out of scope per PROJECT.md SEED-001):**
- Factions/leagues/leaderboards/battle-pass and any social/competitive layer
- Cosmetic loot/skins
- Extended multi-state animated mascot (current scope is chat-only for onboarding)
- Logprob-based confidence scoring (self-reported confidence field is the v1 approach; only revisit if manual review shows systematic over/under-confidence)
- Coach-authored/customizable reward pools (seed a fixed pool first)

### Architecture Approach

The new work lives in a self-contained `backend/api/src/coaching-engine/` module (mirroring the existing `coach/*` per-domain shape: `db.ts`, `context.ts`, `tools.ts`, `apply.ts`, `types.ts`, plus a new cron route) that plugs into three existing seams without restructuring them: `context/user.ts` gains `athlete_state` as a 7th parallel query (compact, always-on, same rationale as the existing 6); `tools/registry.ts` registers 4 new tool schemas exactly like every other plugin's tools; `PluginLoader` gains a third gating filter (`mandatory` -> `minLevel` -> `is_enabled`) ahead of screen mount, not inside the screen. The weekly decision itself is deliberately **not** the interactive multi-step agent — it's a single `generateObject` call fed pre-aggregated real-activity data, with the actual DB write funneled through one shared `apply.ts` function called identically by both the cron path and the interactive tool-call path, so the AI-authored decision and the applied effect can never diverge.

**Major components:**
1. `athlete_state` (current-state, PK=user_id, SELECT-only RLS, written only via `record_athlete_decision()` SECURITY DEFINER RPC) — models the tighter `user_ai_credits` precedent, not the looser `user_gamification` one, because `level` is security-relevant (drives plugin gating)
2. `athlete_decisions` (append-only journal, SELECT-only RLS, partial unique index for weekly idempotency) — audit trail only; never the source read for "what happened," and never fully replayed into a prompt
3. `coaching-engine/apply.ts` — the single deterministic write path shared by AI tool executors and the cron, re-validating evidence server-side rather than trusting the model's structured output
4. `coaching-engine/weekly-review-cron.ts` — `CRON_SECRET`-gated route; cheap SQL eligibility scan -> real-activity aggregate fetch -> single `generateObject` call -> `apply.ts`, run at bounded concurrency (8-10), never a sequential per-athlete tool-loop
5. `PluginLoader` + `PluginManifest.minLevel` — the new third gating axis, fail-safe to level 1 when no `athlete_state` row exists yet

### Critical Pitfalls

1. **AI decisions grounded in conversation memory instead of real logged data** — tool executors must re-query `workout_sessions`/`habit_logs`/etc. at call time; never accept model-asserted counts as input, and never treat `athlete_decisions` entries as source-of-truth for "what happened."
2. **Naive sequential per-athlete cron loop blows Vercel's duration/cost budget as the user base grows** — do not copy `monitor-cron`'s pattern verbatim (it's safe there only because it has no LLM call in the loop); use bounded-concurrency batches with self-scheduling `next_review_due_at`, and budget/log AI cost independently since these calls aren't behind `creditCheck`/`creditDeduct`.
3. **Reward-pool "AI selects" mechanic accidentally reintroducing loot-box-adjacent randomness** — pin `temperature: 0` for the reward-selection call, never gate the pool behind paid credits or real-money spend, never allow transfer/resale, and document the "why this isn't a loot box" rationale explicitly (ANJ/JONUM law is actively evolving — flag for legal review before broad shipping).
4. **Non-punitive principle undermined by calculation/UI edge cases, not explicit punishment logic** — points/tiers/unlocks must be a strict ratchet (monotonic non-decreasing); audit copy and animations for implicit-loss framing (shrinking bars, "missed goal" messaging) even when the underlying number never actually decreased.
5. **Append-only decision journal grows unbounded** — separate the audit trail (`athlete_decisions`, full and complete) from what's fed into every future prompt (a compact, periodically-recompacted `athlete_state.rolling_summary` + a small bounded recent window); load-test token counts against a synthetic 12-month-tenure athlete before shipping, not just the fresh-onboarding happy path.

## Implications for Roadmap

Based on combined research, suggested phase structure (dependency-driven, per ARCHITECTURE.md's build order, grouped into roadmap-sized phases):

### Phase 1: Decision-System Foundation (schema + journal design)
**Rationale:** Nothing else — no tool, no cron, no gating check — can be built or tested without `athlete_state`/`athlete_decisions` existing first. Also the phase where the compact-state/full-log split (Pitfall 6) and the RLS/RPC write discipline (Pitfall 1's server-side re-validation pattern) must be locked in, since retrofitting either after data exists is materially more expensive.
**Delivers:** `athlete_state` + `athlete_decisions` migrations, `record_athlete_decision()` SECURITY DEFINER RPC, RLS policies (tighter than the gamification precedent — SELECT-only for clients, all writes via RPC/service role).
**Addresses:** Foundation requirement noted in FEATURES.md dependency graph (every other capability depends on this).
**Avoids:** Pitfall 6 (unbounded journal growth) and the RLS-missing security mistake flagged in PITFALLS.md — both must be designed in from the first migration, not bolted on later.

### Phase 2: Conversational Onboarding
**Rationale:** First *writer* of `athlete_state` — a new athlete has no row until onboarding runs, so this must land before the weekly engine or feature-gating can act on real data (gating fails-safe to level 1 in the interim).
**Delivers:** `assess_profile` AI tool, onboarding branch in `routes/ai.ts` system-prompt building, structured `generateObject` extraction with self-reported confidence field, micro-action assignment scaled to inferred profile, starting level/tier write.
**Addresses:** Table-stakes conversational intake + adaptive first-session difficulty + quick-win celebration (FEATURES.md P1 items).
**Avoids:** Pitfall 1's grounding discipline should be established here too — even onboarding's initial profile should be understood as noisy/unverified, with the weekly engine as its designed safety net (not an incidental benefit).

### Phase 3: Weekly Adaptive Decision Engine
**Rationale:** Depends on Phase 1 (schema/idempotency fields) and conceptually on Phase 2 (a profile to correct/build on). This is the highest-risk phase per PITFALLS.md (2 of 6 critical pitfalls map directly here) and the one ARCHITECTURE.md and STACK.md most explicitly diverge from the closest existing precedent (`monitor-cron`) — needs the most scrutiny at plan time.
**Delivers:** `coaching-engine/context.ts` (`fetchWeeklyReviewContext()`), `apply.ts` shared apply-logic, `create_goal`/`create_program` tools, `weekly-review-cron.ts` (bounded-concurrency, idempotent, single-shot `generateObject`, lazy on-app-open fallback).
**Uses:** `generateObject` (not the interactive agent loop), `waitUntil()`, `CRON_SECRET` cron pattern, prompt-caching for the stable per-athlete context block.
**Implements:** The `coaching-engine/` module's core; the shared apply-path architecture that keeps the cron and interactive tool executors behaviorally identical.

### Phase 4: Non-Punitive Tiered Rewards
**Rationale:** Depends on Phase 3's points/decision output existing to select against. Kept as its own phase because it carries a distinct risk profile (regulatory) from the engine itself and needs an explicit legal-rationale checkpoint before implementation, not bundled into general engine work.
**Delivers:** Reward pool data model (new tables, explicitly *not* reusing `plugins/gamification`'s coin/shop mechanic), AI reward-selection tool (`create_reward`, pinned low/zero temperature, persisted rationale), monotonicity-invariant enforcement and test coverage.
**Addresses:** The AI-curated fixed-pool differentiator (FEATURES.md) and the explicit anti-features (randomized loot-box, punitive reset) it must avoid.
**Avoids:** Pitfall 3 (ANJ-adjacent randomness) and Pitfall 4 (implicit punishment via calculation/UI edge cases) — both require design-time contracts (deterministic selection, ratchet-only fields) plus a copy/animation audit pass before shipping.

### Phase 5: Progressive Feature Unlock
**Rationale:** Depends on `athlete_state.level` being populated by Phase 2/3 to be meaningful, but is architecturally independent enough (a pure `PluginLoader` gating filter) that it could ship earlier than the full reward mechanic if sequencing pressure requires — flagged in ARCHITECTURE.md as a soft-decoupling point.
**Delivers:** `PluginManifest.minLevel`, `PluginLoader` gating filter (`mandatory` > `minLevel` > `is_enabled`, fail-safe to level 1), `PluginsDrawer` locked-badge presentational UI, deterministic floor/ceiling backstop so AI judgment can't trap or over-grant users.
**Addresses:** Progressive disclosure table-stakes pattern (FEATURES.md).
**Avoids:** Pitfall 5 (stuck-forever or unlock-everything-immediately) — requires a deterministic minimum-guarantee ladder alongside AI discretion, plus a manual/admin override escape hatch from day one.

### Phase 6: Context Wiring, Notifications & Cost Accounting
**Rationale:** Mechanically low-risk, best done last once the upstream data is real and meaningful (a 7th context query is only useful once Phase 2 is producing rows).
**Delivers:** `context/user.ts` 7th-query wiring + `## Athlete State` system-prompt section, weekly-review-completion push notification (reusing existing `notificationService.send()` idempotency pattern), `ai_cost_log` coverage for the new autonomous (non-`creditCheck`-gated) calls, explicit product decision on funding model (platform opex vs. athlete credit allocation).
**Closes:** Visibility/cost-accounting gaps flagged across STACK.md and PITFALLS.md.

### Phase Ordering Rationale

- Schema-first (Phase 1) is non-negotiable — every other phase's own research file (STACK, ARCHITECTURE, PITFALLS) independently arrives at "nothing else can be built without `athlete_state`/`athlete_decisions` existing."
- Onboarding before the weekly engine (Phase 2 -> 3) because onboarding is the first writer of state the engine needs to read, but the two are tightly coupled — the weekly engine is explicitly the safety net for onboarding profiling errors, so they should be planned as a connected pair even though built sequentially.
- Rewards (Phase 4) and feature-gating (Phase 5) are both downstream consumers of the engine's output (points, level) and can be parallelized or reordered relative to each other, but both must come after Phase 3 produces real point/level deltas to act on.
- Cost accounting and notification polish (Phase 6) deliberately last — it's real but low-risk work best validated against actual data volume from the earlier phases rather than speculated on up front.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Weekly Adaptive Decision Engine):** Vercel Fluid Compute enablement/`maxDuration` configuration is unverified against this specific project (MEDIUM confidence in STACK.md/ARCHITECTURE.md); cron batching/concurrency numbers need validating against actual or projected athlete volume before committing to a specific batch size. Also flagged: no confirmed consumer-fitness-app precedent for "stepped-care" structural weekly-focus decisions (LOW confidence in FEATURES.md) — worth a dedicated research pass before finalizing the decision logic's shape.
- **Phase 4 (Non-Punitive Tiered Rewards):** French ANJ/JONUM loot-box-adjacency law is explicitly flagged LOW confidence and actively evolving — recommend a legal-rationale checkpoint (and ideally counsel review) before this phase ships broadly, not just an engineering read of the current research.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Directly modeled on two already-shipped, working precedents in this exact codebase (`user_ai_credits`/`ai_credit_transactions` schema shape, `deduct_ai_credits` RPC pattern) — HIGH confidence, standard extension of established convention.
- **Phase 2 (Conversational Onboarding):** `generateObject` structured extraction is official, current Vercel AI SDK v6 documented pattern (HIGH confidence, Context7-verified) using the same SDK version already in production here.
- **Phase 5 (Progressive Feature Unlock):** `PluginLoader` already has an identical-shape gating precedent (`mandatory`-bypass, `is_enabled` filter) — adding a third filter is a well-documented mechanical extension, not novel design.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Context7-verified current AI SDK v6 APIs (`stopWhen`, `cacheControl`) + direct codebase inspection confirming existing dependency versions/usage; Vercel platform limits WebSearch-verified against official docs and changelog |
| Features | MEDIUM | Table-stakes patterns (Duolingo placement test, Freeletics weekly adaptation) are well-sourced from official/verified content; the specific combination this milestone asks for (deterministic AI-curated reward pool as loot-box substitute, stepped-care structural weekly adaptation) has thin-to-no direct product precedent and is flagged LOW in those specific sub-areas |
| Architecture | HIGH | Every recommendation is anchored to a specific, already-shipped file/pattern in this repo (credits schema, `monitor-cron`, `context/user.ts`, `PluginLoader`) rather than external genericism; the one MEDIUM-confidence item is Vercel Fluid Compute's exact configuration state on this specific project, unverified this session |
| Pitfalls | MEDIUM-HIGH | Grounded in both verified official Vercel docs (cron at-least-once delivery, duration limits) and direct codebase precedent (v1.4 lazy-reset decision, `monitor-cron` shape); the French ANJ/loot-box legal classification is explicitly flagged LOW confidence — unsettled, evolving law, not an engineering judgment call |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Vercel Fluid Compute enablement on this specific project is unverified** — confirm status and explicitly set `maxDuration` on the weekly-review cron route before finalizing Phase 3's batch-size assumptions; do not assume the 800s ceiling is available by default.
- **Funding model for autonomous (non-user-initiated) AI calls is undecided** — the weekly engine's LLM cost isn't naturally covered by `creditCheck`/`creditDeduct` (no user in the loop to charge); must be a conscious product decision (platform opex vs. athlete credit allocation) before Phase 3/6 implementation, not a default.
- **Stepped-care / structural weekly-focus decision design has no confirmed consumer-fitness-app precedent** (LOW confidence in FEATURES.md, inferred from clinical/behavioral-health literature) — recommend a dedicated research pass scoped to this specific mechanic before Phase 3 planning locks the decision logic's shape.
- **ANJ/JONUM reward-pool legal classification is unsettled French law, actively evolving** — treat the current research as an engineering-judgment starting point only; get legal counsel review before Phase 4 ships broadly, and revisit if any future proposal adds resale/transfer/paid-tier-gating to the reward pool.
- **Migration path for athletes already past the existing 7-step onboarding is undecided** — explicit product call needed: do already-onboarded athletes get a retroactive AI-computed starting level, or are they grandfathered at a default? Flagged as an Integration Gotcha in PITFALLS.md, not yet resolved.
- **Whether onboarding's confidence-scoring approach (self-reported field vs. logprob-based) needs revisiting** is explicitly deferred pending real usage data — flag as a v1.x follow-up trigger (manual review shows systematic over/under-confidence), not a Phase 2 blocker.

## Sources

### Primary (HIGH confidence)
- Context7 `/vercel/ai` — `isStepCount()`, `stopWhen` composable conditions, `hasToolCall`, `providerOptions.anthropic.cacheControl`, structured-extraction (`generateObject`) patterns — current v6 docs
- Direct repository inspection — `backend/api/src/context/user.ts`, `backend/api/src/tools/registry.ts`, `backend/api/src/routes/ai.ts`, `backend/api/src/routes/notifications-cron.ts`, `backend/api/src/coach/ai/service.ts`, `backend/api/vercel.json`, `apps/mobile/src/lib/PluginLoader.tsx`, `packages/plugin-sdk/src/types.ts`, `supabase/migrations/007_gamification_schema.sql`, `supabase/migrations/026_ai_credits.sql`, `.planning/PROJECT.md` Key Decisions (v1.4 lazy-reset precedent, dual-balance decision)
- Vercel official docs — Managing Cron Jobs, Configuring Maximum Duration, Limits, Queues concepts — at-least-once delivery + duration ceiling confirmation
- Duolingo — official partial-credit placement test engineering blog
- Vercel Academy — Structured Data Extraction — official AI SDK docs, same SDK/version family in use here

### Secondary (MEDIUM confidence)
- Freeletics Coach blog; Streak/milestone gamification roundups (AppStorys, Plotline); Noom onboarding critiques (The Behavioral Scientist, RevenueCat); Progressive disclosure UX sources (AI UX Playground, UXPin)
- ANJ 2023 report, Le Mag Juridique loot-box regulation analysis, Assemblee Nationale Question n14570 — official/institutional French legal sources, cross-referenced but explicitly noted as an evolving/unsettled area
- UX Collective — Gamification: Why Streaks Often Go Wrong (incl. Habitica loss-aversion data); Mem0 — Context Window is RAM, Not Storage; Mastra — Long-Term Memory for AI Agents
- Frontiers in Sports and Active Living — adherence predictors — peer-reviewed, supports the real-activity-driven weekly engine design

### Tertiary (LOW confidence)
- JONUM legislative context summary — secondary summary, law actively evolving, verify current status before shipping Phase 4 broadly
- data40.com "AI-driven loot boxes" — single source, treated cautiously; conflates odds-tuning with deterministic selection (see FEATURES.md Anti-Features)
- Stepped-care/structural weekly-focus adaptation — inferred from general behavioral-health literature via training knowledge, not verified this session against any consumer-fitness-app precedent

---
*Research completed: 2026-08-30*
*Ready for roadmap: yes*
